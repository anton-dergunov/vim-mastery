#!/usr/bin/env python3
"""Prove whole-canvas registered-patch extraction on five approved variants.

This proof deliberately consumes no authored target bounds. It compares every
16x16 cell in the complete approved base and Nano Banana output, measures each
cell against robust whole-image noise statistics, and multiplies that evidence
by linearly distance-weighted evidence from nearby cells. It retains
independently substantial coherent components, grows their connected
lower-contrast edges as change islands, expands them by one neighboring cell,
and stores only those pixels in a cropped lossless WebP with transparency.

The exactness assertion is against the cell-filtered reference: selected cells
come byte-for-byte from the generated image and discarded cells come
byte-for-byte from the base. That distinction matters because intentionally
discarding any non-zero generated difference cannot also reproduce the
unfiltered generated image exactly.
"""

from __future__ import annotations

import io
import json
import math
import subprocess
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "artifacts/world-generation/full-canvas-patch-proof"
BASE_REF = "32848bc^"
VARIANT_REF = "32848bc"
CELL_SIZE = 16
DELTA_E_CLIP = 40.0
BASELINE_ROBUST_SIGMAS = 4.0
NEIGHBOR_CELLS = 1
SPATIAL_RADIUS_CELLS = 8
ISOLATED_EVIDENCE_FLOOR = 0.15
MAX_EVIDENCE_FOR_SUPPORT = 12.0
MIN_COMPONENT_ENERGY_RATIO = 0.15
ISLAND_GROWTH_MAX_CELLS = 4
ISLAND_GROWTH_BASE_EVIDENCE = 1.0
ISLAND_GROWTH_DISTANCE_PENALTY = 0.3
MIN_ISLAND_STRENGTH_FACTOR = 0.75
MAX_ISLAND_STRENGTH_FACTOR = 1.5

CASES = [
    ("starwater-sanctuary", "nested-garden", "distant-left-island-c01"),
    ("starwater-sanctuary", "starneedle-observatory", "upper-left-terrace-c04"),
    ("archive-of-echoes", "memory-archive", "right-landing-c02"),
    ("archive-of-echoes", "echo-clock", "lower-right-ledge-c03"),
    ("brass-meridian", "meridian-engine", "upper-right-lens-c05"),
]


