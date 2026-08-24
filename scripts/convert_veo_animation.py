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
MORPH_HEAD_TIMES = (1 / 3, 2 / 3)
MORPH_TAIL_TIMES = (1 / 4, 2 / 4, 3 / 4)


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


def largest_component_mask(alpha: Image.Image, minimum_alpha: int = 64) -> np.ndarray:
    """Return only the connected body mask, excluding detached effect pixels."""
    values = np.asarray(alpha, dtype=np.uint8)
    labels, count = ndimage.label(values >= minimum_alpha)
    if count == 0:
        raise ConversionError("The matte does not contain a visible character")
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    label = int(np.argmax(sizes))
    return labels == label


def largest_component_bbox(alpha: Image.Image, minimum_alpha: int = 64) -> tuple[int, int, int, int]:
    mask = largest_component_mask(alpha, minimum_alpha)
    rows, columns = np.where(mask)
    return int(columns.min()), int(rows.min()), int(columns.max()) + 1, int(rows.max()) + 1


def keep_character_and_effects(
    alpha: Image.Image,
    minimum_alpha: int = 28,
    effect_margin_ratio: float = 0.85,
    temporal_bounds: tuple[int, int, int, int] | None = None,
) -> Image.Image:
    """Keep the sprite plus detached effects without clipping animated motion.

    Veo often separates a wand tip, sparkle, projectile, or high jump accent
    into its own component.  The former 30% proximity margin was too tight and
    could erase those components before the all-frame canvas-fit stage saw
    them.  The larger conservative envelope still rejects remote compression
    speckles while preserving legitimate character-adjacent animation.
    """
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
    if temporal_bounds is not None:
        left, top, right, bottom = temporal_bounds
    margin = max(48, int(max(right - left, bottom - top) * effect_margin_ratio))
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


