#!/usr/bin/env python3
"""Convert all approved complete-board variants to transparent scene patches.

The detector is intentionally whole-canvas and consumes no authored target
bounds. Its linear-distance/change-island stage finds a coarse region of
interest. Pixel-level delta-E hysteresis then finds the actual changed object,
and a short inward alpha feather prevents hard lighting seams. The original
1200x896 canvas is retained so runtime registration needs no crop offsets.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
from scipy import ndimage

from prove_full_canvas_patch_extraction import (
    NEIGHBOR_CELLS,
    cell_scores,
    delta_e,
    dilate,
    grow_change_islands,
    pixel_mask,
    spatially_coherent_cells,
)


ROOT = Path(__file__).resolve().parents[2]
PRESENTATION = ROOT / "content/presentation.json"
SUMMARY = ROOT / "scripts/world-art/production-scene-patch-summary.json"
EXPECTED_VARIANTS = 700
FEATHER_PIXELS = 4
LOW_DELTA_E_MINIMUM = 2.3
HIGH_DELTA_E_MINIMUM = 8.0
WEBP_QUALITY = 95
REFINEMENT_ROI_MARGIN_PIXELS = 96
PATCH_TIMING = {
    "initialDelayMs": 2500,
    "fadeMs": 1200,
    "holdMs": 6500,
    "gapMs": 4000,
}


def refined_alpha(
    differences: np.ndarray,
    coarse_mask: np.ndarray,
) -> tuple[np.ndarray, dict[str, float]]:
    outside = differences[~coarse_mask]
    low_threshold = max(
        LOW_DELTA_E_MINIMUM,
        float(np.percentile(outside, 75)),
    )
    high_threshold = max(
        HIGH_DELTA_E_MINIMUM,
        float(np.percentile(outside, 95)),
    )
    refinement_roi = (
        ndimage.distance_transform_edt(~coarse_mask)
        <= REFINEMENT_ROI_MARGIN_PIXELS
    )
    weak = refinement_roi & (differences >= low_threshold)
    strong = coarse_mask & (differences >= high_threshold)
    connected = ndimage.binary_propagation(
        strong,
        structure=np.ones((3, 3), dtype=bool),
        mask=weak,
    )
    connected = ndimage.binary_closing(
        connected,
        structure=np.ones((3, 3), dtype=bool),
        iterations=2,
    )
    connected = ndimage.binary_fill_holes(connected)
    connected = ndimage.binary_dilation(
        connected,
        structure=np.ones((3, 3), dtype=bool),
        iterations=2,
        mask=refinement_roi,
    )
    distance = ndimage.distance_transform_edt(connected)
    alpha = np.rint(
        np.clip(distance / FEATHER_PIXELS, 0, 1) * 255
    ).astype(np.uint8)
    if not np.any(alpha):
        raise RuntimeError("refined patch has no visible pixels")
    return alpha, {
        "lowDeltaE": round(low_threshold, 4),
        "highDeltaE": round(high_threshold, 4),
        "refinementRoiCanvasPercent": round(
            float(refinement_roi.mean() * 100),
            4,
        ),
        "presentCanvasPercent": round(float((alpha > 0).mean() * 100), 4),
        "fullyOpaqueCanvasPercent": round(
            float((alpha == 255).mean() * 100),
            4,
        ),
        "strongSignalRetainedPercent": round(
            float((alpha[strong] > 0).mean() * 100),
            3,
        ),
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def scene_base(scene_id: str) -> Path:
    inputs = (
        ROOT / "artifacts/world-generation/patch-reviews"
        / scene_id / "round-03" / "inputs"
    )
    matches = sorted(inputs.glob("*-compact-base.png"))
    if len(matches) != 1:
        raise RuntimeError(
            f"{scene_id}: expected one compact generation base, found {len(matches)}"
        )
    return matches[0]


def approved_source(scene_id: str, filename: str) -> Path:
    review_root = (
        ROOT / "artifacts/world-generation/patch-reviews" / scene_id
    )
    matches = [
        review_root / "round-03" / "generated" / filename,
        review_root / "round-04" / "generated" / filename,
    ]
    existing = [path for path in matches if path.is_file()]
    if len(existing) != 1:
        raise RuntimeError(
            f"{scene_id}/{filename}: expected one approved source, found {len(existing)}"
        )
    return existing[0]


def extract_patch(
    base: Image.Image,
    source: Path,
    destination: Path,
    complete_board_destination: Path,
) -> dict[str, Any]:
    with Image.open(source) as image:
        generated = image.convert("RGB")
    resized_base = base.resize(generated.size, Image.Resampling.LANCZOS)
    base_pixels = np.asarray(resized_base)
    generated_pixels = np.asarray(generated)
    differences = delta_e(base_pixels, generated_pixels)
    scores = cell_scores(differences)
    (
        core_cells,
        evidence,
        threshold,
        retained_components,
        retained_cell_sets,
        rejected_component_cells,
    ) = spatially_coherent_cells(scores)
    grown_islands, _ = grow_change_islands(retained_cell_sets, evidence)
    kept_cells = dilate(grown_islands, NEIGHBOR_CELLS)
    coarse_mask = pixel_mask(kept_cells)
    alpha, refinement = refined_alpha(differences, coarse_mask)
    patch_pixels = np.zeros((*generated_pixels.shape[:2], 4), dtype=np.uint8)
    patch_pixels[alpha > 0, :3] = generated_pixels[alpha > 0]
    patch_pixels[..., 3] = alpha

    temporary = destination.with_suffix(".tmp.webp")
    Image.fromarray(patch_pixels).save(
        temporary,
        "WEBP",
        quality=WEBP_QUALITY,
        method=6,
        exact=True,
    )
    with Image.open(temporary) as decoded_image:
        decoded = np.asarray(decoded_image.convert("RGBA"))
    if not np.array_equal(decoded[..., 3], alpha):
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"{source}: WebP alpha reconstruction mismatch")
    temporary.replace(destination)
    complete_board_destination.parent.mkdir(parents=True, exist_ok=True)
    complete_temporary = complete_board_destination.with_suffix(".tmp.webp")
    generated.save(
        complete_temporary,
        "WEBP",
        quality=WEBP_QUALITY,
        method=6,
    )
    with Image.open(complete_temporary) as decoded_complete:
        if decoded_complete.size != generated.size:
            complete_temporary.unlink(missing_ok=True)
            raise RuntimeError(f"{source}: complete-board WebP size mismatch")
    complete_temporary.replace(complete_board_destination)
    return {
        "asset": str(destination.relative_to(ROOT)),
        "source": str(source.relative_to(ROOT)),
        "sourceSha256": sha256(source),
        "patchSha256": sha256(destination),
        "bytes": destination.stat().st_size,
        "completeBoardAsset": str(
            complete_board_destination.relative_to(ROOT)
        ),
        "completeBoardSha256": sha256(complete_board_destination),
        "completeBoardBytes": complete_board_destination.stat().st_size,
        # Kept for compatibility with the first production report.
        "opaqueCanvasPercent": refinement["presentCanvasPercent"],
        **refinement,
        "coarseRoiCanvasPercent": round(
            float(coarse_mask.mean() * 100),
            4,
        ),
        "coreCells": int(core_cells.sum()),
        "grownIslandCells": int(grown_islands.sum()),
        "keptCells": int(kept_cells.sum()),
        "retainedComponents": len(retained_components),
        "rejectedComponentCells": rejected_component_cells,
        "threshold": round(threshold, 4),
    }


def main() -> int:
    presentation = json.loads(PRESENTATION.read_text())
    records = []
    scenes = []
    before_bytes = 0
    for unit in presentation["units"].values():
        scene_id = unit.get("sceneId")
        scene = unit.get("scenes", {}).get(scene_id)
        config = scene.get("remoteVariants") if scene else None
        if not config:
            continue
        configured_roots = config.get("assetRoots", {})
        patch_root = configured_roots.get(
            "transparent-patch",
            config.get("assetRoot"),
        )
        if not patch_root:
            raise RuntimeError(f"{scene_id}: missing transparent patch root")
        complete_board_root = configured_roots.get(
            "complete-board",
            str(Path(patch_root).with_name("variants-full")),
        )
        base_path = scene_base(scene_id)
        with Image.open(base_path) as image:
            base = image.convert("RGB")
        scene_records = []
        for site_id in config["siteIds"]:
            for index in range(1, config["variantsPerSite"] + 1):
                filename = f"{site_id}-c{index:02d}.png"
                source = approved_source(scene_id, filename)
                destination = (
                    ROOT / patch_root
                    / filename.replace(".png", ".webp")
                )
                complete_board_destination = (
                    ROOT / complete_board_root
                    / filename.replace(".png", ".webp")
                )
                before_bytes += destination.stat().st_size
                record = extract_patch(
                    base,
                    source,
                    destination,
                    complete_board_destination,
                )
                records.append(record)
                scene_records.append(record)
        config.pop("assetRoot", None)
        config.pop("mode", None)
        config["profiles"] = ["tall", "compact", "wide"]
        config["registrationProfile"] = "compact"
        config["assetRoots"] = {
            "transparent-patch": patch_root,
            "complete-board": complete_board_root,
        }
        config["timing"] = PATCH_TIMING
        scene_bytes = sum(record["bytes"] for record in scene_records)
        complete_scene_bytes = sum(
            record["completeBoardBytes"] for record in scene_records
        )
        scenes.append({
            "sceneId": scene_id,
            "count": len(scene_records),
            "bytes": scene_bytes,
            "completeBoardBytes": complete_scene_bytes,
            "averageOpaqueCanvasPercent": round(
                sum(record["opaqueCanvasPercent"] for record in scene_records)
                / len(scene_records),
                4,
            ),
            "largestPatch": max(
                scene_records,
                key=lambda record: record["bytes"],
            )["asset"],
        })
        print(
            f"{scene_id}: {len(scene_records)} patches, "
            f"{scene_bytes / 1024 / 1024:.2f} MiB patches, "
            f"{complete_scene_bytes / 1024 / 1024:.2f} MiB complete",
            flush=True,
        )

    if len(records) != EXPECTED_VARIANTS:
        raise RuntimeError(
            f"Expected {EXPECTED_VARIANTS} approved variants, converted {len(records)}"
        )
    PRESENTATION.write_text(json.dumps(presentation, indent=2) + "\n")
    after_bytes = sum(record["bytes"] for record in records)
    complete_board_bytes = sum(
        record["completeBoardBytes"] for record in records
    )
    summary = {
        "schemaVersion": 2,
        "algorithm": (
            "whole-canvas-linear-distance-islands-pixel-hysteresis-feather"
        ),
        "canvas": [1200, 896],
        "transparent": True,
        "cropped": False,
        "encoding": {
            "format": "WebP",
            "rgb": "lossy",
            "quality": WEBP_QUALITY,
            "alpha": "lossless",
            "method": 6,
        },
        "refinement": {
            "coarseCellMaskUsedOnlyAsRoi": True,
            "connectedGrowthMarginPixels": REFINEMENT_ROI_MARGIN_PIXELS,
            "strongSeedsRestrictedToCoarseRoi": True,
            "lowThreshold": "outside-mask p75 delta-E, minimum 2.3",
            "highThreshold": "outside-mask p95 delta-E, minimum 8.0",
            "connectivity": "8-neighbor hysteresis",
            "closingPixels": 2,
            "dilationPixels": 2,
            "inwardLinearFeatherPixels": FEATHER_PIXELS,
        },
        "count": len(records),
        "previousPatchBytes": before_bytes,
        "beforeBytes": before_bytes,
        "afterBytes": after_bytes,
        "transparentPatchBytes": after_bytes,
        "completeBoardBytes": complete_board_bytes,
        "combinedBytes": after_bytes + complete_board_bytes,
        "savingPercent": round(
            (1 - after_bytes / complete_board_bytes) * 100,
            2,
        ),
        "scenes": scenes,
        "assets": records,
    }
    SUMMARY.write_text(json.dumps(summary, indent=2) + "\n")
    print(
        f"Converted {len(records)} complete boards into patches: previous "
        f"{before_bytes / 1024 / 1024:.2f} MiB -> "
        f"{after_bytes / 1024 / 1024:.2f} MiB; "
        f"complete-board fallback {complete_board_bytes / 1024 / 1024:.2f} MiB "
        f"({summary['savingPercent']:.2f}% patch saving)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
