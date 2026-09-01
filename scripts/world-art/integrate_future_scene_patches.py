#!/usr/bin/env python3
"""Promote five approved future boards as transparent runtime scene patches.

This deliberately reuses the final production extraction algorithm introduced
in commit 7411392: whole-canvas 16px evidence cells, linearly weighted spatial
support, coherent change islands, pixel-level delta-E hysteresis, and a short
inward alpha feather. Generated images remain review/provenance artifacts;
runtime variants contain only the detected visual change on a transparent,
registration-preserving canvas.
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
    rgb_to_lab,
    spatially_coherent_cells,
)


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_ROOT = ROOT / "artifacts/world-generation"
SUMMARY = ROOT / "scripts/world-art/future-scene-patch-summary.json"
EXPECTED_SCENES = 5
EXPECTED_VARIANTS_PER_SCENE = 50
EXPECTED_VARIANTS = EXPECTED_SCENES * EXPECTED_VARIANTS_PER_SCENE

# These are intentionally identical to the final production extractor.
FEATHER_PIXELS = 4
LOW_DELTA_E_MINIMUM = 2.3
HIGH_DELTA_E_MINIMUM = 8.0
WEBP_QUALITY = 95
REFINEMENT_ROI_MARGIN_PIXELS = 96
JUST_NOTICEABLE_DELTA_E = 2.3
CLEARLY_VISIBLE_DELTA_E = 5.0
CONTINUING_CHANGE_RATIO = 0.5
MAX_VISIBLE_CONTINUED_CHANGE_PERCENT = 5.0
ALGORITHM = "whole-canvas-linear-distance-islands-pixel-hysteresis-feather"

SCENES = (
    {
        "unitId": "viewport-control",
        "worldId": "archive-of-echoes",
        "sceneId": "beacon-glass-gallery",
    },
    {
        "unitId": "real-code-workflow-capstones",
        "worldId": "brass-meridian",
        "sceneId": "menders-confluence",
    },
    {
        "unitId": "mastery-loops",
        "worldId": "brass-meridian",
        "sceneId": "keepers-relay",
    },
    {
        "unitId": "mosslight-landing",
        "worldId": "moonroot-ruins",
        "sceneId": "mosslight-landing",
    },
    {
        "unitId": "open-trail-overlook",
        "worldId": "brass-meridian",
        "sceneId": "open-trail-overlook",
    },
)

# Only these owner-requested replacements differ from their original round.
SOURCE_ROUND_OVERRIDES = {
    ("keepers-relay", "central-distributor-c03"): "round-03",
    ("mosslight-landing", "water-drop-ripple-c01"): "round-02",
    ("mosslight-landing", "water-drop-ripple-c02"): "round-02",
    ("mosslight-landing", "water-drop-ripple-c03"): "round-03",
    ("mosslight-landing", "water-drop-ripple-c04"): "round-02",
    ("mosslight-landing", "water-drop-ripple-c05"): "round-02",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def refined_alpha(
    differences: np.ndarray,
    coarse_mask: np.ndarray,
) -> tuple[np.ndarray, dict[str, float]]:
    """Exact pixel refinement from the final production patch extractor."""
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


def board_sources(config: dict[str, str]) -> tuple[dict[str, Any], dict[str, Path]]:
    artifact = ARTIFACT_ROOT / "unit-scenes" / config["unitId"]
    manifest = json.loads((artifact / "manifest.json").read_text())
    if manifest.get("sceneId") != config["sceneId"] or manifest.get("worldId") != config["worldId"]:
        raise RuntimeError(f"{config['sceneId']}: board manifest identity mismatch")
    approval = manifest.get("approval", {})
    candidate = next(
        (
            item
            for item in manifest.get("candidates", [])
            if item.get("id") == approval.get("candidateId")
        ),
        None,
    )
    if not candidate or candidate.get("approvalState") != "approved":
        raise RuntimeError(f"{config['sceneId']}: board is not explicitly approved")
    sources = {"compact": artifact / candidate["path"]}
    for profile in ("tall", "wide"):
        derivative = manifest.get("derivatives", {}).get(profile)
        if not derivative:
            raise RuntimeError(f"{config['sceneId']}: missing {profile} derivative")
        source = artifact / derivative["path"]
        if not source.is_file() or sha256(source) != derivative.get("sha256"):
            raise RuntimeError(f"{config['sceneId']}: changed or missing {profile} derivative")
        sources[profile] = source
    if not sources["compact"].is_file() or sha256(sources["compact"]) != candidate.get("sha256"):
        raise RuntimeError(f"{config['sceneId']}: changed or missing approved compact board")
    return manifest, sources


def final_variant_sources(scene_id: str) -> tuple[list[Path], list[str]]:
    review = ARTIFACT_ROOT / "patch-reviews" / scene_id
    original_manifest = json.loads(
        (review / "round-01" / "approval-manifest.json").read_text()
    )
    candidate_ids = [candidate["id"] for candidate in original_manifest["candidates"]]
    if len(candidate_ids) != EXPECTED_VARIANTS_PER_SCENE or len(set(candidate_ids)) != len(candidate_ids):
        raise RuntimeError(f"{scene_id}: expected 50 unique original candidate IDs")
    sources = []
    for candidate_id in candidate_ids:
        source_round = SOURCE_ROUND_OVERRIDES.get((scene_id, candidate_id), "round-01")
        source = review / source_round / "generated" / f"{candidate_id}.png"
        if not source.is_file():
            raise RuntimeError(f"{scene_id}/{candidate_id}: approved source is missing")
        sources.append(source)
    return sources, candidate_ids


def write_base_assets(
    config: dict[str, str],
    manifest: dict[str, Any],
    sources: dict[str, Path],
) -> Path:
    scene_root = ROOT / "assets/worlds" / config["worldId"] / "scenes" / config["sceneId"]
    for profile, source in sources.items():
        destination = scene_root / profile / "base.webp"
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(".tmp.webp")
        with Image.open(source) as image:
            image.convert("RGB").save(temporary, "WEBP", quality=92, method=6)
        temporary.replace(destination)
    compact = scene_root / "compact" / "base.webp"
    metadata = {
        "schemaVersion": 2,
        "unitId": config["unitId"],
        "sceneId": config["sceneId"],
        "worldId": config["worldId"],
        "source": "base.webp",
        "sha256": sha256(compact),
        "model": manifest["model"],
        "approval": manifest["approval"],
        "derivatives": manifest["derivatives"],
        "variantMode": "transparent-patch",
        "variantAlgorithm": ALGORITHM,
    }
    (scene_root / "compact" / "source.json").write_text(
        json.dumps(metadata, indent=2) + "\n"
    )
    return scene_root


def extract_patch(
    base: Image.Image,
    source: Path,
    destination: Path,
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

    destination.parent.mkdir(parents=True, exist_ok=True)
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
    return {
        "asset": str(destination.relative_to(ROOT)),
        "source": str(source.relative_to(ROOT)),
        "sourceSha256": sha256(source),
        "patchSha256": sha256(destination),
        "bytes": destination.stat().st_size,
        "opaqueCanvasPercent": refinement["presentCanvasPercent"],
        **refinement,
        "coarseRoiCanvasPercent": round(float(coarse_mask.mean() * 100), 4),
        "coreCells": int(core_cells.sum()),
        "grownIslandCells": int(grown_islands.sum()),
        "keptCells": int(kept_cells.sum()),
        "retainedComponents": len(retained_components),
        "rejectedComponentCells": rejected_component_cells,
        "threshold": round(threshold, 4),
    }


def center_cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_width, target_height = size
    scale = max(target_width / image.width, target_height / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - target_width) // 2
    top = (resized.height - target_height) // 2
    return resized.crop((left, top, left + target_width, top + target_height))


def inner_alpha_boundary(alpha: np.ndarray) -> np.ndarray:
    present = alpha > 0
    padded = np.pad(present, 1, constant_values=False)
    eroded = np.logical_and.reduce([
        padded[y:y + present.shape[0], x:x + present.shape[1]]
        for y in range(3)
        for x in range(3)
    ])
    return present & ~eroded


def delta_e_for_pixels(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    if not len(left):
        return np.array([], dtype=np.float64)
    left_lab = rgb_to_lab(left.reshape(1, -1, 3))[0]
    right_lab = rgb_to_lab(right.reshape(1, -1, 3))[0]
    return np.linalg.norm(left_lab - right_lab, axis=1)


def continued_change_metrics(
    generation_base: np.ndarray,
    generated: np.ndarray,
    runtime_base: np.ndarray,
    composite: np.ndarray,
    alpha: np.ndarray,
) -> dict[str, float]:
    """Exact visible-cut test from the final production seam auditor."""
    present = alpha > 0
    source_inside = []
    source_outside = []
    rendered_inside = []
    for offset_y in (-1, 0, 1):
        for offset_x in (-1, 0, 1):
            if offset_x == 0 and offset_y == 0:
                continue
            inside_y = slice(max(0, -offset_y), min(present.shape[0], present.shape[0] - offset_y))
            inside_x = slice(max(0, -offset_x), min(present.shape[1], present.shape[1] - offset_x))
            outside_y = slice(max(0, offset_y), min(present.shape[0], present.shape[0] + offset_y))
            outside_x = slice(max(0, offset_x), min(present.shape[1], present.shape[1] + offset_x))
            crossing = present[inside_y, inside_x] & ~present[outside_y, outside_x]
            if not crossing.any():
                continue
            source_inside.append(delta_e_for_pixels(
                generation_base[inside_y, inside_x][crossing],
                generated[inside_y, inside_x][crossing],
            ))
            source_outside.append(delta_e_for_pixels(
                generation_base[outside_y, outside_x][crossing],
                generated[outside_y, outside_x][crossing],
            ))
            rendered_inside.append(delta_e_for_pixels(
                runtime_base[inside_y, inside_x][crossing],
                composite[inside_y, inside_x][crossing],
            ))
    source_inside_values = np.concatenate(source_inside)
    source_outside_values = np.concatenate(source_outside)
    rendered_inside_values = np.concatenate(rendered_inside)
    continuation_ratio = source_outside_values / np.maximum(source_inside_values, 1e-9)
    arbitrary_visible_cut = (
        (rendered_inside_values >= CLEARLY_VISIBLE_DELTA_E)
        & (source_outside_values >= JUST_NOTICEABLE_DELTA_E)
        & (continuation_ratio >= CONTINUING_CHANGE_RATIO)
    )
    return {
        "boundaryPairCount": int(len(rendered_inside_values)),
        "visibleContinuedChangePairPercent": round(float(arbitrary_visible_cut.mean() * 100), 3),
        "visibleContinuedChangePairCount": int(arbitrary_visible_cut.sum()),
        "continuationRatioP90": round(float(np.percentile(continuation_ratio, 90)), 4),
    }


def audit_patch(
    record: dict[str, Any],
    source: Path,
    generation_base_image: Image.Image,
    runtime_base_path: Path,
) -> dict[str, Any]:
    patch_path = ROOT / record["asset"]
    with Image.open(patch_path) as image:
        patch = np.asarray(image.convert("RGBA"))
    with Image.open(runtime_base_path) as image:
        runtime_base = np.asarray(center_cover(image.convert("RGB"), (patch.shape[1], patch.shape[0])))
    with Image.open(source) as image:
        generated_image = image.convert("RGB")
        generated = np.asarray(generated_image)
    generation_base = np.asarray(
        generation_base_image.resize(generated_image.size, Image.Resampling.LANCZOS)
    )
    alpha = patch[..., 3]
    alpha_fraction = alpha.astype(np.float64) / 255
    composite = np.rint(
        patch[..., :3] * alpha_fraction[..., None]
        + runtime_base * (1 - alpha_fraction[..., None])
    ).astype(np.uint8)
    boundary = inner_alpha_boundary(alpha)
    differences = delta_e_for_pixels(runtime_base[boundary], composite[boundary])
    boundary_alpha = alpha[boundary]
    if not len(differences):
        raise RuntimeError(f"{record['asset']}: patch has no alpha boundary")
    return {
        "boundaryPixelCount": int(boundary.sum()),
        "boundaryMeanDeltaE": round(float(differences.mean()), 4),
        "boundaryMedianDeltaE": round(float(np.median(differences)), 4),
        "boundaryP90DeltaE": round(float(np.percentile(differences, 90)), 4),
        "boundaryP95DeltaE": round(float(np.percentile(differences, 95)), 4),
        "boundaryP99DeltaE": round(float(np.percentile(differences, 99)), 4),
        "boundaryMaxDeltaE": round(float(differences.max()), 4),
        "boundaryAboveJndPercent": round(float((differences >= JUST_NOTICEABLE_DELTA_E).mean() * 100), 3),
        "boundaryClearlyVisiblePercent": round(float((differences >= CLEARLY_VISIBLE_DELTA_E).mean() * 100), 3),
        "hardAlphaBoundaryPercent": round(float((boundary_alpha == 255).mean() * 100), 3),
        **continued_change_metrics(
            generation_base,
            generated,
            runtime_base,
            composite,
            alpha,
        ),
    }


def main() -> int:
    records = []
    scene_summaries = []
    for config in SCENES:
        scene_id = config["sceneId"]
        manifest, sources = board_sources(config)
        scene_root = write_base_assets(config, manifest, sources)
        variant_sources, candidate_ids = final_variant_sources(scene_id)
        generation_base_path = (
            ARTIFACT_ROOT / "patch-reviews" / scene_id / "round-01"
            / "inputs" / f"{scene_id}-compact-base.png"
        )
        if not generation_base_path.is_file():
            raise RuntimeError(f"{scene_id}: generation base is missing")
        with Image.open(generation_base_path) as image:
            generation_base = image.convert("RGB")
        scene_records = []
        for index, (candidate_id, source) in enumerate(zip(candidate_ids, variant_sources), 1):
            destination = scene_root / "variants" / f"{candidate_id}.webp"
            record = extract_patch(generation_base, source, destination)
            record.update({
                "unitId": config["unitId"],
                "worldId": config["worldId"],
                "sceneId": scene_id,
                "candidateId": candidate_id,
                "sourceRound": source.parts[-3],
                "ownerApproval": "approved in conversation on 2026-09-01",
            })
            record["seamAudit"] = audit_patch(
                record,
                source,
                generation_base,
                scene_root / "compact" / "base.webp",
            )
            scene_records.append(record)
            records.append(record)
            if index % 10 == 0:
                print(f"{scene_id}: extracted and audited {index}/50", flush=True)
        seamed = [
            item for item in scene_records
            if item["seamAudit"]["visibleContinuedChangePairPercent"]
            > MAX_VISIBLE_CONTINUED_CHANGE_PERCENT
        ]
        scene_summaries.append({
            "unitId": config["unitId"],
            "worldId": config["worldId"],
            "sceneId": scene_id,
            "count": len(scene_records),
            "bytes": sum(item["bytes"] for item in scene_records),
            "siteIds": list(dict.fromkeys(candidate.rsplit("-c", 1)[0] for candidate in candidate_ids)),
            "replacementSources": [
                item["source"] for item in scene_records if item["sourceRound"] != "round-01"
            ],
            "visiblySeamedCount": len(seamed),
            "averagePresentCanvasPercent": round(
                sum(item["presentCanvasPercent"] for item in scene_records) / len(scene_records),
                4,
            ),
        })

    if len(records) != EXPECTED_VARIANTS:
        raise RuntimeError(f"Expected {EXPECTED_VARIANTS} patches, wrote {len(records)}")
    visibly_seamed = [
        item for item in records
        if item["seamAudit"]["visibleContinuedChangePairPercent"]
        > MAX_VISIBLE_CONTINUED_CHANGE_PERCENT
    ]
    summary = {
        "schemaVersion": 1,
        "algorithm": ALGORITHM,
        "algorithmSourceCommit": "7411392",
        "canvas": [1200, 896],
        "transparent": True,
        "cropped": False,
        "storesCompleteBoards": False,
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
        "approval": {
            "state": "owner-approved",
            "approvedOn": "2026-09-01",
            "count": len(records),
        },
        "seamAudit": {
            "maximumVisibleContinuedChangePercent": MAX_VISIBLE_CONTINUED_CHANGE_PERCENT,
            "visiblySeamedCount": len(visibly_seamed),
        },
        "count": len(records),
        "bytes": sum(item["bytes"] for item in records),
        "scenes": scene_summaries,
        "assets": records,
    }
    SUMMARY.write_text(json.dumps(summary, indent=2) + "\n")
    print(
        f"Integrated {len(records)} transparent patches across {len(SCENES)} scenes; "
        f"{len(visibly_seamed)} exceeded the final seam threshold.",
        flush=True,
    )
    return 1 if visibly_seamed else 0


if __name__ == "__main__":
    raise SystemExit(main())
