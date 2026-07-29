#!/usr/bin/env python3
"""Measure visible color discontinuities at production patch boundaries.

The patch detector finds the changed object, but that alone does not prove that
the extracted pixels meet the unchanged base cleanly. This audit composites
each decoded patch over the runtime compact base and measures CIE76 delta-E on
the innermost alpha contour. A large delta at that contour is exactly the color
jump introduced when the patch appears, independent of the scene's natural
edges underneath it.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from extract_production_scene_patches import scene_base
from prove_full_canvas_patch_extraction import rgb_to_lab


ROOT = Path(__file__).resolve().parents[2]
PRESENTATION = ROOT / "content/presentation.json"
PATCH_SUMMARY = ROOT / "scripts/world-art/production-scene-patch-summary.json"
DEFAULT_REPORT = (
    ROOT / "scripts/world-art/production-scene-patch-seam-report.json"
)
JUST_NOTICEABLE_DELTA_E = 2.3
CLEARLY_VISIBLE_DELTA_E = 5.0
CONTINUING_CHANGE_RATIO = 0.5


def center_cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_width, target_height = size
    scale = max(target_width / image.width, target_height / image.height)
    resized = image.resize(
        (
            round(image.width * scale),
            round(image.height * scale),
        ),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - target_width) // 2
    top = (resized.height - target_height) // 2
    return resized.crop(
        (left, top, left + target_width, top + target_height)
    )


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
    """Find visible cuts through source changes that continue outside alpha."""
    present = alpha > 0
    source_inside = []
    source_outside = []
    rendered_inside = []
    for offset_y in (-1, 0, 1):
        for offset_x in (-1, 0, 1):
            if offset_x == 0 and offset_y == 0:
                continue
            inside_y = slice(
                max(0, -offset_y),
                min(present.shape[0], present.shape[0] - offset_y),
            )
            inside_x = slice(
                max(0, -offset_x),
                min(present.shape[1], present.shape[1] - offset_x),
            )
            outside_y = slice(
                max(0, offset_y),
                min(present.shape[0], present.shape[0] + offset_y),
            )
            outside_x = slice(
                max(0, offset_x),
                min(present.shape[1], present.shape[1] + offset_x),
            )
            crossing = (
                present[inside_y, inside_x]
                & ~present[outside_y, outside_x]
            )
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
    source_inside = np.concatenate(source_inside)
    source_outside = np.concatenate(source_outside)
    rendered_inside = np.concatenate(rendered_inside)
    continuation_ratio = source_outside / np.maximum(source_inside, 1e-9)
    arbitrary_visible_cut = (
        (rendered_inside >= CLEARLY_VISIBLE_DELTA_E)
        & (source_outside >= JUST_NOTICEABLE_DELTA_E)
        & (continuation_ratio >= CONTINUING_CHANGE_RATIO)
    )
    return {
        "boundaryPairCount": int(len(rendered_inside)),
        "visibleContinuedChangePairPercent": round(
            float(arbitrary_visible_cut.mean() * 100),
            3,
        ),
        "visibleContinuedChangePairCount": int(arbitrary_visible_cut.sum()),
        "continuationRatioP90": round(
            float(np.percentile(continuation_ratio, 90)),
            4,
        ),
    }


def runtime_compact_bases() -> dict[str, Path]:
    presentation = json.loads(PRESENTATION.read_text())
    bases = {}
    for unit in presentation["units"].values():
        scene = unit["scenes"][unit["sceneId"]]
        bases[scene["id"]] = ROOT / scene["profiles"]["compact"]["base"]
    return bases


def audit_patch(
    record: dict[str, Any],
    bases: dict[str, Path],
) -> dict[str, Any]:
    source_parts = Path(record["source"]).parts
    scene_id = source_parts[source_parts.index("patch-reviews") + 1]
    patch_path = ROOT / record["asset"]
    with Image.open(patch_path) as image:
        patch = np.asarray(image.convert("RGBA"))
    with Image.open(bases[scene_id]) as image:
        base_image = center_cover(
            image.convert("RGB"),
            (patch.shape[1], patch.shape[0]),
        )
    base = np.asarray(base_image)
    with Image.open(record["source"]) as image:
        generated_image = image.convert("RGB")
        generated = np.asarray(generated_image)
    with Image.open(scene_base(scene_id)) as image:
        generation_base = np.asarray(
            image.convert("RGB").resize(
                generated_image.size,
                Image.Resampling.LANCZOS,
            )
        )
    alpha = patch[..., 3]
    alpha_fraction = alpha.astype(np.float64) / 255
    composite = np.rint(
        patch[..., :3] * alpha_fraction[..., None]
        + base * (1 - alpha_fraction[..., None])
    ).astype(np.uint8)
    boundary = inner_alpha_boundary(alpha)
    differences = delta_e_for_pixels(base[boundary], composite[boundary])
    boundary_alpha = alpha[boundary]
    if not len(differences):
        raise RuntimeError(f"{record['asset']}: patch has no alpha boundary")
    return {
        "asset": record["asset"],
        "patchSha256": record["patchSha256"],
        "sceneId": scene_id,
        "opaqueCanvasPercent": record["opaqueCanvasPercent"],
        "boundaryPixelCount": int(boundary.sum()),
        "boundaryMeanDeltaE": round(float(differences.mean()), 4),
        "boundaryMedianDeltaE": round(float(np.median(differences)), 4),
        "boundaryP90DeltaE": round(float(np.percentile(differences, 90)), 4),
        "boundaryP95DeltaE": round(float(np.percentile(differences, 95)), 4),
        "boundaryP99DeltaE": round(float(np.percentile(differences, 99)), 4),
        "boundaryMaxDeltaE": round(float(differences.max()), 4),
        "boundaryAboveJndPercent": round(
            float((differences >= JUST_NOTICEABLE_DELTA_E).mean() * 100),
            3,
        ),
        "boundaryClearlyVisiblePercent": round(
            float((differences >= CLEARLY_VISIBLE_DELTA_E).mean() * 100),
            3,
        ),
        "hardAlphaBoundaryPercent": round(
            float((boundary_alpha == 255).mean() * 100),
            3,
        ),
        **continued_change_metrics(
            generation_base,
            generated,
            base,
            composite,
            alpha,
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_REPORT)
    parser.add_argument(
        "--fail-on-visible-seams",
        action="store_true",
        help="Fail when any patch exceeds the checked-in acceptance limits.",
    )
    args = parser.parse_args()
    summary = json.loads(PATCH_SUMMARY.read_text())
    bases = runtime_compact_bases()
    records = [audit_patch(record, bases) for record in summary["assets"]]
    records.sort(
        key=lambda record: (
            record["boundaryClearlyVisiblePercent"],
            record["boundaryP95DeltaE"],
        ),
        reverse=True,
    )
    visibly_seamed = [
        record
        for record in records
        if record["visibleContinuedChangePairPercent"] > 5
    ]
    report = {
        "schemaVersion": 1,
        "metric": (
            "CIE76 delta-E between the runtime base and the decoded "
            "base-plus-patch composite on the inner alpha contour"
        ),
        "justNoticeableDeltaE": JUST_NOTICEABLE_DELTA_E,
        "clearlyVisibleDeltaE": CLEARLY_VISIBLE_DELTA_E,
        "continuingChangeRatio": CONTINUING_CHANGE_RATIO,
        "count": len(records),
        "visiblySeamedCount": len(visibly_seamed),
        "visiblySeamedPercent": round(
            len(visibly_seamed) / len(records) * 100,
            2,
        ),
        "assets": records,
    }
    output = args.output
    if not output.is_absolute():
        output = ROOT / output
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(
        f"Audited {len(records)} patches: "
        f"{len(visibly_seamed)} ({report['visiblySeamedPercent']:.2f}%) "
        "have a clearly visible alpha-boundary seam."
    )
    for record in records[:10]:
        print(
            f"{record['asset']}: "
            f"{record['visibleContinuedChangePairPercent']:.1f}% arbitrary "
            f"visible cuts, p95 boundary {record['boundaryP95DeltaE']:.1f} ΔE"
        )
    return 1 if args.fail_on_visible_seams and visibly_seamed else 0


if __name__ == "__main__":
    raise SystemExit(main())
