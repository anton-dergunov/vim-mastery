#!/usr/bin/env python3
"""Transplant a scene's compact-registered variants onto its wide board.

A visual check for ``docs/plans/scene-variations-on-wide-boards.md``, not a
runtime step: nothing under ``assets/`` is written. Each variant is cut out
with the production patch extractor, aligned to the wide board by a similarity
fit over SIFT features in a window around it, and composited there. The review
page shows the compact original and the transplant in the same wide-board
frame, with the scores that would decide a skip.
"""

from __future__ import annotations

import argparse
import html
import json
import math
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

from integrate_board_edit_patches import refined_alpha
from patch_extraction import (
    NEIGHBOR_CELLS,
    cell_scores,
    delta_e,
    dilate,
    grow_change_islands,
    pixel_mask,
    spatially_coherent_cells,
)


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_ROOT = ROOT / "artifacts/world-generation"
OUTPUT = ARTIFACT_ROOT / "wide-transplant-check"
SUMMARY = ROOT / "scripts/world-art/wide-transplant-check.json"
DEFAULT_SCENES = ("mode-lantern-grounds", "meridian-engine")

GLOBAL_FIT_MAX_SIDE = 1400
RATIO_TEST = 0.8
RANSAC_PIXELS = 3.0
WINDOW_PAD_RATIO = 1.0
WINDOW_PAD_MIN = 0.08
SEARCH_PAD = 0.2
MIN_INLIERS = 12
MAX_SURROUND_DELTA_E = 12.0
CROP_PAD_RATIO = 0.6
CROP_PAD_MIN = 140
GENERATED_MATCH_MEAN_DIFFERENCE = 3.0
SURROUND_RING_PIXELS = 32
# The tight cut-out: fully opaque where the change is unmistakable, fading out
# over the range where a glow thins into the re-rendered base around it.
TIGHT_SMOOTHING_SIGMA = 1.5
TIGHT_TRANSPARENT_DELTA_E = 7.0
TIGHT_OPAQUE_DELTA_E = 16.0
CUT_OUTS = ("production", "tight")
# The wide exercise board measured at 1280x900 in layout-masks/metrics.json.
BOARD_CSS_WIDTH = 1040


def scene_directory(scene_id: str) -> Path:
    matches = sorted((ROOT / "assets/worlds").glob(f"*/scenes/{scene_id}"))
    if len(matches) != 1:
        raise RuntimeError(f"{scene_id}: expected one scene directory, found {len(matches)}")
    return matches[0]


def load_rgb(path: Path) -> np.ndarray:
    with Image.open(path) as image:
        return np.asarray(image.convert("RGB"))


def to_gray(rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)


def as_3x3(matrix: np.ndarray) -> np.ndarray:
    return np.vstack([matrix, [0.0, 0.0, 1.0]])


def scale_of(matrix: np.ndarray) -> float:
    return math.sqrt(abs(float(np.linalg.det(matrix[:2, :2]))))


def rotation_of(matrix: np.ndarray) -> float:
    return math.degrees(math.atan2(matrix[1, 0], matrix[0, 0]))


def apply(matrix: np.ndarray, points: np.ndarray) -> np.ndarray:
    return points @ matrix[:2, :2].T + matrix[:2, 2]