def git_blob(ref: str, path: str) -> bytes:
    return subprocess.run(
        ["git", "show", f"{ref}:{path}"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    ).stdout


def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    values = rgb.astype(np.float64) / 255.0
    linear = np.where(
        values <= 0.04045,
        values / 12.92,
        ((values + 0.055) / 1.055) ** 2.4,
    )
    xyz = linear @ np.array([
        [0.4124564, 0.2126729, 0.0193339],
        [0.3575761, 0.7151522, 0.1191920],
        [0.1804375, 0.0721750, 0.9503041],
    ])
    xyz /= np.array([0.95047, 1.0, 1.08883])
    transformed = np.where(
        xyz > 0.008856,
        xyz ** (1 / 3),
        7.787 * xyz + 16 / 116,
    )
    return np.stack((
        116 * transformed[..., 1] - 16,
        500 * (transformed[..., 0] - transformed[..., 1]),
        200 * (transformed[..., 1] - transformed[..., 2]),
    ), axis=-1)


def delta_e(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    return np.linalg.norm(rgb_to_lab(left) - rgb_to_lab(right), axis=2)


def otsu_threshold(values: np.ndarray) -> float:
    minimum = float(values.min())
    maximum = float(values.max())
    if math.isclose(minimum, maximum):
        return maximum
    histogram, edges = np.histogram(values, bins=256, range=(minimum, maximum))
    probabilities = histogram / histogram.sum()
    centers = (edges[:-1] + edges[1:]) / 2
    weights = np.cumsum(probabilities)
    means = np.cumsum(probabilities * centers)
    total_mean = means[-1]
    variance = (total_mean * weights - means) ** 2 / (
        weights * (1 - weights) + 1e-12
    )
    return float(centers[np.argmax(variance)])


def cell_scores(differences: np.ndarray) -> np.ndarray:
    height, width = differences.shape
    if height % CELL_SIZE or width % CELL_SIZE:
        raise RuntimeError(
            f"Canvas {width}x{height} is not divisible by {CELL_SIZE}"
        )
    clipped = np.minimum(differences, DELTA_E_CLIP)
    return clipped.reshape(
        height // CELL_SIZE,
        CELL_SIZE,
        width // CELL_SIZE,
        CELL_SIZE,
    ).mean(axis=(1, 3))


def dilate(cells: np.ndarray, radius: int) -> np.ndarray:
    result = cells.copy()
    for _ in range(radius):
        padded = np.pad(result, 1)
        result = np.logical_or.reduce([
            padded[y:y + result.shape[0], x:x + result.shape[1]]
            for y in range(3)
            for x in range(3)
        ])
    return result


def spatial_support(evidence: np.ndarray) -> np.ndarray:
    """Return linearly distance-weighted evidence from other nearby cells."""
    support = np.zeros_like(evidence)
    weight_total = 0.0
    height, width = evidence.shape
    for delta_y in range(-SPATIAL_RADIUS_CELLS, SPATIAL_RADIUS_CELLS + 1):
        for delta_x in range(-SPATIAL_RADIUS_CELLS, SPATIAL_RADIUS_CELLS + 1):
            if delta_x == 0 and delta_y == 0:
                continue
            weight = max(
                0.0,
                1
                - math.hypot(delta_x, delta_y)
                / (SPATIAL_RADIUS_CELLS + 1),
            )
            if weight == 0:
                continue
            weight_total += weight
            destination_y = slice(
                max(0, delta_y),
                min(height, height + delta_y),
            )
            destination_x = slice(
                max(0, delta_x),
                min(width, width + delta_x),
            )
            source_y = slice(
                max(0, -delta_y),
                min(height, height - delta_y),
            )
            source_x = slice(
                max(0, -delta_x),
                min(width, width - delta_x),
            )
            support[destination_y, destination_x] += (
                evidence[source_y, source_x] * weight
            )
    return support / weight_total


def spatially_coherent_cells(
    scores: np.ndarray,
) -> tuple[
    np.ndarray,
    np.ndarray,
    float,
    list[dict[str, Any]],
    list[list[tuple[int, int]]],
    int,
]:
    """Select coherent high-difference components across the whole matrix."""
    median = float(np.median(scores))
    mad = float(np.median(np.abs(scores - median)))
    noise_scale = max(1.4826 * mad, 0.25)
    evidence = np.maximum(0, (scores - median) / noise_scale)
    support = spatial_support(np.minimum(evidence, MAX_EVIDENCE_FOR_SUPPORT))
    normalized_support = support / max(float(support.max()), 1e-9)
    coherence = evidence * (
        ISOLATED_EVIDENCE_FLOOR
        + (1 - ISOLATED_EVIDENCE_FLOOR) * normalized_support
    )
    threshold = otsu_threshold(coherence)
    candidates = coherence > threshold

    visited = np.zeros_like(candidates)
    components = []
    for start_y, start_x in zip(*np.nonzero(candidates)):
        if visited[start_y, start_x]:
            continue
        stack = [(int(start_y), int(start_x))]
        visited[start_y, start_x] = True
        cells = []
        while stack:
            y, x = stack.pop()
            cells.append((y, x))
            for offset_y in (-1, 0, 1):
                for offset_x in (-1, 0, 1):
                    neighbor_y = y + offset_y
                    neighbor_x = x + offset_x
                    if (
                        0 <= neighbor_y < candidates.shape[0]
                        and 0 <= neighbor_x < candidates.shape[1]
                        and candidates[neighbor_y, neighbor_x]
                        and not visited[neighbor_y, neighbor_x]
                    ):
                        visited[neighbor_y, neighbor_x] = True
                        stack.append((neighbor_y, neighbor_x))
        energy = float(sum(coherence[y, x] for y, x in cells))
        components.append({"cells": cells, "energy": energy})

    components.sort(key=lambda item: item["energy"], reverse=True)
    strongest_energy = components[0]["energy"] if components else 0
    selected = np.zeros_like(candidates)
    retained = []
    retained_cell_sets = []
    rejected_cells = 0
    for component in components:
        ratio = (
            component["energy"] / strongest_energy
            if strongest_energy
            else 0
        )
        keep = not retained or ratio >= MIN_COMPONENT_ENERGY_RATIO
        if keep:
            for y, x in component["cells"]:
                selected[y, x] = True
            retained.append({
                "cellCount": len(component["cells"]),
                "energy": round(component["energy"], 3),
                "strongestEnergyRatio": round(ratio, 4),
            })
            retained_cell_sets.append(component["cells"])
        else:
            rejected_cells += len(component["cells"])
    return (
        selected,
        evidence,
        threshold,
        retained,
        retained_cell_sets,
        rejected_cells,
    )


def grow_change_islands(
    retained_cell_sets: list[list[tuple[int, int]]],
    evidence: np.ndarray,
) -> tuple[np.ndarray, list[float]]:
    """Grow low-contrast edges only when connected to a strong change island."""
    island_strengths = []
    for cells in retained_cell_sets:
        values = np.array([evidence[y, x] for y, x in cells])
        island_strengths.append(
            math.sqrt(float(values.mean()) * float(np.percentile(values, 90)))
        )
    reference_strength = (
        float(np.median(island_strengths)) if island_strengths else 1.0
    )
    grown_islands = []
    strength_factors = []
    for cells, strength in zip(retained_cell_sets, island_strengths):
        strength_factor = float(np.clip(
            strength / max(reference_strength, 1e-9),
            MIN_ISLAND_STRENGTH_FACTOR,
            MAX_ISLAND_STRENGTH_FACTOR,
        ))
        strength_factors.append(round(strength_factor, 4))
        island = np.zeros_like(evidence, dtype=bool)
        frontier = set(cells)
        for y, x in cells:
            island[y, x] = True
        for distance in range(1, ISLAND_GROWTH_MAX_CELLS + 1):
            candidates = set()
            for y, x in frontier:
                for offset_y in (-1, 0, 1):
                    for offset_x in (-1, 0, 1):
                        neighbor_y = y + offset_y
                        neighbor_x = x + offset_x
                        if (
                            0 <= neighbor_y < evidence.shape[0]
                            and 0 <= neighbor_x < evidence.shape[1]
                            and not island[neighbor_y, neighbor_x]
                        ):
                            candidates.add((neighbor_y, neighbor_x))
            required_evidence = (
                ISLAND_GROWTH_BASE_EVIDENCE
                + ISLAND_GROWTH_DISTANCE_PENALTY * (distance - 1)
            ) / strength_factor
            frontier = {
                (y, x)
                for y, x in candidates
                if evidence[y, x] >= required_evidence
            }
            for y, x in frontier:
                island[y, x] = True
        grown_islands.append(island)
    if not grown_islands:
        return np.zeros_like(evidence, dtype=bool), strength_factors
    return np.logical_or.reduce(grown_islands), strength_factors


def pixel_mask(cells: np.ndarray) -> np.ndarray:
    return np.repeat(np.repeat(cells, CELL_SIZE, axis=0), CELL_SIZE, axis=1)


def crop_box(mask: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(mask)
    if not len(xs):
        raise RuntimeError("Whole-canvas comparison selected no changed cells")
    return int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)


def lossless_webp(image: Image.Image, destination: Path) -> None:
    image.save(destination, "WEBP", lossless=True, method=6, exact=True)


def psnr(left: np.ndarray, right: np.ndarray) -> float:
    error = np.mean(
        (left.astype(np.float64) - right.astype(np.float64)) ** 2
    )
    return math.inf if error == 0 else 20 * math.log10(255 / math.sqrt(error))


def comparison_sheet(
    base: np.ndarray,
    variant: np.ndarray,
    reconstructed: np.ndarray,
    mask: np.ndarray,
    destination: Path,
) -> None:
    kept = variant.copy()
    tint = np.array([255, 46, 180], dtype=np.uint8)
    kept[mask] = (
        kept[mask].astype(np.uint16) * 2 + tint.astype(np.uint16)
    ).astype(np.uint16) // 3
    kept = kept.astype(np.uint8)

    discarded = np.abs(
        variant.astype(np.int16) - reconstructed.astype(np.int16)
    )
    discarded = np.minimum(discarded * 5, 255).astype(np.uint8)
    panels = [
        ("resized base", base),
        ("generated PNG", variant),
        ("base + patch", reconstructed),
        ("kept cells", kept),
        ("discarded diff ×5", discarded),
    ]
    panel_width = 300
    panel_height = round(base.shape[0] * panel_width / base.shape[1])
    label_height = 28
    sheet = Image.new(
        "RGB",
        (panel_width * len(panels), panel_height + label_height),
        "#08110f",
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    for index, (label, pixels) in enumerate(panels):
        image = Image.fromarray(pixels).resize(
            (panel_width, panel_height),
            Image.Resampling.LANCZOS,
        )
        left = index * panel_width
        sheet.paste(image, (left, label_height))
        draw.text((left + 8, 7), label, fill="#effff6", font=font)
    sheet.save(destination, "WEBP", quality=92, method=6)


def process_case(world: str, scene: str, variant_id: str) -> dict[str, Any]:
    base_path = f"assets/worlds/{world}/scenes/{scene}/compact/base.png"
    variant_path = (
        f"assets/worlds/{world}/scenes/{scene}/variants/{variant_id}.png"
    )
    runtime_webp = ROOT / variant_path.replace(".png", ".webp")
    original_base = Image.open(
        io.BytesIO(git_blob(BASE_REF, base_path))
    ).convert("RGB")
    variant_blob = git_blob(VARIANT_REF, variant_path)
    generated = Image.open(io.BytesIO(variant_blob)).convert("RGB")
    base = original_base.resize(generated.size, Image.Resampling.LANCZOS)
    base_pixels = np.asarray(base)
    generated_pixels = np.asarray(generated)

    differences = delta_e(base_pixels, generated_pixels)
    scores = cell_scores(differences)
    baseline_median = float(np.median(scores))
    baseline_mad = float(np.median(np.abs(scores - baseline_median)))
    baseline_threshold = max(
        otsu_threshold(scores),
        baseline_median
        + BASELINE_ROBUST_SIGMAS * 1.4826 * baseline_mad,
    )
    baseline_cells = dilate(scores > baseline_threshold, NEIGHBOR_CELLS)
    baseline_mask = pixel_mask(baseline_cells)
    baseline_box = crop_box(baseline_mask)
    (
        core_cells,
        evidence,
        threshold,
        retained_components,
        retained_cell_sets,
        rejected_component_cells,
    ) = spatially_coherent_cells(scores)
    grown_islands, island_strength_factors = grow_change_islands(
        retained_cell_sets,
        evidence,
    )
    for component, strength_factor in zip(
        retained_components,
        island_strength_factors,
    ):
        component["islandStrengthFactor"] = strength_factor
    kept_cells = dilate(grown_islands, NEIGHBOR_CELLS)
    mask = pixel_mask(kept_cells)
    box = crop_box(mask)

    filtered_reference = np.where(
        mask[..., None],
        generated_pixels,
        base_pixels,
    ).astype(np.uint8)
    patch_canvas = np.zeros((*generated_pixels.shape[:2], 4), dtype=np.uint8)
    patch_canvas[mask, :3] = generated_pixels[mask]
    patch_canvas[mask, 3] = 255
    left, top, right, bottom = box
    patch = Image.fromarray(patch_canvas[top:bottom, left:right])

    case_directory = OUTPUT / scene / variant_id
    case_directory.mkdir(parents=True, exist_ok=True)
    baseline_left, baseline_top, baseline_right, baseline_bottom = baseline_box
    baseline_canvas = np.zeros((*generated_pixels.shape[:2], 4), dtype=np.uint8)
    baseline_canvas[baseline_mask, :3] = generated_pixels[baseline_mask]
    baseline_canvas[baseline_mask, 3] = 255
    baseline_cropped_transparent = (
        case_directory / "baseline-cropped-transparent.webp"
    )
    baseline_full_transparent = (
        case_directory / "baseline-full-canvas-transparent.webp"
    )
    baseline_cropped_opaque = case_directory / "baseline-cropped-opaque.webp"
    lossless_webp(
        Image.fromarray(
            baseline_canvas[
                baseline_top:baseline_bottom,
                baseline_left:baseline_right,
            ]
        ),
        baseline_cropped_transparent,
    )
    lossless_webp(
        Image.fromarray(baseline_canvas),
        baseline_full_transparent,
    )
    lossless_webp(
        generated.crop(baseline_box),
        baseline_cropped_opaque,
    )
    Image.fromarray((baseline_mask * 255).astype(np.uint8)).save(
        case_directory / "baseline-kept-cell-mask.png"
    )

    full_webp = case_directory / "full-lossless.webp"
    exact_patch_webp = case_directory / "exact-patch-lossless.webp"
    patch_webp = case_directory / "patch-lossless.webp"
    lossless_webp(generated, full_webp)
    lossless_webp(patch, patch_webp)

    exact_mask = np.any(base_pixels != generated_pixels, axis=2)
    exact_box = crop_box(exact_mask)
    exact_left, exact_top, exact_right, exact_bottom = exact_box
    exact_canvas = np.zeros((*generated_pixels.shape[:2], 4), dtype=np.uint8)
    exact_canvas[exact_mask, :3] = generated_pixels[exact_mask]
    exact_canvas[exact_mask, 3] = 255
    lossless_webp(
        Image.fromarray(
            exact_canvas[exact_top:exact_bottom, exact_left:exact_right]
        ),
        exact_patch_webp,
    )
    decoded_exact_patch = np.asarray(
        Image.open(exact_patch_webp).convert("RGBA")
    )
    decoded_exact_canvas = np.zeros_like(exact_canvas)
    decoded_exact_canvas[
        exact_top:exact_bottom,
        exact_left:exact_right,
    ] = decoded_exact_patch
    exact_reconstruction = np.where(
        decoded_exact_canvas[..., 3, None] == 255,
        decoded_exact_canvas[..., :3],
        base_pixels,
    ).astype(np.uint8)
    if not np.array_equal(exact_reconstruction, generated_pixels):
        mismatch = int(
            np.any(exact_reconstruction != generated_pixels, axis=2).sum()
        )
        raise RuntimeError(
            f"{scene}/{variant_id}: exact mode differs in {mismatch} pixels"
        )

    decoded_patch = np.asarray(Image.open(patch_webp).convert("RGBA"))
    decoded_canvas = np.zeros_like(patch_canvas)
    decoded_canvas[top:bottom, left:right] = decoded_patch
    reconstructed = np.where(
        decoded_canvas[..., 3, None] == 255,
        decoded_canvas[..., :3],
        base_pixels,
    ).astype(np.uint8)
    if not np.array_equal(reconstructed, filtered_reference):
        mismatch = int(np.any(reconstructed != filtered_reference, axis=2).sum())
        raise RuntimeError(
            f"{scene}/{variant_id}: reconstruction differs in {mismatch} pixels"
        )
    if not np.array_equal(
        np.asarray(Image.open(full_webp).convert("RGB")),
        generated_pixels,
    ):
        raise RuntimeError(f"{scene}/{variant_id}: lossless full WebP changed pixels")

    Image.fromarray(filtered_reference).save(case_directory / "reconstructed.png")
    Image.fromarray((mask * 255).astype(np.uint8)).save(
        case_directory / "kept-cell-mask.png"
    )
    comparison_sheet(
        base_pixels,
        generated_pixels,
        reconstructed,
        mask,
        case_directory / "comparison.webp",
    )

    reconstructed_difference = delta_e(reconstructed, generated_pixels)
    exact_generated_pixels = np.all(
        reconstructed == generated_pixels,
        axis=2,
    )
    result = {
        "scene": scene,
        "variant": variant_id,
        "canvas": list(generated.size),
        "cellGrid": [scores.shape[1], scores.shape[0]],
        "threshold": round(threshold, 4),
        "coreChangedCells": int(core_cells.sum()),
        "grownIslandCells": int(grown_islands.sum()),
        "retainedComponents": retained_components,
        "rejectedComponentCells": rejected_component_cells,
        "keptCellsAfterNeighborExpansion": int(kept_cells.sum()),
        "keptCellPercent": round(float(kept_cells.mean() * 100), 3),
        "patchBox": {
            "x": left,
            "y": top,
            "width": right - left,
            "height": bottom - top,
        },
        "opaquePatchPixels": int(mask.sum()),
        "opaqueCanvasPercent": round(float(mask.mean() * 100), 3),
        "exactMode": {
            "changedPixelPercent": round(float(exact_mask.mean() * 100), 3),
            "patchBox": {
                "x": exact_left,
                "y": exact_top,
                "width": exact_right - exact_left,
                "height": exact_bottom - exact_top,
            },
            "pixelExactToUnfilteredGenerated": True,
        },
        "originalAlgorithmTransparency": {
            "patchBox": {
                "x": baseline_left,
                "y": baseline_top,
                "width": baseline_right - baseline_left,
                "height": baseline_bottom - baseline_top,
            },
            "opaqueCanvasPercent": round(
                float(baseline_mask.mean() * 100),
                3,
            ),
            "croppedTransparentWebpBytes": (
                baseline_cropped_transparent.stat().st_size
            ),
            "fullCanvasTransparentWebpBytes": (
                baseline_full_transparent.stat().st_size
            ),
            "croppedOpaqueWebpBytes": baseline_cropped_opaque.stat().st_size,
            "transparencySavingWithinCropPercent": round(
                (
                    1
                    - baseline_cropped_transparent.stat().st_size
                    / baseline_cropped_opaque.stat().st_size
                ) * 100,
                2,
            ),
            "croppingSavingBeyondTransparencyPercent": round(
                (
                    1
                    - baseline_cropped_transparent.stat().st_size
                    / baseline_full_transparent.stat().st_size
                ) * 100,
                2,
            ),
        },
        "pixelExactToFilteredReference": True,
        "pixelsExactToUnfilteredGeneratedPercent": round(
            float(exact_generated_pixels.mean() * 100),
            3,
        ),
        "baseToGeneratedMeanDeltaE": round(float(differences.mean()), 4),
        "reconstructedToGeneratedMeanDeltaE": round(
            float(reconstructed_difference.mean()),
            4,
        ),
        "reconstructedToGeneratedPsnrDb": round(
            psnr(reconstructed, generated_pixels),
            3,
        ),
        "files": {
            "approvedPngBytes": len(variant_blob),
            "currentFullQuality95WebpBytes": runtime_webp.stat().st_size,
            "fullLosslessWebpBytes": full_webp.stat().st_size,
            "exactPatchLosslessWebpBytes": exact_patch_webp.stat().st_size,
            "patchLosslessWebpBytes": patch_webp.stat().st_size,
        },
    }
    result["files"]["savingVsCurrentFullQuality95WebpPercent"] = round(
        (1 - patch_webp.stat().st_size / runtime_webp.stat().st_size) * 100,
        2,
    )
    result["files"]["savingVsFullLosslessWebpPercent"] = round(
        (1 - patch_webp.stat().st_size / full_webp.stat().st_size) * 100,
        2,
    )
    result["files"]["exactPatchSavingVsFullLosslessWebpPercent"] = round(
        (
            1
            - exact_patch_webp.stat().st_size
            / full_webp.stat().st_size
        ) * 100,
        2,
    )
    (case_directory / "metrics.json").write_text(
        json.dumps(result, indent=2) + "\n"
    )
    return result


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    results = [process_case(*case) for case in CASES]
    summary = {
        "algorithm": {
            "authoredBoundsUsed": False,
            "cellSize": CELL_SIZE,
            "score": f"mean CIE76 delta-E clipped at {DELTA_E_CLIP}",
            "threshold": (
                "Otsu over perceptual evidence multiplied by nearby "
                "linearly distance-weighted evidence"
            ),
            "spatialRadiusCells": SPATIAL_RADIUS_CELLS,
            "isolatedEvidenceFloor": ISOLATED_EVIDENCE_FLOOR,
            "minimumComponentEnergyRatio": MIN_COMPONENT_ENERGY_RATIO,
            "islandGrowthMaxCells": ISLAND_GROWTH_MAX_CELLS,
            "islandGrowthBaseEvidence": ISLAND_GROWTH_BASE_EVIDENCE,
            "islandGrowthDistancePenalty": ISLAND_GROWTH_DISTANCE_PENALTY,
            "neighborExpansionCells": NEIGHBOR_CELLS,
        },
        "cases": results,
    }
    (OUTPUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    for result in results:
        files = result["files"]
        box = result["patchBox"]
        print(
            f'{result["scene"]}/{result["variant"]}: '
            f'{result["keptCellPercent"]:.2f}% cells, '
            f'{box["width"]}x{box["height"]} crop, '
            f'{files["patchLosslessWebpBytes"] / 1024:.1f} KiB patch, '
            f'{files["savingVsCurrentFullQuality95WebpPercent"]:.1f}% smaller '
            "than current full WebP"
        )
    print(f"Wrote {OUTPUT.relative_to(ROOT)}/summary.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