def temporal_main_bounds(alphas: Sequence[Image.Image], minimum_alpha: int = 28) -> tuple[int, int, int, int]:
    """Union the main sprite bounds across the whole clip before effect filtering."""
    bounds = [largest_component_bbox(alpha, minimum_alpha) for alpha in alphas]
    return (
        min(bound[0] for bound in bounds), min(bound[1] for bound in bounds),
        max(bound[2] for bound in bounds), max(bound[3] for bound in bounds),
    )


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
    temporal_bounds = temporal_main_bounds(alphas)
    result: list[Image.Image] = []
    for frame, alpha in zip(frames, alphas):
        cleaned_alpha = keep_character_and_effects(alpha, temporal_bounds=temporal_bounds)
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
    """Register endpoint body masks to the anchor, then preserve all-frame extent.

    Detached effects are deliberately excluded from registration. The search
    is deterministic and coarse-to-fine around the former bbox estimate, while
    the complete alpha bounds still determine transparent canvas expansion.
    """
    if not frames:
        raise ConversionError("At least one frame is required for placement")
    if anchor_fit not in {"width", "height", "area"}:
        raise ConversionError(f"Unknown anchor fit: {anchor_fit}")
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
    seed_scale = {
        "width": width_scale,
        "height": height_scale,
        "area": (width_scale * height_scale) ** 0.5,
    }[anchor_fit]
    minimum_scale = seed_scale * 0.92
    maximum_scale = seed_scale * 1.08
    anchor_target = anchor.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    anchor_body = largest_component_mask(anchor_target.getchannel("A"))
    endpoint_masks = [largest_component_mask(frames[0].getchannel("A"))]
    if len(frames) > 1:
        endpoint_masks.append(largest_component_mask(frames[-1].getchannel("A")))

    first_center_x = (first_body[0] + first_body[2]) / 2
    first_baseline = first_body[3]
    scaled_mask_cache: dict[tuple[int, float], tuple[np.ndarray, int, int]] = {}

    def registration_score(scale: float, offset_x: int, offset_y: int) -> float:
        candidate_x = target_center_x - first_center_x * scale + offset_x
        candidate_y = target_baseline - first_baseline * scale + offset_y
        scores = []
        for index, mask in enumerate(endpoint_masks):
            cache_key = (index, round(scale, 12))
            if cache_key not in scaled_mask_cache:
                scaled_mask_cache[cache_key] = scaled_component_mask(mask, scale)
            scaled, left, top = scaled_mask_cache[cache_key]
            scores.append(
                positioned_mask_iou(
                    anchor_body,
                    scaled,
                    round(candidate_x + left * scale),
                    round(candidate_y + top * scale),
                )
            )
        return float(np.mean(scores))

    best_scale = seed_scale
    best_dx = 0
    best_dy = 0
    best_score = -1.0
    # The first level finds the basin cheaply; the second supplies the requested
    # 0.5% scale and one-pixel translation precision.
    for scale_radius, scale_step, shift_radius, shift_step in (
        (0.08, 0.02, 6, 2),
        (0.02, 0.005, 2, 1),
    ):
        center_scale = best_scale
        center_dx = best_dx
        center_dy = best_dy
        scale_offsets = np.arange(-scale_radius, scale_radius + scale_step / 2, scale_step)
        shifts = range(-shift_radius, shift_radius + 1, shift_step)
        for scale_offset in scale_offsets:
            candidate_scale = float(np.clip(
                center_scale * (1 + float(scale_offset)), minimum_scale, maximum_scale
            ))
            for shift_y in shifts:
                for shift_x in shifts:
                    candidate_dx = center_dx + shift_x
                    candidate_dy = center_dy + shift_y
                    score = registration_score(candidate_scale, candidate_dx, candidate_dy)
                    tie_break = (
                        abs(candidate_scale / seed_scale - 1),
                        abs(candidate_dx) + abs(candidate_dy),
                        abs(candidate_dy),
                        abs(candidate_dx),
                    )
                    best_tie_break = (
                        abs(best_scale / seed_scale - 1),
                        abs(best_dx) + abs(best_dy),
                        abs(best_dy),
                        abs(best_dx),
                    )
                    if score > best_score + 1e-12 or (
                        abs(score - best_score) <= 1e-12 and tie_break < best_tie_break
                    ):
                        best_scale, best_dx, best_dy, best_score = (
                            candidate_scale,
                            candidate_dx,
                            candidate_dy,
                            score,
                        )

    desired_scale = best_scale
    bounds = [alpha_bbox(frame) for frame in frames]

    x = target_center_x - first_center_x * desired_scale + best_dx
    y = target_baseline - first_baseline * desired_scale + best_dy
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


def translated_mask_iou(
    target: np.ndarray, source: np.ndarray, scale: float, x: float, y: float
) -> float:
    """Measure a scaled/translated body mask without allocating a full canvas."""
    scaled, left, top = scaled_component_mask(source, scale)
    return positioned_mask_iou(target, scaled, round(x + left * scale), round(y + top * scale))


def scaled_component_mask(source: np.ndarray, scale: float) -> tuple[np.ndarray, int, int]:
    """Crop and resize a component mask once for repeated registration shifts."""
    rows, columns = np.where(source)
    if rows.size == 0:
        return np.zeros((1, 1), dtype=bool), 0, 0
    left, top = int(columns.min()), int(rows.min())
    right, bottom = int(columns.max()) + 1, int(rows.max()) + 1
    cropped = Image.fromarray((source[top:bottom, left:right] * 255).astype(np.uint8), mode="L")
    scaled_width = max(1, round(cropped.width * scale))
    scaled_height = max(1, round(cropped.height * scale))
    scaled = np.asarray(
        cropped.resize((scaled_width, scaled_height), Image.Resampling.NEAREST), dtype=np.uint8
    ) >= 128
    return scaled, left, top