def detect(gray: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    keypoints, descriptors = cv2.SIFT_create().detectAndCompute(gray, None)
    points = np.array([keypoint.pt for keypoint in keypoints], dtype=np.float32)
    return points.reshape(-1, 2), descriptors


def similarity_fit(
    source_points: np.ndarray,
    source_descriptors: np.ndarray | None,
    target_points: np.ndarray,
    target_descriptors: np.ndarray | None,
) -> tuple[np.ndarray | None, int, int]:
    """Return the fitted 2x3 matrix, its inlier count and the match count."""
    if (
        source_descriptors is None
        or target_descriptors is None
        or len(source_points) < 3
        or len(target_points) < 3
    ):
        return None, 0, 0
    pairs = cv2.BFMatcher(cv2.NORM_L2).knnMatch(source_descriptors, target_descriptors, k=2)
    good = [
        pair[0]
        for pair in pairs
        if len(pair) == 2 and pair[0].distance < RATIO_TEST * pair[1].distance
    ]
    if len(good) < 3:
        return None, 0, len(good)
    matrix, inliers = cv2.estimateAffinePartial2D(
        source_points[[match.queryIdx for match in good]],
        target_points[[match.trainIdx for match in good]],
        method=cv2.RANSAC,
        ransacReprojThreshold=RANSAC_PIXELS,
        maxIters=5000,
        confidence=0.999,
    )
    if matrix is None:
        return None, 0, len(good)
    return matrix, int(inliers.sum()), len(good)


def global_fit(compact: np.ndarray, wide: np.ndarray) -> tuple[np.ndarray, int]:
    """Whole-picture compact-to-wide similarity, fitted on reduced copies."""
    def reduced(image: np.ndarray) -> tuple[np.ndarray, float]:
        factor = min(1.0, GLOBAL_FIT_MAX_SIDE / max(image.shape[:2]))
        size = (round(image.shape[1] * factor), round(image.shape[0] * factor))
        return cv2.resize(to_gray(image), size, interpolation=cv2.INTER_AREA), factor

    small_compact, compact_factor = reduced(compact)
    small_wide, wide_factor = reduced(wide)
    matrix, inliers, _ = similarity_fit(*detect(small_compact), *detect(small_wide))
    if matrix is None:
        raise RuntimeError("whole-picture alignment failed")
    full = (
        np.diag([1 / wide_factor, 1 / wide_factor, 1.0])
        @ as_3x3(matrix)
        @ np.diag([compact_factor, compact_factor, 1.0])
    )
    return full[:2], inliers


def cut_out(
    base_at_variant_size: np.ndarray,
    generated: np.ndarray,
    mode: str,
) -> np.ndarray:
    """The production extractor's alpha for one full-board variant, or the
    tight alpha inside it.

    The production patch is drawn back over the picture it was generated
    from, so it can afford to carry the re-rendered base around a change. On
    a different picture those surroundings land on top of their own
    counterparts and double them, which the tight alpha avoids by keeping
    only what clearly changed."""
    differences = delta_e(base_at_variant_size, generated)
    scores = cell_scores(differences)
    _, evidence, _, _, retained_cell_sets, _ = spatially_coherent_cells(scores)
    grown_islands, _ = grow_change_islands(retained_cell_sets, evidence)
    coarse_mask = pixel_mask(dilate(grown_islands, NEIGHBOR_CELLS))
    alpha, _ = refined_alpha(differences, coarse_mask)
    if mode == "production":
        return alpha
    smoothed = ndimage.gaussian_filter(differences, TIGHT_SMOOTHING_SIGMA)
    ramp = np.clip(
        (smoothed - TIGHT_TRANSPARENT_DELTA_E)
        / (TIGHT_OPAQUE_DELTA_E - TIGHT_TRANSPARENT_DELTA_E),
        0,
        1,
    )
    core = ndimage.binary_fill_holes(ndimage.binary_closing(
        ramp >= 1,
        structure=np.ones((3, 3), dtype=bool),
        iterations=2,
    ))
    # Drop the faint specks of re-rendered edges that touch no real change.
    labels, _ = ndimage.label(ramp > 0, structure=np.ones((3, 3), dtype=bool))
    attached = np.isin(labels, np.unique(labels[core & (alpha > 0)])) & (labels > 0)
    tight = np.maximum(ramp, core) * attached * (alpha / 255.0)
    if not np.any(tight):
        raise RuntimeError("tight cut-out has no visible pixels")
    return np.rint(tight * 255).astype(np.uint8)


def variant_source(scene_id: str, shipped: Path) -> tuple[np.ndarray, np.ndarray | None, str]:
    """Return the variant's RGB, its shipped alpha if it is a patch, and where
    the pixels came from. A full-board variant prefers the lossless generated
    PNG that matches what ships."""
    with Image.open(shipped) as image:
        if image.mode == "RGBA":
            pixels = np.asarray(image)
            return pixels[..., :3], pixels[..., 3], "shipped patch"
        shipped_rgb = np.asarray(image.convert("RGB"))
    best: tuple[float, Path] | None = None
    review = ARTIFACT_ROOT / "patch-reviews" / scene_id
    for candidate in sorted(review.glob(f"round-*/generated/{shipped.stem}.png")):
        pixels = load_rgb(candidate)
        if pixels.shape != shipped_rgb.shape:
            continue
        difference = float(np.abs(pixels.astype(np.int16) - shipped_rgb).mean())
        if best is None or difference < best[0]:
            best = (difference, candidate)
    if best and best[0] <= GENERATED_MATCH_MEAN_DIFFERENCE:
        return load_rgb(best[1]), None, f"generated PNG ({best[1].parts[-3]})"
    return shipped_rgb, None, "shipped WebP"


def padded_box(
    box: tuple[float, float, float, float],
    ratio: float,
    minimum: float,
    limit: tuple[int, int],
) -> tuple[int, int, int, int]:
    left, top, right, bottom = box
    pad_x = max((right - left) * ratio, minimum)
    pad_y = max((bottom - top) * ratio, minimum)
    return (
        max(0, math.floor(left - pad_x)),
        max(0, math.floor(top - pad_y)),
        min(limit[0], math.ceil(right + pad_x)),
        min(limit[1], math.ceil(bottom + pad_y)),
    )


def inside(points: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    return (
        (points[:, 0] >= box[0]) & (points[:, 0] < box[2])
        & (points[:, 1] >= box[1]) & (points[:, 1] < box[3])
    )


def warp(image: np.ndarray, matrix: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    return cv2.warpAffine(
        image,
        matrix[:2].astype(np.float64),
        size,
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0,
    )


def save_png(pixels: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels).save(path, "PNG", optimize=False, compress_level=4)


def process_scene(scene_id: str, mode: str) -> dict[str, Any]:
    directory = scene_directory(scene_id)
    compact = load_rgb(directory / "compact/base.webp")
    wide = load_rgb(directory / "wide/base.webp")
    wide_size = (wide.shape[1], wide.shape[0])
    compact_size = (compact.shape[1], compact.shape[0])
    whole, whole_inliers = global_fit(compact, wide)
    compact_points, compact_descriptors = detect(to_gray(compact))
    wide_points, wide_descriptors = detect(to_gray(wide))
    output = OUTPUT / (scene_id if mode == "production" else f"{scene_id}-{mode}")
    rows = []

    for shipped in sorted((directory / "variants").glob("*.webp")):
        variant_id = shipped.stem
        generated, shipped_alpha, source = variant_source(scene_id, shipped)
        height, width = generated.shape[:2]
        base_small = np.asarray(
            Image.fromarray(compact).resize((width, height), Image.Resampling.LANCZOS)
        )
        row: dict[str, Any] = {"id": variant_id, "source": source}
        try:
            alpha = shipped_alpha if shipped_alpha is not None else cut_out(base_small, generated, mode)
        except RuntimeError as error:
            row.update({"placed": False, "pass": False, "reason": f"cut-out failed: {error}"})
            rows.append(row)
            continue
        if shipped_alpha is not None:
            # A shipped patch carries no surroundings; show it over its base.
            weight = (alpha[..., None] / 255.0)
            generated = np.rint(generated * weight + base_small * (1 - weight)).astype(np.uint8)

        to_compact = np.diag([compact_size[0] / width, compact_size[1] / height, 1.0])
        ys, xs = np.nonzero(alpha)
        patch_box = np.array(
            [[xs.min(), ys.min()], [xs.max() + 1, ys.max() + 1]], dtype=np.float64
        ) * [to_compact[0, 0], to_compact[1, 1]]
        window = padded_box(
            tuple(patch_box.ravel()),
            WINDOW_PAD_RATIO,
            WINDOW_PAD_MIN * compact_size[0],
            compact_size,
        )
        corners = np.array([
            [window[0], window[1]], [window[2], window[1]],
            [window[2], window[3]], [window[0], window[3]],
        ], dtype=np.float64)
        projected = apply(whole, corners)
        search = padded_box(
            (*projected.min(axis=0), *projected.max(axis=0)),
            0.0,
            SEARCH_PAD * wide_size[0],
            wide_size,
        )
        in_window = inside(compact_points, window)
        in_search = inside(wide_points, search)
        local, inliers, matches = similarity_fit(
            compact_points[in_window],
            compact_descriptors[in_window],
            wide_points[in_search],
            wide_descriptors[in_search],
        )
        fitted = local is not None and inliers >= MIN_INLIERS
        compact_to_wide = local if fitted else whole
        variant_to_wide = (as_3x3(compact_to_wide) @ to_compact)[:2]

        premultiplied = np.dstack([
            generated.astype(np.float32) * (alpha[..., None] / 255.0),
            alpha.astype(np.float32),
        ])
        placed = warp(premultiplied, variant_to_wide, wide_size)
        placed_alpha = np.clip(placed[..., 3:] / 255.0, 0, 1)
        transplanted = np.rint(
            np.clip(placed[..., :3] + wide * (1 - placed_alpha), 0, 255)
        ).astype(np.uint8)
        original = np.clip(warp(generated, variant_to_wide, wide_size), 0, 255).astype(np.uint8)
        compact_in_wide = warp(compact, compact_to_wide, wide_size)

        ys, xs = np.nonzero(placed_alpha[..., 0] > 0.02)
        if not len(xs):
            row.update({"placed": False, "pass": False, "reason": "lands outside the wide board"})
            rows.append(row)
            continue
        target = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        crop = padded_box(target, CROP_PAD_RATIO, CROP_PAD_MIN, wide_size)
        region = (slice(crop[1], crop[3]), slice(crop[0], crop[2]))
        # Agreement of the two base pictures on and just around the patch:
        # how well the spot the variant was drawn for exists on the wide board.
        ring = ndimage.binary_dilation(
            placed_alpha[region][..., 0] > 0.02,
            iterations=SURROUND_RING_PIXELS,
        )
        surround = float(np.median(delta_e(
            cv2.GaussianBlur(compact_in_wide[region], (0, 0), 2),
            cv2.GaussianBlur(wide[region], (0, 0), 2),
        )[ring]))
        centre = np.array([[(patch_box[0, 0] + patch_box[1, 0]) / 2,
                            (patch_box[0, 1] + patch_box[1, 1]) / 2]])
        drift = float(np.linalg.norm(apply(compact_to_wide, centre) - apply(whole, centre)))

        reasons = []
        if not fitted:
            reasons.append(f"weak local fit ({inliers} inliers), placed by the whole-picture fit")
        if surround > MAX_SURROUND_DELTA_E:
            reasons.append(f"surroundings differ (ΔE {surround:.1f})")
        save_png(original[region], output / "crops" / f"{variant_id}-compact.png")
        save_png(transplanted[region], output / "crops" / f"{variant_id}-wide.png")
        save_png(wide[region], output / "crops" / f"{variant_id}-base.png")
        (output / "boards").mkdir(parents=True, exist_ok=True)
        Image.fromarray(transplanted).save(
            output / "boards" / f"{variant_id}.webp", "WEBP", quality=92, method=4
        )
        row.update({
            "placed": True,
            "pass": not reasons,
            "reason": "; ".join(reasons),
            "localFit": fitted,
            "inliers": inliers,
            "matches": matches,
            "inlierRatio": round(inliers / matches, 3) if matches else 0.0,
            "enlargement": round(scale_of(variant_to_wide), 3),
            "rotationDegrees": round(rotation_of(variant_to_wide), 2),
            "surroundDeltaE": round(surround, 2),
            "driftFromWholePictureFitPixels": round(drift, 1),
            "patchBoardPercent": round(float((placed_alpha > 0.02).mean() * 100), 2),
            "wideBox": list(target),
            "crop": list(crop),
        })
        rows.append(row)
        print(
            f"{scene_id} [{mode}] {variant_id}: {'pass' if not reasons else 'SKIP'} "
            f"inliers {inliers}/{matches} dE {surround:.1f} x{row['enlargement']}",
            flush=True,
        )

    rows.sort(key=lambda item: (item["pass"], -item.get("surroundDeltaE", 99.0)))
    scene = {
        "sceneId": scene_id,
        "cutOut": mode,
        "compactSize": list(compact_size),
        "wideSize": list(wide_size),
        "wholePictureFit": {
            "scale": round(scale_of(whole), 4),
            "rotationDegrees": round(rotation_of(whole), 2),
            "offset": [round(float(whole[0, 2]), 1), round(float(whole[1, 2]), 1)],
            "inliers": whole_inliers,
        },
        "variants": len(rows),
        "passed": sum(item["pass"] for item in rows),
        "rows": rows,
    }
    write_page(scene, output / "index.html")
    return scene


PAGE = """<!doctype html>
<meta charset="utf-8">
<title>{title}</title>
<style>
  body {{ margin: 0; padding: 20px; background: #15181b; color: #dfe5e2; font: 14px/1.45 system-ui, sans-serif; }}
  h1 {{ font-size: 20px; margin: 0 0 4px; }}
  p {{ margin: 4px 0; max-width: 78ch; }}
  .bar {{ position: sticky; top: 0; z-index: 2; background: #15181b; padding: 10px 0; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }}
  button {{ font: inherit; color: inherit; background: #262c30; border: 1px solid #47525a; border-radius: 6px; padding: 5px 10px; cursor: pointer; }}
  button[aria-pressed="true"] {{ background: #d8b65b; color: #15181b; border-color: #d8b65b; }}
  section {{ border-top: 1px solid #333b41; padding: 16px 0; }}
  h2 {{ font-size: 15px; margin: 0 0 2px; }}
  .skip h2::after {{ content: " — would skip"; color: #ff9a7a; }}
  .meta {{ color: #9fb0a8; }}
  .pair {{ display: flex; gap: 14px; overflow-x: auto; margin-top: 10px; align-items: flex-start; }}
  figure {{ margin: 0; flex: none; }}
  figcaption {{ color: #9fb0a8; font-size: 12px; margin-bottom: 4px; }}
  img {{ display: block; cursor: pointer; }}
  a {{ color: #8fd0c0; }}
</style>
<h1>{title}</h1>
<p>{summary}</p>
<p>Left: the variation as approved, on the compact picture, warped into the wide board's frame. Right: the same variation cut out and placed on the wide picture. Click the right picture (or hold B) to blink between the wide board with and without it.</p>
<div class="bar">
  <span>Size:</span>
  <button data-zoom="board">As on a desktop board</button>
  <button data-zoom="1">1 image pixel = 1 screen pixel</button>
  <button data-zoom="2">2×</button>
  <button id="only-skips" aria-pressed="false">Only would-skip</button>
</div>
{rows}
<script>
  const boardScale = {board_css_width} * devicePixelRatio / {wide_width};
  const images = [...document.querySelectorAll("img")];
  function zoom(value) {{
    const scale = value === "board" ? boardScale : Number(value);
    for (const image of images) image.style.width = `${{image.dataset.width * scale / devicePixelRatio}}px`;
    for (const button of document.querySelectorAll("[data-zoom]")) button.setAttribute("aria-pressed", String(button.dataset.zoom === value));
  }}
  for (const button of document.querySelectorAll("[data-zoom]")) button.addEventListener("click", () => zoom(button.dataset.zoom));
  zoom("board");
  const blinkers = [...document.querySelectorAll("img[data-base]")];
  function show(image, base) {{
    image.src = base ? image.dataset.base : image.dataset.with;
    image.closest("figure").querySelector("figcaption").textContent = base ? "Wide board, no variation" : "Wide board, transplanted";
  }}
  for (const image of blinkers) image.addEventListener("click", () => show(image, image.src.endsWith(image.dataset.with)));
  addEventListener("keydown", (event) => {{ if (event.key === "b" && !event.repeat) blinkers.forEach((image) => show(image, true)); }});
  addEventListener("keyup", (event) => {{ if (event.key === "b") blinkers.forEach((image) => show(image, false)); }});
  const onlySkips = document.querySelector("#only-skips");
  onlySkips.addEventListener("click", () => {{
    const on = onlySkips.getAttribute("aria-pressed") !== "true";
    onlySkips.setAttribute("aria-pressed", String(on));
    for (const section of document.querySelectorAll("section:not(.skip)")) section.hidden = on;
  }});
</script>
"""


def write_page(scene: dict[str, Any], destination: Path) -> None:
    sections = []
    for row in scene["rows"]:
        name = html.escape(row["id"])
        if not row["placed"]:
            sections.append(
                f'<section class="skip"><h2>{name}</h2>'
                f'<div class="meta">{html.escape(row["reason"])}</div></section>'
            )
            continue
        width = row["crop"][2] - row["crop"][0]
        meta = (
            f'enlarged {row["enlargement"]}× · rotated {row["rotationDegrees"]}° · '
            f'{row["inliers"]} of {row["matches"]} feature matches agree · '
            f'surroundings ΔE {row["surroundDeltaE"]} · covers {row["patchBoardPercent"]}% '
            f'of the board · {html.escape(row["source"])}'
        )
        if row["reason"]:
            meta += f'<br>{html.escape(row["reason"])}'
        sections.append(
            f'<section class="{"" if row["pass"] else "skip"}"><h2>{name}</h2>'
            f'<div class="meta">{meta} · <a href="boards/{name}.webp">whole board</a></div>'
            f'<div class="pair">'
            f'<figure><figcaption>Compact original</figcaption>'
            f'<img loading="lazy" data-width="{width}" src="crops/{name}-compact.png"></figure>'
            f'<figure><figcaption>Wide board, transplanted</figcaption>'
            f'<img loading="lazy" data-width="{width}" src="crops/{name}-wide.png" '
            f'data-with="crops/{name}-wide.png" data-base="crops/{name}-base.png"></figure>'
            f'</div></section>'
        )
    fit = scene["wholePictureFit"]
    summary = (
        f'{scene["passed"]} of {scene["variants"]} variations pass the score thresholds '
        f'(at least {MIN_INLIERS} agreeing feature matches, surroundings ΔE at most '
        f'{MAX_SURROUND_DELTA_E:g}). Worst first. Compact {scene["compactSize"][0]}×'
        f'{scene["compactSize"][1]}, wide {scene["wideSize"][0]}×{scene["wideSize"][1]}; '
        f'whole-picture fit: compact scene at {fit["scale"]}× its own pixels, '
        f'rotated {fit["rotationDegrees"]}°.'
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(PAGE.format(
        title=f"Wide transplant check: {scene['sceneId']} ({scene['cutOut']} cut-out)",
        summary=summary,
        rows="\n".join(sections),
        board_css_width=BOARD_CSS_WIDTH,
        wide_width=scene["wideSize"][0],
    ))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scenes", nargs="*", default=DEFAULT_SCENES, help="scene ids to check")
    parser.add_argument(
        "--cut-out",
        choices=CUT_OUTS,
        default="production",
        help="the production patch alpha, or only what clearly changed inside it",
    )
    args = parser.parse_args()
    scenes = [process_scene(scene_id, args.cut_out) for scene_id in args.scenes]
    done = {(scene["sceneId"], scene["cutOut"]) for scene in scenes}
    if SUMMARY.exists():
        scenes += [
            scene
            for scene in json.loads(SUMMARY.read_text())["scenes"]
            if (scene["sceneId"], scene.get("cutOut")) not in done
        ]
    scenes.sort(key=lambda scene: (scene["sceneId"], scene["cutOut"]))
    SUMMARY.write_text(json.dumps({
        "schemaVersion": 1,
        "thresholds": {
            "minInliers": MIN_INLIERS,
            "maxSurroundDeltaE": MAX_SURROUND_DELTA_E,
        },
        "scenes": scenes,
    }, indent=2, ensure_ascii=False) + "\n")
    for scene in scenes:
        print(f"{scene['sceneId']} [{scene['cutOut']}]: {scene['passed']} of {scene['variants']} pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
