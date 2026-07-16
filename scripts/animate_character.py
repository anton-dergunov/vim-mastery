#!/usr/bin/env python3
"""Create a deterministic animated WebP from a static character image.

The expensive ML stages are deliberately separate from rendering:

* BiRefNet creates an alpha matte when the source has no useful alpha channel.
* SAM 2 turns a few configured point prompts into movable part masks.
* Pillow renders the cached cut-out layers into a short success animation.

Once the masks are cached, rerunning this script is local and deterministic.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


BIREfNET_MODEL = "ZhengPeng7/BiRefNet"
BIREfNET_REVISION = "e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4"
SAM2_MODEL = "facebook/sam2.1-hiera-tiny"
SAM2_REVISION = "de431c4043854a71d8101e17995dfe596bf101a5"
DEFAULT_FRAMES = 18
DEFAULT_FPS = 12
ANIMATION_FIT_FRACTION = 0.72
FOREGROUND_CACHE_VERSION = 1


class AnimationError(RuntimeError):
    """Raised when an input or generated mask cannot produce a safe animation."""


@dataclass(frozen=True)
class CanvasMapping:
    source_size: tuple[int, int]
    crop_box: tuple[int, int, int, int]
    scale: float
    offset: tuple[float, float]
    output_size: int

    def point(self, normalized_point: Sequence[float]) -> tuple[float, float]:
        width, height = self.source_size
        left, top, _, _ = self.crop_box
        source_x = float(normalized_point[0]) * width
        source_y = float(normalized_point[1]) * height
        return (
            (source_x - left) * self.scale + self.offset[0],
            (source_y - top) * self.scale + self.offset[1],
        )


@dataclass
class RenderPart:
    part_id: str
    image: Image.Image
    pivot: tuple[float, float]
    z_order: str
    rotation_curve: list[tuple[float, float]]


def sha256_bytes(*values: bytes) -> str:
    digest = hashlib.sha256()
    for value in values:
        digest.update(value)
    return digest.hexdigest()


def default_cache_dir() -> Path:
    configured = os.environ.get("VIM_WILDS_ANIMATION_CACHE")
    if configured:
        return Path(configured).expanduser()
    return Path.home() / ".cache" / "vim-wilds-animation"


def read_config(path: Path | None) -> dict[str, Any]:
    if path is None:
        return {"parts": []}
    try:
        config = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise AnimationError(f"Could not read animation config {path}: {error}") from error
    if not isinstance(config, dict) or not isinstance(config.get("parts", []), list):
        raise AnimationError("Animation config must be an object with a 'parts' array")
    for part in config.get("parts", []):
        if not isinstance(part, dict) or not part.get("id"):
            raise AnimationError("Every configured part needs a non-empty 'id'")
        if part.get("z", "front") not in {"behind", "front"}:
            raise AnimationError(f"Part {part['id']!r} has an invalid z value")
        validate_point(part.get("pivot"), f"part {part['id']} pivot")
        for prompt in part.get("prompts", []):
            for point in prompt.get("positive", []) + prompt.get("negative", []):
                validate_point(point, f"part {part['id']} prompt point")
    return config


def validate_point(point: Any, label: str) -> None:
    if (
        not isinstance(point, list)
        or len(point) != 2
        or not all(isinstance(value, (int, float)) for value in point)
        or not all(0.0 <= float(value) <= 1.0 for value in point)
    ):
        raise AnimationError(f"{label} must be a normalized [x, y] pair")


def choose_device(requested: str) -> str:
    if requested != "auto":
        return requested
    import torch

    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def image_has_useful_alpha(image: Image.Image) -> bool:
    if "A" not in image.getbands():
        return False
    low, high = image.getchannel("A").getextrema()
    return low < 250 and high > 0


def _model_output_tensor(output: Any) -> Any:
    if hasattr(output, "logits"):
        return output.logits
    if isinstance(output, dict):
        for key in ("logits", "pred_masks", "out"):
            if key in output:
                return output[key]
    if isinstance(output, (tuple, list)):
        value = output[-1]
        if isinstance(value, (tuple, list)):
            value = value[-1]
        return value
    return output


def predict_birefnet_alpha(image: Image.Image, device: str) -> Image.Image:
    """Run the official BiRefNet weights without depending on rembg."""
    import torch
    from transformers import AutoModelForImageSegmentation

    print(f"Loading {BIREfNET_MODEL} on {device}...", file=sys.stderr)
    model = AutoModelForImageSegmentation.from_pretrained(
        BIREfNET_MODEL,
        revision=BIREfNET_REVISION,
        trust_remote_code=True,
    ).eval()
    model.to(device)

    inference_size = 1024
    rgb = image.convert("RGB").resize((inference_size, inference_size), Image.Resampling.LANCZOS)
    array = np.asarray(rgb, dtype=np.float32) / 255.0
    array = (array - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array(
        [0.229, 0.224, 0.225], dtype=np.float32
    )
    model_dtype = next(model.parameters()).dtype
    tensor = torch.from_numpy(array.transpose(2, 0, 1)).unsqueeze(0).to(
        device=device,
        dtype=model_dtype,
    )

    with torch.inference_mode():
        output = _model_output_tensor(model(tensor))
        while getattr(output, "ndim", 0) > 4:
            output = output[-1]
        if output.ndim == 4:
            output = output[0, 0]
        elif output.ndim == 3:
            output = output[0]
        alpha = output.sigmoid().float().cpu().numpy()

    del model, tensor, output
    if device == "mps":
        torch.mps.empty_cache()
    alpha = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(alpha, mode="L").resize(image.size, Image.Resampling.LANCZOS)


def keep_main_component(alpha: Image.Image) -> Image.Image:
    """Drop generated checker/spark islands while retaining a soft character edge."""
    from scipy import ndimage

    values = np.asarray(alpha, dtype=np.uint8)
    foreground = values >= 28
    labels, count = ndimage.label(foreground)
    if count == 0:
        raise AnimationError("Background removal did not find a foreground character")
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    main_label = int(np.argmax(sizes))
    if sizes[main_label] < values.size * 0.01:
        raise AnimationError("The detected foreground is too small to be a character")
    keep = labels == main_label
    keep = ndimage.binary_fill_holes(keep)
    keep = ndimage.binary_dilation(keep, iterations=3)
    cleaned = np.where(keep, values, 0).astype(np.uint8)
    return Image.fromarray(cleaned, mode="L")


def decontaminate_edges(rgb: Image.Image, alpha: Image.Image) -> Image.Image:
    """Replace checker-tinted semi-transparent edge RGB with nearby foreground RGB."""
    from scipy import ndimage

    colors = np.asarray(rgb.convert("RGB"), dtype=np.uint8)
    matte = np.asarray(alpha, dtype=np.uint8)
    opaque = matte >= 235
    if opaque.any():
        _, indices = ndimage.distance_transform_edt(~opaque, return_indices=True)
        nearest = colors[indices[0], indices[1]]
        edge_weight = np.clip((235.0 - matte.astype(np.float32)) / 207.0, 0.0, 1.0)[..., None]
        colors = np.rint(colors * (1.0 - edge_weight) + nearest * edge_weight).astype(np.uint8)
    colors[matte == 0] = 0
    return Image.merge("RGBA", (*Image.fromarray(colors, "RGB").split(), alpha))


def prepare_foreground(image: Image.Image, device: str) -> Image.Image:
    if image_has_useful_alpha(image):
        rgba = image.convert("RGBA")
        alpha = keep_main_component(rgba.getchannel("A"))
        rgba.putalpha(alpha)
        return rgba
    alpha = keep_main_component(predict_birefnet_alpha(image, device))
    return decontaminate_edges(image.convert("RGB"), alpha)


def prepare_foreground_cached(
    image: Image.Image,
    source_bytes: bytes,
    cache_dir: Path,
    device: str,
) -> Image.Image:
    key = sha256_bytes(
        source_bytes,
        BIREfNET_MODEL.encode("utf-8"),
        BIREfNET_REVISION.encode("utf-8"),
        str(FOREGROUND_CACHE_VERSION).encode("ascii"),
    )[:24]
    path = cache_dir / "foreground" / f"{key}.png"
    if path.exists():
        print(f"Using cached foreground from {path}", file=sys.stderr)
        return Image.open(path).convert("RGBA")
    foreground = prepare_foreground(image, device)
    path.parent.mkdir(parents=True, exist_ok=True)
    foreground.save(path)
    return foreground


def foreground_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 8 else 0)
    bbox = alpha.getbbox()
    if bbox is None:
        raise AnimationError("The cleaned image is completely transparent")
    left, top, right, bottom = bbox
    padding = max(4, round(max(right - left, bottom - top) * 0.08))
    return (
        max(0, left - padding),
        max(0, top - padding),
        min(image.width, right + padding),
        min(image.height, bottom + padding),
    )


def normalize_image(
    image: Image.Image,
    size: int,
    crop_box: tuple[int, int, int, int] | None = None,
) -> tuple[Image.Image, CanvasMapping]:
    crop_box = crop_box or foreground_bbox(image)
    cropped = image.crop(crop_box)
    safe_size = size * ANIMATION_FIT_FRACTION
    scale = min(safe_size / cropped.width, safe_size / cropped.height)
    rendered_size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    rendered = cropped.resize(rendered_size, Image.Resampling.LANCZOS)
    offset = ((size - rendered.width) / 2.0, (size - rendered.height) / 2.0)
    canvas = Image.new("RGBA", (size, size))
    canvas.alpha_composite(rendered, (round(offset[0]), round(offset[1])))
    return canvas, CanvasMapping(image.size, crop_box, scale, offset, size)


def normalize_mask(mask: Image.Image, mapping: CanvasMapping) -> Image.Image:
    cropped = mask.convert("L").crop(mapping.crop_box)
    rendered_size = (
        max(1, round(cropped.width * mapping.scale)),
        max(1, round(cropped.height * mapping.scale)),
    )
    rendered = cropped.resize(rendered_size, Image.Resampling.LANCZOS)
    canvas = Image.new("L", (mapping.output_size, mapping.output_size))
    canvas.paste(rendered, (round(mapping.offset[0]), round(mapping.offset[1])))
    return canvas


def polygon_mask(size: tuple[int, int], polygons: Iterable[Sequence[Sequence[float]]]) -> Image.Image:
    mask = Image.new("L", size)
    draw = ImageDraw.Draw(mask)
    for polygon in polygons:
        points = [(float(x) * size[0], float(y) * size[1]) for x, y in polygon]
        if len(points) >= 3:
            draw.polygon(points, fill=255)
    return mask


def _sam_prompt_mask(
    image: Image.Image,
    prompt: dict[str, Any],
    model: Any,
    processor: Any,
    device: str,
) -> tuple[Image.Image, float]:
    import torch

    points = prompt.get("positive", []) + prompt.get("negative", [])
    labels = [1] * len(prompt.get("positive", [])) + [0] * len(prompt.get("negative", []))
    if not points:
        raise AnimationError("SAM prompt groups need at least one positive or negative point")
    pixel_points = [[[float(x) * image.width, float(y) * image.height] for x, y in points]]
    kwargs: dict[str, Any] = {
        "images": image,
        "input_points": [pixel_points],
        "input_labels": [[labels]],
        "return_tensors": "pt",
    }
    box = prompt.get("box")
    if box is not None:
        if not isinstance(box, list) or len(box) != 4:
            raise AnimationError("SAM boxes must be normalized [left, top, right, bottom]")
        kwargs["input_boxes"] = [[[
            float(box[0]) * image.width,
            float(box[1]) * image.height,
            float(box[2]) * image.width,
            float(box[3]) * image.height,
        ]]]
    inputs = processor(**kwargs)
    original_sizes = inputs["original_sizes"]
    inputs = inputs.to(device)
    with torch.inference_mode():
        outputs = model(**inputs)
    masks = processor.post_process_masks(outputs.pred_masks.cpu(), original_sizes)[0]
    scores = outputs.iou_scores.detach().float().cpu()
    candidate_scores = scores.reshape(-1)
    best_index = int(candidate_scores.argmax())
    candidate_masks = masks.reshape(-1, image.height, image.width)
    mask = candidate_masks[best_index].numpy().astype(np.uint8) * 255
    return Image.fromarray(mask, mode="L"), float(candidate_scores[best_index])


def segment_parts(
    cleaned: Image.Image,
    config: dict[str, Any],
    cache_dir: Path,
    cache_key: str,
    device: str,
) -> dict[str, Image.Image]:
    parts = config.get("parts", [])
    if not parts:
        return {}
    cache_path = cache_dir / cache_key
    cache_path.mkdir(parents=True, exist_ok=True)
    cached: dict[str, Image.Image] = {}
    missing = []
    for part in parts:
        path = cache_path / f"{part['id']}.png"
        if path.exists():
            cached[part["id"]] = Image.open(path).convert("L")
        else:
            missing.append(part)
    if not missing:
        print(f"Using cached SAM masks from {cache_path}", file=sys.stderr)
        return cached

    import torch
    from transformers import Sam2Model, Sam2Processor

    print(f"Loading {SAM2_MODEL} on {device}...", file=sys.stderr)
    model = Sam2Model.from_pretrained(SAM2_MODEL, revision=SAM2_REVISION).eval().to(device)
    processor = Sam2Processor.from_pretrained(SAM2_MODEL, revision=SAM2_REVISION)
    neutral = Image.new("RGB", cleaned.size, (118, 118, 118))
    neutral.paste(cleaned.convert("RGB"), mask=cleaned.getchannel("A"))
    foreground = cleaned.getchannel("A")

    for part in missing:
        union = Image.new("L", cleaned.size)
        scores: list[float] = []
        error: Exception | None = None
        try:
            for prompt in part.get("prompts", []):
                candidate, score = _sam_prompt_mask(neutral, prompt, model, processor, device)
                union = ImageChops.lighter(union, candidate)
                scores.append(score)
        except Exception as caught:  # A polygon override can still safely recover.
            error = caught

        union = ImageChops.multiply(union, foreground)
        foreground_area = max(1, np.count_nonzero(np.asarray(foreground) >= 28))
        part_area = np.count_nonzero(np.asarray(union) >= 128)
        ratio = part_area / foreground_area
        threshold = float(part.get("score_threshold", 0.45))
        min_ratio = float(part.get("min_foreground_ratio", 0.002))
        max_ratio = float(part.get("max_foreground_ratio", 0.35))
        valid = bool(scores) and min(scores) >= threshold and min_ratio <= ratio <= max_ratio

        override = part.get("polygon_override", [])
        if not valid and override:
            reason = str(error) if error else f"score/area check failed (scores={scores}, ratio={ratio:.3f})"
            print(f"Part {part['id']}: using polygon override because {reason}", file=sys.stderr)
            union = ImageChops.multiply(polygon_mask(cleaned.size, override), foreground)
            valid = union.getbbox() is not None
        if not valid:
            message = f"Part {part['id']}: SAM mask was unsafe (scores={scores}, ratio={ratio:.3f})"
            if part.get("required", False):
                raise AnimationError(message) from error
            print(f"Warning: {message}; skipping optional part", file=sys.stderr)
            union = Image.new("L", cleaned.size)

        union.save(cache_path / f"{part['id']}.png")
        cached[part["id"]] = union

    metadata = {
        "source_and_config_sha256": cache_key,
        "birefnet_model": BIREfNET_MODEL,
        "birefnet_revision": BIREfNET_REVISION,
        "sam2_model": SAM2_MODEL,
        "sam2_revision": SAM2_REVISION,
        "parts": [part["id"] for part in parts],
    }
    (cache_path / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    del model
    if device == "mps":
        torch.mps.empty_cache()
    return cached


def curve(points: Sequence[Sequence[float]] | Sequence[tuple[float, float]], t: float) -> float:
    if not points:
        return 0.0
    ordered = sorted((float(point[0]), float(point[1])) for point in points)
    if t <= ordered[0][0]:
        return ordered[0][1]
    for (left_t, left_value), (right_t, right_value) in zip(ordered, ordered[1:]):
        if t <= right_t:
            span = max(1e-9, right_t - left_t)
            local = (t - left_t) / span
            eased = local * local * (3.0 - 2.0 * local)
            return left_value + (right_value - left_value) * eased
    return ordered[-1][1]


def affine_layer(
    image: Image.Image,
    pivot: tuple[float, float],
    angle_degrees: float = 0.0,
    scale: tuple[float, float] = (1.0, 1.0),
    translation: tuple[float, float] = (0.0, 0.0),
) -> Image.Image:
    angle = math.radians(angle_degrees)
    cosine, sine = math.cos(angle), math.sin(angle)
    scale_x, scale_y = scale
    inv_a = cosine / scale_x
    inv_b = sine / scale_x
    inv_d = -sine / scale_y
    inv_e = cosine / scale_y
    pivot_x, pivot_y = pivot
    target_x = pivot_x + translation[0]
    target_y = pivot_y + translation[1]
    inv_c = pivot_x - inv_a * target_x - inv_b * target_y
    inv_f = pivot_y - inv_d * target_x - inv_e * target_y
    return image.transform(
        image.size,
        Image.Transform.AFFINE,
        (inv_a, inv_b, inv_c, inv_d, inv_e, inv_f),
        resample=Image.Resampling.BICUBIC,
    )


def image_with_alpha(source: Image.Image, alpha: Image.Image) -> Image.Image:
    result = source.copy()
    result.putalpha(ImageChops.multiply(source.getchannel("A"), alpha))
    return result


def erode_mask(mask: Image.Image, radius: int = 1) -> Image.Image:
    size = radius * 2 + 1
    return mask.filter(ImageFilter.MinFilter(size)) if size > 1 else mask


def make_glow(source: Image.Image) -> Image.Image:
    values = np.asarray(source, dtype=np.uint8)
    warm = (
        (values[..., 0] >= 185)
        & (values[..., 1] >= 85)
        & (values[..., 0] >= values[..., 2] * 1.45)
        & (values[..., 3] >= 80)
    )
    mask = Image.fromarray((warm * 255).astype(np.uint8), mode="L").filter(ImageFilter.GaussianBlur(7))
    glow = Image.new("RGBA", source.size, (255, 177, 38, 0))
    glow.putalpha(mask.point(lambda value: round(value * 0.58)))
    return glow


def build_render_parts(
    source: Image.Image,
    masks: dict[str, Image.Image],
    config: dict[str, Any],
    mapping: CanvasMapping,
) -> tuple[Image.Image, list[RenderPart]]:
    union = Image.new("L", source.size)
    rendered_parts: list[RenderPart] = []
    for definition in config.get("parts", []):
        original_mask = masks.get(definition["id"])
        if original_mask is None or original_mask.getbbox() is None:
            continue
        mask = normalize_mask(original_mask, mapping)
        mask = mask.filter(ImageFilter.GaussianBlur(0.45))
        union = ImageChops.lighter(union, erode_mask(mask, 1))
        rendered_parts.append(
            RenderPart(
                definition["id"],
                image_with_alpha(source, mask),
                mapping.point(definition["pivot"]),
                definition.get("z", "front"),
                [(float(t), float(value)) for t, value in definition.get("rotation", [[0, 0], [1, 0]])],
            )
        )
    base_alpha = ImageChops.subtract(source.getchannel("A"), union)
    return image_with_alpha(source, base_alpha), rendered_parts


def draw_shadow(size: int, hop_fraction: float) -> Image.Image:
    shadow = Image.new("RGBA", (size, size))
    width = size * (0.28 - min(0.08, abs(hop_fraction) * 0.65))
    height = size * 0.035
    center_x, center_y = size * 0.51, size * 0.91
    alpha = round(92 - min(48, abs(hop_fraction) * 420))
    draw = ImageDraw.Draw(shadow)
    draw.ellipse(
        (center_x - width / 2, center_y - height / 2, center_x + width / 2, center_y + height / 2),
        fill=(12, 10, 8, alpha),
    )
    return shadow.filter(ImageFilter.GaussianBlur(max(1, size / 90)))


def particle_specs(seed: int, count: int = 14) -> list[dict[str, float]]:
    rng = random.Random(seed)
    particles = []
    for _ in range(count):
        particles.append(
            {
                "start": rng.uniform(0.18, 0.38),
                "life": rng.uniform(0.30, 0.48),
                "vx": rng.uniform(-0.18, 0.18),
                "vy": rng.uniform(-0.32, -0.12),
                "size": rng.uniform(0.007, 0.016),
                "phase": rng.uniform(0, math.tau),
            }
        )
    return particles


def draw_particles(
    size: int,
    t: float,
    origin: tuple[float, float],
    particles: Sequence[dict[str, float]],
) -> Image.Image:
    layer = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(layer)
    for particle in particles:
        age = (t - particle["start"]) / particle["life"]
        if not 0.0 <= age <= 1.0:
            continue
        x = origin[0] + particle["vx"] * age * size
        y = origin[1] + (particle["vy"] * age + 0.12 * age * age) * size
        radius = particle["size"] * size * (0.7 + 0.3 * math.sin(particle["phase"] + age * 8))
        opacity = round(235 * math.sin(math.pi * age))
        color = (255, 194, 55, opacity)
        draw.polygon([(x, y - radius), (x + radius, y), (x, y + radius), (x - radius, y)], fill=color)
    return layer


def render_frames(
    source: Image.Image,
    parts: list[RenderPart],
    config: dict[str, Any],
    mapping: CanvasMapping,
    seed: int,
    frame_count: int = DEFAULT_FRAMES,
    body: Image.Image | None = None,
) -> list[Image.Image]:
    size = source.width
    if body is None:
        body_union = Image.new("L", source.size)
        for part in parts:
            body_union = ImageChops.lighter(body_union, erode_mask(part.image.getchannel("A"), 1))
        body = image_with_alpha(source, ImageChops.subtract(source.getchannel("A"), body_union))
    glow = make_glow(source)
    origin = mapping.point(config.get("effects_origin", [0.50, 0.42]))
    particles = particle_specs(seed)

    y_curve = [[0, 0], [0.13, 0.012], [0.24, -0.025], [0.48, -0.082], [0.64, -0.055], [0.79, 0], [0.88, 0.012], [1, 0]]
    sx_curve = [[0, 1], [0.13, 1.055], [0.31, 0.975], [0.52, 0.965], [0.79, 1.06], [0.9, 0.99], [1, 1]]
    sy_curve = [[0, 1], [0.13, 0.945], [0.31, 1.035], [0.52, 1.055], [0.79, 0.94], [0.9, 1.01], [1, 1]]
    angle_curve = [[0, 0], [0.14, -2], [0.48, 3.5], [0.72, 1], [0.82, -2], [1, 0]]
    anchor = (size * 0.50, size * 0.88)

    frames: list[Image.Image] = []
    for index in range(frame_count):
        t = index / (frame_count - 1)
        hop = curve(y_curve, t)
        local = Image.new("RGBA", source.size)
        pulse = math.sin(math.pi * t) ** 2
        if pulse > 0:
            pulsed = glow.copy()
            pulsed.putalpha(glow.getchannel("A").point(lambda value: round(value * pulse)))
            local.alpha_composite(pulsed)
        for part in parts:
            if part.z_order == "behind":
                local.alpha_composite(
                    affine_layer(part.image, part.pivot, curve(part.rotation_curve, t))
                )
        local.alpha_composite(body)
        for part in parts:
            if part.z_order == "front":
                local.alpha_composite(
                    affine_layer(part.image, part.pivot, curve(part.rotation_curve, t))
                )

        transformed = affine_layer(
            local,
            anchor,
            angle_degrees=curve(angle_curve, t),
            scale=(curve(sx_curve, t), curve(sy_curve, t)),
            translation=(0, hop * size),
        )
        frame = Image.new("RGBA", source.size)
        frame.alpha_composite(draw_shadow(size, hop))
        frame.alpha_composite(transformed)
        frame.alpha_composite(draw_particles(size, t, origin, particles))
        frame.putalpha(frame.getchannel("A").point(lambda value: 0 if value < 3 else value))
        frames.append(frame)
    return frames


def save_webp(frames: Sequence[Image.Image], output: Path, fps: int, loop: int) -> None:
    if not frames:
        raise AnimationError("No frames were rendered")
    encoder = shutil.which("img2webp")
    if encoder is None:
        raise AnimationError(
            "img2webp is required for exact transparent animation frames; "
            "install the WebP tools package (for example, 'brew install webp')"
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    duration = round(1000 / fps)
    durations = [duration] * len(frames)
    durations[-1] = max(duration, 250)
    with tempfile.TemporaryDirectory(prefix="vim-wilds-animation-") as directory:
        temporary = Path(directory)
        command = [encoder, "-loop", str(loop), "-kmax", "0"]
        for index, (frame, frame_duration) in enumerate(zip(frames, durations)):
            path = temporary / f"frame-{index:02d}.png"
            frame.save(path)
            command.extend(
                ["-lossless", "-exact", "-m", "6", "-d", str(frame_duration), str(path)]
            )
        encoded = temporary / "animation.webp"
        command.extend(["-o", str(encoded)])
        try:
            subprocess.run(command, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as error:
            details = error.stderr.strip() or error.stdout.strip() or str(error)
            raise AnimationError(f"img2webp failed: {details}") from error
        encoded.replace(output)


def save_debug_artifacts(
    debug_dir: Path,
    cleaned: Image.Image,
    normalized: Image.Image,
    masks: dict[str, Image.Image],
    frames: Sequence[Image.Image],
) -> None:
    debug_dir.mkdir(parents=True, exist_ok=True)
    cleaned.save(debug_dir / "cleaned-source.png")
    normalized.save(debug_dir / "normalized-source.png")
    overlay = cleaned.copy()
    colors = [(84, 206, 255, 128), (255, 102, 168, 128), (255, 205, 68, 128), (117, 238, 151, 128)]
    for index, (part_id, mask) in enumerate(masks.items()):
        mask.save(debug_dir / f"mask-{part_id}.png")
        color = Image.new("RGBA", cleaned.size, colors[index % len(colors)])
        color.putalpha(mask.point(lambda value: round(value * 0.52)))
        overlay.alpha_composite(color)
    overlay.save(debug_dir / "mask-overlay.png")
    frames_dir = debug_dir / "frames"
    frames_dir.mkdir(exist_ok=True)
    for index, frame in enumerate(frames):
        frame.save(frames_dir / f"frame-{index:02d}.png")
    preview = frames[len(frames) // 2].resize((92, 92), Image.Resampling.LANCZOS)
    preview.save(debug_dir / "preview-92px.png")


def animate(args: argparse.Namespace) -> Path:
    if args.size < 64 or args.size > 2048:
        raise AnimationError("--size must be between 64 and 2048 pixels")
    if args.loop < 0:
        raise AnimationError("--loop must be zero (infinite) or a positive play count")
    if args.output.suffix.lower() != ".webp":
        raise AnimationError("The canonical output must use a .webp extension")
    if not args.input.is_file():
        raise AnimationError(f"Input image does not exist: {args.input}")

    config = read_config(args.config)
    source_bytes = args.input.read_bytes()
    original = Image.open(args.input)
    device = choose_device(args.device)
    cleaned = prepare_foreground_cached(original, source_bytes, args.cache_dir, device)
    config_bytes = json.dumps(config, sort_keys=True, separators=(",", ":")).encode("utf-8")
    cache_key = sha256_bytes(
        cleaned.tobytes(),
        config_bytes,
        SAM2_MODEL.encode("utf-8"),
        SAM2_REVISION.encode("utf-8"),
    )[:24]
    masks = segment_parts(cleaned, config, args.cache_dir, cache_key, device)
    normalized, mapping = normalize_image(cleaned, args.size)
    body, parts = build_render_parts(normalized, masks, config, mapping)
    frames = render_frames(normalized, parts, config, mapping, args.seed, body=body)
    save_webp(frames, args.output, DEFAULT_FPS, args.loop)
    if args.debug_dir is not None:
        save_debug_artifacts(args.debug_dir, cleaned, normalized, masks, frames)
    print(f"Saved {args.output} ({len(frames)} frames at {DEFAULT_FPS} fps)")
    return args.output


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Animate a static character into a transparent success-reaction WebP.",
    )
    parser.add_argument("input", type=Path, help="Source PNG or other Pillow-readable image")
    parser.add_argument("--config", type=Path, help="Optional JSON part-prompt configuration")
    parser.add_argument("--output", type=Path, help="Output animated WebP")
    parser.add_argument("--loop", type=int, default=1, help="Play count; 0 loops forever (default: 1)")
    parser.add_argument("--seed", type=int, default=0, help="Deterministic particle seed")
    parser.add_argument("--size", type=int, default=256, help="Square output size in pixels")
    parser.add_argument("--debug-dir", type=Path, help="Write cleaned input, masks, frames, and preview")
    parser.add_argument("--cache-dir", type=Path, default=default_cache_dir(), help="Persistent ML mask cache")
    parser.add_argument(
        "--device",
        choices=("auto", "cpu", "mps", "cuda"),
        default="auto",
        help="PyTorch inference device",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.output is None:
        args.output = args.input.with_name(f"{args.input.stem}_success.webp")
    try:
        animate(args)
    except AnimationError as error:
        parser.error(str(error))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