def positioned_mask_iou(
    target: np.ndarray, scaled: np.ndarray, destination_left: int, destination_top: int
) -> float:
    """Measure a prepared mask at an integer destination translation."""
    scaled_height, scaled_width = scaled.shape
    destination_right = destination_left + scaled_width
    destination_bottom = destination_top + scaled_height
    clip_left = max(0, destination_left)
    clip_top = max(0, destination_top)
    clip_right = min(target.shape[1], destination_right)
    clip_bottom = min(target.shape[0], destination_bottom)
    if clip_left >= clip_right or clip_top >= clip_bottom:
        return 0.0
    source_slice = scaled[
        clip_top - destination_top : clip_bottom - destination_top,
        clip_left - destination_left : clip_right - destination_left,
    ]
    target_slice = target[clip_top:clip_bottom, clip_left:clip_right]
    intersection = int(np.count_nonzero(source_slice & target_slice))
    source_area = int(np.count_nonzero(scaled))
    target_area = int(np.count_nonzero(target))
    union = source_area + target_area - intersection
    return intersection / union if union else 1.0


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


def render_anchor_frame(anchor: Image.Image, size: int, canvas_size: int) -> Image.Image:
    """Rebuild an idle sprite in the exact padded coordinate frame of a clip."""
    if canvas_size < size or (canvas_size - size) % 2:
        raise ConversionError("Clip canvas must symmetrically contain the logical anchor square")
    idle = anchor.convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (canvas_size, canvas_size))
    inset = (canvas_size - size) // 2
    canvas.alpha_composite(idle, (inset, inset))
    return canvas


def _signed_distance_and_nearest_rgb(image: Image.Image) -> tuple[np.ndarray, np.ndarray]:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8)
    mask = rgba[..., 3] >= 28
    if not mask.any():
        raise ConversionError("Cannot morph a fully transparent endpoint")
    signed_distance = ndimage.distance_transform_edt(mask) - ndimage.distance_transform_edt(~mask)
    _, indices = ndimage.distance_transform_edt(~mask, return_indices=True)
    nearest_rgb = rgba[indices[0], indices[1], :3].astype(np.float32) / 255.0
    return signed_distance.astype(np.float32), nearest_rgb


def morph_frame(start: Image.Image, end: Image.Image, t: float) -> Image.Image:
    """Morph two RGBA silhouettes with an SDF and edge-safe premultiplied RGB."""
    if start.size != end.size:
        raise ConversionError("Morph endpoints must use the same canvas")
    if not 0 < t < 1:
        raise ConversionError("Morph interpolation must be strictly between zero and one")
    return _morph_prepared(
        _signed_distance_and_nearest_rgb(start),
        _signed_distance_and_nearest_rgb(end),
        t,
    )


def _morph_prepared(
    start: tuple[np.ndarray, np.ndarray],
    end: tuple[np.ndarray, np.ndarray],
    t: float,
) -> Image.Image:
    start_sdf, start_rgb = start
    end_sdf, end_rgb = end
    interpolated_sdf = start_sdf * (1 - t) + end_sdf * t
    edge = np.clip((interpolated_sdf + 1.0) / 2.0, 0.0, 1.0)
    alpha = edge * edge * (3.0 - 2.0 * edge)
    # Pull colours into the new shape, premultiply, blend, then unpremultiply
    # so feathered edge pixels cannot pick up a dark halo.
    premultiplied = (
        start_rgb * alpha[..., None] * (1 - t)
        + end_rgb * alpha[..., None] * t
    )
    rgb = np.divide(
        premultiplied,
        alpha[..., None],
        out=np.zeros_like(premultiplied),
        where=alpha[..., None] > 1e-6,
    )
    rgba = np.concatenate((rgb, alpha[..., None]), axis=2)
    return Image.fromarray(np.rint(np.clip(rgba, 0, 1) * 255).astype(np.uint8), mode="RGBA")


def add_idle_morph_ramp(
    frames: Sequence[Image.Image], anchor_frame: Image.Image
) -> list[Image.Image]:
    """Bookend a clip with exact idle pixels and short silhouette morphs."""
    if not frames:
        raise ConversionError("Cannot add an idle ramp to an empty clip")
    if any(frame.size != anchor_frame.size for frame in frames):
        raise ConversionError("Every ramp frame must share the anchor canvas")
    anchor_prepared = _signed_distance_and_nearest_rgb(anchor_frame)
    first_prepared = _signed_distance_and_nearest_rgb(frames[0])
    last_prepared = _signed_distance_and_nearest_rgb(frames[-1])
    return [
        anchor_frame.copy(),
        *(_morph_prepared(anchor_prepared, first_prepared, t) for t in MORPH_HEAD_TIMES),
        *(frame.copy() for frame in frames),
        *(_morph_prepared(last_prepared, anchor_prepared, t) for t in MORPH_TAIL_TIMES),
        anchor_frame.copy(),
    ]


