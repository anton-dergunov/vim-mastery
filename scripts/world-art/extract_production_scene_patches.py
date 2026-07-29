#!/usr/bin/env python3
"""Convert all approved complete-board variants to transparent scene patches.

The detector is intentionally whole-canvas and consumes no authored target
bounds. It reuses the reviewed linear-distance/change-island algorithm from
``prove_full_canvas_patch_extraction.py`` and retains the original 1200x896
canvas so runtime registration needs no per-asset crop offsets.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

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
PATCH_TIMING = {
    "initialDelayMs": 2500,
    "fadeMs": 1200,
    "holdMs": 6500,
    "gapMs": 4000,
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
) -> dict[str, Any]:
    with Image.open(source) as image:
        generated = image.convert("RGB")
    resized_base = base.resize(generated.size, Image.Resampling.LANCZOS)
    base_pixels = np.asarray(resized_base)
    generated_pixels = np.asarray(generated)
    scores = cell_scores(delta_e(base_pixels, generated_pixels))
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
    mask = pixel_mask(kept_cells)
    patch_pixels = np.zeros((*generated_pixels.shape[:2], 4), dtype=np.uint8)
    patch_pixels[mask, :3] = generated_pixels[mask]
    patch_pixels[mask, 3] = 255

    temporary = destination.with_suffix(".tmp.webp")
    Image.fromarray(patch_pixels).save(
        temporary,
        "WEBP",
        lossless=True,
        method=6,
        exact=True,
    )
    with Image.open(temporary) as decoded_image:
        decoded = np.asarray(decoded_image.convert("RGBA"))
    reconstructed = np.where(
        decoded[..., 3, None] == 255,
        decoded[..., :3],
        base_pixels,
    ).astype(np.uint8)
    filtered_reference = np.where(
        mask[..., None],
        generated_pixels,
        base_pixels,
    ).astype(np.uint8)
    if not np.array_equal(reconstructed, filtered_reference):
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"{source}: lossless patch reconstruction mismatch")
    temporary.replace(destination)
    return {
        "asset": str(destination.relative_to(ROOT)),
        "source": str(source.relative_to(ROOT)),
        "sourceSha256": sha256(source),
        "patchSha256": sha256(destination),
        "bytes": destination.stat().st_size,
        "opaqueCanvasPercent": round(float(mask.mean() * 100), 4),
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
        base_path = scene_base(scene_id)
        with Image.open(base_path) as image:
            base = image.convert("RGB")
        scene_records = []
        for site_id in config["siteIds"]:
            for index in range(1, config["variantsPerSite"] + 1):
                filename = f"{site_id}-c{index:02d}.png"
                source = approved_source(scene_id, filename)
                destination = (
                    ROOT / config["assetRoot"]
                    / filename.replace(".png", ".webp")
                )
                before_bytes += destination.stat().st_size
                record = extract_patch(base, source, destination)
                records.append(record)
                scene_records.append(record)
        config["mode"] = "transparent-patch"
        config["timing"] = PATCH_TIMING
        scene_bytes = sum(record["bytes"] for record in scene_records)
        scenes.append({
            "sceneId": scene_id,
            "count": len(scene_records),
            "bytes": scene_bytes,
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
            f"{scene_bytes / 1024 / 1024:.2f} MiB",
            flush=True,
        )

    if len(records) != EXPECTED_VARIANTS:
        raise RuntimeError(
            f"Expected {EXPECTED_VARIANTS} approved variants, converted {len(records)}"
        )
    PRESENTATION.write_text(json.dumps(presentation, indent=2) + "\n")
    after_bytes = sum(record["bytes"] for record in records)
    summary = {
        "schemaVersion": 1,
        "algorithm": "whole-canvas-linear-distance-change-islands",
        "canvas": [1200, 896],
        "transparent": True,
        "cropped": False,
        "count": len(records),
        "beforeBytes": before_bytes,
        "afterBytes": after_bytes,
        "savingPercent": round((1 - after_bytes / before_bytes) * 100, 2),
        "scenes": scenes,
        "assets": records,
    }
    SUMMARY.write_text(json.dumps(summary, indent=2) + "\n")
    print(
        f"Converted {len(records)} complete boards into patches: "
        f"{before_bytes / 1024 / 1024:.2f} MiB -> "
        f"{after_bytes / 1024 / 1024:.2f} MiB "
        f"({summary['savingPercent']:.2f}% smaller)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
