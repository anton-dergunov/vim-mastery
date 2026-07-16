#!/usr/bin/env python3
"""Convert a Veo character clip into an aligned transparent animated WebP.

Veo currently returns an opaque MP4.  This tool is deliberately designed for
the locked, plain background used by ``generate_nix_veo_lite.py``: it learns
that background from every video border, creates a soft foreground matte, and
places the moving character on the same square canvas as an existing in-game
sprite.  It never crops a foreground pixel to make the animation fit.

Example:
    python scripts/convert_veo_animation.py scripts/nix_happy_veo_lite.mp4 \
      --anchor assets/nix.png --output assets/nix-success.webp

The normal path is entirely local and uses ffmpeg plus img2webp.  BiRefNet is
an optional fallback for a video whose border is not a sufficiently flat
background; its weights are fetched only when that fallback is selected.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
from PIL import Image
from scipy import ndimage


DEFAULT_SIZE = 256
DEFAULT_FPS = 12


class ConversionError(RuntimeError):
    """Raised for invalid media or a conversion that cannot be made safely."""


@dataclass(frozen=True)
class Placement:
    """Scale and translation mapping a video frame onto the output canvas."""

    scale: float
    x: float
    y: float
    inset: int
    canvas_size: int


def require_executable(name: str) -> str:
    executable = shutil.which(name)
    if executable is None:
        raise ConversionError(
            f"{name} is required; install ffmpeg and the WebP tools "
            "(for example, 'brew install ffmpeg webp')."
        )
    return executable


def parse_hex_color(value: str) -> np.ndarray:
    value = value.removeprefix("#")
    if len(value) != 6 or any(character not in "0123456789abcdefABCDEF" for character in value):
        raise argparse.ArgumentTypeError("background colour must be #RRGGBB")
    return np.array([int(value[index : index + 2], 16) for index in range(0, 6, 2)], dtype=np.float32)


def extract_frames(video: Path, fps: int, directory: Path) -> list[Image.Image]:
    if not video.is_file():
        raise ConversionError(f"Input video does not exist: {video}")
    ffmpeg = require_executable("ffmpeg")
    directory.mkdir(parents=True, exist_ok=True)
    output_pattern = directory / "source-%04d.png"
    command = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(video),
        "-vf",
        f"fps={fps}",
        "-vsync",
        "0",
        str(output_pattern),
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as error:
        details = error.stderr.strip() or error.stdout.strip() or str(error)
        raise ConversionError(f"ffmpeg could not decode {video}: {details}") from error
    frames = [Image.open(path).convert("RGB") for path in sorted(directory.glob("source-*.png"))]
    if len(frames) < 2:
        raise ConversionError("Video must contain at least two frames after sampling")
    if len({frame.size for frame in frames}) != 1:
        raise ConversionError("Video decode returned inconsistent frame sizes")
    return frames


def border_pixels(frame: np.ndarray, width: int) -> np.ndarray:
    return np.concatenate(
        (
            frame[:width, :, :].reshape(-1, 3),
            frame[-width:, :, :].reshape(-1, 3),
            frame[width:-width, :width, :].reshape(-1, 3),
            frame[width:-width, -width:, :].reshape(-1, 3),
        )
    )


def estimate_background(frames: Sequence[Image.Image], border: int | None = None) -> tuple[np.ndarray, float]:
    """Return a robust RGB background estimate and its 95th percentile spread."""
    arrays = [np.asarray(frame.convert("RGB"), dtype=np.float32) for frame in frames]
    height, width, _ = arrays[0].shape
    border = border or max(4, min(width, height) // 40)
    samples = np.concatenate([border_pixels(array, border) for array in arrays])
    background = np.median(samples, axis=0)
    distances = np.linalg.norm(samples - background, axis=1)
    return background, float(np.percentile(distances, 95))


def soft_background_alpha(
    frame: Image.Image,
    background: np.ndarray,
    threshold: float,
    softness: float,
) -> Image.Image:
    """Make background-coloured pixels transparent while retaining a soft edge."""
    rgb = np.asarray(frame.convert("RGB"), dtype=np.float32)
    distance = np.linalg.norm(rgb - background[None, None, :], axis=2)
    alpha = np.clip((distance - threshold) / max(softness, 0.001), 0.0, 1.0)
    return Image.fromarray(np.rint(alpha * 255).astype(np.uint8), mode="L")


def largest_component_bbox(alpha: Image.Image, minimum_alpha: int = 64) -> tuple[int, int, int, int]:
    values = np.asarray(alpha, dtype=np.uint8)
    labels, count = ndimage.label(values >= minimum_alpha)
    if count == 0:
        raise ConversionError("The matte does not contain a visible character")
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    label = int(np.argmax(sizes))
    rows, columns = np.where(labels == label)
    return int(columns.min()), int(rows.min()), int(columns.max()) + 1, int(rows.max()) + 1


def keep_character_and_effects(alpha: Image.Image, minimum_alpha: int = 28) -> Image.Image:
    """Keep the main sprite and small nearby sparks, but reject background noise."""
    values = np.asarray(alpha, dtype=np.uint8)
    labels, count = ndimage.label(values >= minimum_alpha)
    if count == 0:
        raise ConversionError("Background extraction found no foreground")
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    main_label = int(np.argmax(sizes))
    if sizes[main_label] < 16:
        raise ConversionError("The detected foreground is too small to be a character")
    rows, columns = np.where(labels == main_label)
    left, top, right, bottom = columns.min(), rows.min(), columns.max() + 1, rows.max() + 1
    margin = max(20, int(max(right - left, bottom - top) * 0.30))
    keep_labels = {main_label}
    for label in range(1, count + 1):
        if sizes[label] < 3:
            continue
        component_rows, component_columns = np.where(labels == label)
        if component_rows.size == 0:
            continue
        if (
            component_columns.min() >= left - margin
            and component_columns.max() < right + margin
            and component_rows.min() >= top - margin
            and component_rows.max() < bottom + margin
        ):
            keep_labels.add(label)
    keep = np.isin(labels, list(keep_labels))
    return Image.fromarray(np.where(keep, values, 0).astype(np.uint8), mode="L")


def decontaminate_edges(frame: Image.Image, alpha: Image.Image) -> Image.Image:
    """Replace background-tinted semi-transparent RGB with nearby opaque RGB."""
    colors = np.asarray(frame.convert("RGB"), dtype=np.uint8)
    matte = np.asarray(alpha, dtype=np.uint8)
    opaque = matte >= 235
    if opaque.any():
        _, indices = ndimage.distance_transform_edt(~opaque, return_indices=True)
        nearest = colors[indices[0], indices[1]]
        blend = np.clip((235.0 - matte.astype(np.float32)) / 207.0, 0.0, 1.0)[..., None]
        colors = np.rint(colors * (1.0 - blend) + nearest * blend).astype(np.uint8)
    colors[matte == 0] = 0
    result = Image.fromarray(colors, mode="RGB").convert("RGBA")
    result.putalpha(alpha)
    return result


def birefnet_alphas(frames: Sequence[Image.Image], device: str) -> list[Image.Image]:
    """Run the existing local BiRefNet dependency once for all fallback frames."""
    import torch
    from transformers import AutoModelForImageSegmentation

    import animate_character

    resolved_device = animate_character.choose_device(device)
    print(f"Background is not flat; loading {animate_character.BIREfNET_MODEL} on {resolved_device}...", file=sys.stderr)
    model = AutoModelForImageSegmentation.from_pretrained(
        animate_character.BIREfNET_MODEL,
        revision=animate_character.BIREfNET_REVISION,
        trust_remote_code=True,
    ).eval()
    model.to(resolved_device)
    dtype = next(model.parameters()).dtype
    alphas: list[Image.Image] = []
    for frame in frames:
        rgb = frame.convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
        values = np.asarray(rgb, dtype=np.float32) / 255.0
        values = (values - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array(
            [0.229, 0.224, 0.225], dtype=np.float32
        )
        tensor = torch.from_numpy(values.transpose(2, 0, 1)).unsqueeze(0).to(device=resolved_device, dtype=dtype)
        with torch.inference_mode():
            output = animate_character._model_output_tensor(model(tensor))
            if output.ndim == 4:
                output = output[0, 0]
            elif output.ndim == 3:
                output = output[0]
            alpha = output.sigmoid().float().cpu().numpy()
        alphas.append(
            Image.fromarray(np.rint(np.clip(alpha, 0, 1) * 255).astype(np.uint8), mode="L").resize(
                frame.size, Image.Resampling.LANCZOS
            )
        )
    del model
    if resolved_device == "mps":
        torch.mps.empty_cache()
    return alphas


def matte_frames(
    frames: Sequence[Image.Image],
    background: np.ndarray,
    threshold: float,
    softness: float,
    mode: str,
    device: str,
) -> list[Image.Image]:
    if mode == "birefnet":
        alphas = birefnet_alphas(frames, device)
    else:
        alphas = [soft_background_alpha(frame, background, threshold, softness) for frame in frames]
    result: list[Image.Image] = []
    for frame, alpha in zip(frames, alphas):
        cleaned_alpha = keep_character_and_effects(alpha)
        result.append(decontaminate_edges(frame, cleaned_alpha))
    return result


def alpha_bbox(image: Image.Image, minimum_alpha: int = 1) -> tuple[int, int, int, int]:
    values = np.asarray(image.getchannel("A"), dtype=np.uint8)
    rows, columns = np.where(values >= minimum_alpha)
    if rows.size == 0:
        raise ConversionError("A frame became fully transparent")
    return int(columns.min()), int(rows.min()), int(columns.max()) + 1, int(rows.max()) + 1


def fit_placement(
    frames: Sequence[Image.Image], anchor: Image.Image, size: int, padding: int, anchor_fit: str = "width"
) -> Placement:
    """Align the initial body to the anchor while finding the largest safe scale."""
    anchor_alpha = anchor.convert("RGBA").getchannel("A")
    anchor_box = anchor_alpha.getbbox()
    if anchor_box is None:
        raise ConversionError("Anchor sprite must contain visible alpha")
    first_body = largest_component_bbox(frames[0].getchannel("A"))
    target_scale = size / anchor.width
    target_center_x = ((anchor_box[0] + anchor_box[2]) / 2) * target_scale
    target_baseline = anchor_box[3] * target_scale
    width_scale = ((anchor_box[2] - anchor_box[0]) * target_scale) / (first_body[2] - first_body[0])
    height_scale = ((anchor_box[3] - anchor_box[1]) * target_scale) / (first_body[3] - first_body[1])
    if anchor_fit == "width":
        desired_scale = width_scale
    elif anchor_fit == "height":
        desired_scale = height_scale
    elif anchor_fit == "area":
        desired_scale = (width_scale * height_scale) ** 0.5
    else:
        raise ConversionError(f"Unknown anchor fit: {anchor_fit}")
    bounds = [alpha_bbox(frame) for frame in frames]

    x = target_center_x - ((first_body[0] + first_body[2]) / 2) * desired_scale
    y = target_baseline - first_body[3] * desired_scale
    minimum_x = min(left * desired_scale + x for left, _, _, _ in bounds)
    maximum_x = max(right * desired_scale + x for _, _, right, _ in bounds)
    minimum_y = min(top * desired_scale + y for _, top, _, _ in bounds)
    maximum_y = max(bottom * desired_scale + y for _, _, _, bottom in bounds)
    overflow = max(
        padding - minimum_x,
        maximum_x - (size - padding),
        padding - minimum_y,
        maximum_y - (size - padding),
        0.0,
    )
    # Keep the original logical square centred in a larger transparent canvas.
    # CSS can scale that canvas by canvas_size / size, so the character retains
    # its native Veo proportions and anchor-relative on-screen size.
    inset = int(np.ceil(overflow))
    return Placement(
        scale=desired_scale,
        x=x + inset,
        y=y + inset,
        inset=inset,
        canvas_size=size + inset * 2,
    )


def render_aligned_frames(frames: Sequence[Image.Image], placement: Placement, size: int) -> list[Image.Image]:
    rendered: list[Image.Image] = []
    for frame in frames:
        scaled_size = (max(1, round(frame.width * placement.scale)), max(1, round(frame.height * placement.scale)))
        scaled = frame.resize(scaled_size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (placement.canvas_size, placement.canvas_size))
        canvas.alpha_composite(scaled, (round(placement.x), round(placement.y)))
        alpha = np.asarray(canvas.getchannel("A"), dtype=np.uint8)
        if alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any():
            raise ConversionError("Alignment would clip foreground pixels at the output canvas edge")
        rendered.append(canvas)
    return rendered


def save_webp(
    frames: Sequence[Image.Image],
    output: Path,
    fps: int,
    loop: int,
    *,
    lossless: bool = True,
    quality: int = 88,
) -> None:
    if not frames:
        raise ConversionError("No frames were rendered")
    encoder = require_executable("img2webp")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="vim-wilds-veo-webp-") as directory:
        root = Path(directory)
        command = [encoder, "-loop", str(loop), "-kmax", "0"]
        for index, frame in enumerate(frames):
            path = root / f"frame-{index:04d}.png"
            frame.save(path)
            encoding = ["-lossless", "-exact", "-m", "6"] if lossless else ["-q", str(quality), "-m", "6"]
            duration = round((index + 1) * 1000 / fps) - round(index * 1000 / fps)
            command.extend([*encoding, "-d", str(duration), str(path)])
        encoded = root / "animation.webp"
        command.extend(["-o", str(encoded)])
        try:
            subprocess.run(command, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as error:
            details = error.stderr.strip() or error.stdout.strip() or str(error)
            raise ConversionError(f"img2webp failed: {details}") from error
        encoded.replace(output)


def inspect_webp_animation(path: Path) -> dict[str, int]:
    """Read authoritative animation timing and loop metadata with webpmux."""
    webpmux = require_executable("webpmux")
    try:
        result = subprocess.run(
            [webpmux, "-info", str(path)], check=True, capture_output=True, text=True
        )
    except subprocess.CalledProcessError as error:
        details = error.stderr.strip() or error.stdout.strip() or str(error)
        raise ConversionError(f"webpmux could not inspect {path}: {details}") from error
    metadata: dict[str, int] = {"frames": 0, "duration_ms": 0, "loop": -1}
    for line in result.stdout.splitlines():
        stripped = line.strip()
        if stripped.startswith("Number of frames:"):
            metadata["frames"] = int(stripped.rsplit(":", 1)[1])
        elif "Loop Count :" in stripped:
            metadata["loop"] = int(stripped.rsplit("Loop Count :", 1)[1])
        else:
            columns = stripped.split()
            if columns and columns[0].rstrip(":").isdigit() and len(columns) >= 7:
                metadata["duration_ms"] += int(columns[6])
    if metadata["frames"] < 1 or metadata["loop"] < 0:
        raise ConversionError(f"Could not parse animated WebP metadata for {path}")
    return metadata


def write_debug(
    directory: Path,
    source: Sequence[Image.Image],
    cleaned: Sequence[Image.Image],
    rendered: Sequence[Image.Image],
    background: np.ndarray,
    variation: float,
    placement: Placement,
) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for index in {0, len(source) // 2, len(source) - 1}:
        source[index].save(directory / f"source-{index:02d}.png")
        cleaned[index].save(directory / f"matte-{index:02d}.png")
        rendered[index].save(directory / f"frame-{index:02d}.png")
    rendered[len(rendered) // 2].resize((92, 92), Image.Resampling.LANCZOS).save(directory / "preview-92px.png")
    (directory / "conversion.json").write_text(
        json.dumps(
            {
                "background_rgb": [round(float(value), 2) for value in background],
                "border_variation": round(variation, 3),
                "placement": {
                    "scale": placement.scale,
                    "x": placement.x,
                    "y": placement.y,
                    "inset": placement.inset,
                    "canvas_size": placement.canvas_size,
                    "css_scale": placement.canvas_size / (placement.canvas_size - placement.inset * 2),
                },
            },
            indent=2,
        )
        + "\n"
    )


def convert(args: argparse.Namespace) -> Path:
    if args.size < 64 or args.size > 2048:
        raise ConversionError("--size must be between 64 and 2048")
    if args.fps < 1 or args.fps > 60:
        raise ConversionError("--fps must be between 1 and 60")
    if args.padding < 1 or args.padding * 2 >= args.size:
        raise ConversionError("--padding must fit inside the output canvas")
    if args.loop < 0:
        raise ConversionError("--loop must be zero (infinite) or a positive play count")
    if args.output.suffix.lower() != ".webp":
        raise ConversionError("--output must use the .webp extension")
    if not args.anchor.is_file():
        raise ConversionError(f"Anchor sprite does not exist: {args.anchor}")

    with tempfile.TemporaryDirectory(prefix="vim-wilds-veo-frames-") as directory:
        source_frames = extract_frames(args.input, args.fps, Path(directory))
        inferred_background, variation = estimate_background(source_frames)
        background = args.background if args.background is not None else inferred_background
        mode = args.matte_mode
        if mode == "auto":
            mode = "background" if variation <= args.max_background_variation else "birefnet"
        print(
            f"Matting {len(source_frames)} frames with {mode}; background "
            f"{','.join(str(round(value)) for value in background)}, border variation {variation:.2f}",
            file=sys.stderr,
        )
        cleaned = matte_frames(source_frames, background, args.threshold, args.softness, mode, args.device)
        anchor = Image.open(args.anchor).convert("RGBA")
        placement = fit_placement(cleaned, anchor, args.size, args.padding, args.anchor_fit)
        rendered = render_aligned_frames(cleaned, placement, args.size)
        save_webp(rendered, args.output, args.fps, args.loop)
        if args.debug_dir is not None:
            write_debug(args.debug_dir, source_frames, cleaned, rendered, background, variation, placement)
    css_scale = rendered[0].size[0] / args.size
    print(
        f"Saved {args.output} ({len(rendered)} frames at {args.fps} fps, loop={args.loop}, "
        f"canvas={rendered[0].size[0]}, css-scale={css_scale:.5f})"
    )
    return args.output


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Convert an opaque Veo character MP4 into transparent animated WebP.")
    parser.add_argument("input", type=Path, help="Veo MP4 input")
    parser.add_argument("--anchor", type=Path, required=True, help="Transparent static sprite whose placement to match")
    parser.add_argument("--output", type=Path, required=True, help="Transparent animated WebP output")
    parser.add_argument("--size", type=int, default=DEFAULT_SIZE, help="Logical square size before transparent safety expansion (default: 256)")
    parser.add_argument("--fps", type=int, default=DEFAULT_FPS, help="Sample/output frame rate (default: 12)")
    parser.add_argument("--padding", type=int, default=6, help="Guaranteed transparent edge padding (default: 6)")
    parser.add_argument(
        "--anchor-fit",
        choices=("width", "height", "area"),
        default="width",
        help="Anchor dimension used for uniform Veo sizing (default: width)",
    )
    parser.add_argument("--loop", type=int, default=1, help="Play count; 0 means loop forever (default: 1)")
    parser.add_argument("--debug-dir", type=Path, help="Write representative mattes, frames, and placement metadata")
    parser.add_argument("--matte-mode", choices=("auto", "background", "birefnet"), default="auto")
    parser.add_argument("--background", type=parse_hex_color, help="Override inferred background as #RRGGBB")
    parser.add_argument("--threshold", type=float, default=7.0, help="Background-distance cutoff before alpha (default: 7)")
    parser.add_argument("--softness", type=float, default=16.0, help="Background edge feather distance (default: 16)")
    parser.add_argument(
        "--max-background-variation",
        type=float,
        default=7.0,
        help="Auto mode uses BiRefNet above this border variation (default: 7)",
    )
    parser.add_argument("--device", choices=("auto", "cpu", "mps", "cuda"), default="auto")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        convert(args)
    except ConversionError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