def morph_ramp_durations(source_frame_count: int, fps: int) -> list[int]:
    """Keep the source duration exact while making the seven added frames short."""
    if source_frame_count < 1 or fps < 1:
        raise ConversionError("Frame count and fps must be positive")
    total_duration = round(source_frame_count * 1000 / fps)
    added_frames = 2 + len(MORPH_HEAD_TIMES) + len(MORPH_TAIL_TIMES)
    ramp_duration = min(
        max(1, round(500 / fps)),
        max(1, (total_duration - source_frame_count) // added_frames),
    )
    source_duration = total_duration - ramp_duration * added_frames
    source_durations = [
        round((index + 1) * source_duration / source_frame_count)
        - round(index * source_duration / source_frame_count)
        for index in range(source_frame_count)
    ]
    return (
        [ramp_duration] * (1 + len(MORPH_HEAD_TIMES))
        + source_durations
        + [ramp_duration] * (1 + len(MORPH_TAIL_TIMES))
    )


def save_webp(
    frames: Sequence[Image.Image],
    output: Path,
    fps: int,
    loop: int,
    *,
    lossless: bool = True,
    quality: int = 88,
    durations_ms: Sequence[int] | None = None,
) -> None:
    if not frames:
        raise ConversionError("No frames were rendered")
    if durations_ms is not None and (
        len(durations_ms) != len(frames) or any(duration < 1 for duration in durations_ms)
    ):
        raise ConversionError("Custom WebP durations must contain one positive value per frame")
    encoder = require_executable("img2webp")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="vim-wilds-veo-webp-") as directory:
        root = Path(directory)
        command = [encoder, "-loop", str(loop), "-kmax", "0"]
        for index, frame in enumerate(frames):
            path = root / f"frame-{index:04d}.png"
            frame.save(path)
            # Method 4 is still visually identical for lossless output and
            # high quality for runtime output, while making large batch
            # conversions practical on a laptop.
            encoding = ["-lossless", "-exact", "-m", "4"] if lossless else ["-q", str(quality), "-m", "4"]
            duration = (
                durations_ms[index]
                if durations_ms is not None
                else round((index + 1) * 1000 / fps) - round(index * 1000 / fps)
            )
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
    placement: Placement | None,
) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for index in {0, len(source) // 2, len(source) - 1}:
        source[index].save(directory / f"source-{index:02d}.png")
        cleaned[index].save(directory / f"matte-{index:02d}.png")
    for index in {0, len(rendered) // 2, len(rendered) - 1}:
        rendered[index].save(directory / f"frame-{index:02d}.png")
    rendered[len(rendered) // 2].resize((92, 92), Image.Resampling.LANCZOS).save(directory / "preview-92px.png")
    (directory / "conversion.json").write_text(
        json.dumps(
            {
                "background_rgb": [round(float(value), 2) for value in background],
                "border_variation": round(variation, 3),
                "placement": (
                    {
                        "scale": placement.scale,
                        "x": placement.x,
                        "y": placement.y,
                        "inset": placement.inset,
                        "canvas_size": placement.canvas_size,
                        "css_scale": placement.canvas_size / (placement.canvas_size - placement.inset * 2),
                    }
                    if placement is not None
                    else {"mode": "native", "canvas_size": list(rendered[0].size)}
                ),
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
        aligned = render_aligned_frames(cleaned, placement, args.size)
        rendered = add_idle_morph_ramp(
            aligned, render_anchor_frame(anchor, args.size, placement.canvas_size)
        )
        durations = morph_ramp_durations(len(aligned), args.fps)
        save_webp(rendered, args.output, args.fps, args.loop, durations_ms=durations)
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
