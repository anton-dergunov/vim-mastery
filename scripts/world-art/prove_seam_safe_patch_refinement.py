#!/usr/bin/env python3
"""Refine five visibly seamed patches with pixel-level hysteresis and feathering.

The 16x16 change-island mask remains a coarse region of interest. Within that
region, strong per-pixel differences seed the real object and weaker connected
differences retain its edges. A short inward alpha ramp then makes the retained
generated pixels converge continuously on the unchanged runtime base.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from audit_production_scene_patch_seams import (
    center_cover,
    continued_change_metrics,
    delta_e_for_pixels,
    inner_alpha_boundary,
    runtime_compact_bases,
)
from extract_production_scene_patches import refined_alpha, scene_base
from prove_full_canvas_patch_extraction import delta_e


ROOT = Path(__file__).resolve().parents[2]
SUMMARY = ROOT / "scripts/world-art/production-scene-patch-summary.json"
OUTPUT = ROOT / "artifacts/world-generation/seam-safe-patch-proof"
FEATHER_PIXELS = 4
LOSSY_QUALITIES = (80, 85, 90, 95)
CASES = [
    "assets/worlds/moonroot-ruins/scenes/wayfinder-crossroads/variants/southeast-lantern-ledge-c01.webp",
    "assets/worlds/moonroot-ruins/scenes/mode-lantern-grounds/variants/far-right-water-niche-c02.webp",
    "assets/worlds/brass-meridian/scenes/meridian-engine/variants/lower-left-walkway-c02.webp",
    "assets/worlds/starwater-sanctuary/scenes/nested-garden/variants/lower-left-shore-c04.webp",
    "assets/worlds/starwater-sanctuary/scenes/starneedle-observatory/variants/right-water-bank-c01.webp",
]


def scene_id(record: dict[str, Any]) -> str:
    parts = Path(record["source"]).parts
    return parts[parts.index("patch-reviews") + 1]


def composite(base: np.ndarray, patch: np.ndarray) -> np.ndarray:
    alpha = patch[..., 3].astype(np.float64) / 255
    return np.rint(
        patch[..., :3] * alpha[..., None]
        + base * (1 - alpha[..., None])
    ).astype(np.uint8)


def seam_metrics(base: np.ndarray, patch: np.ndarray) -> dict[str, float]:
    alpha = patch[..., 3]
    boundary = inner_alpha_boundary(alpha)
    rendered = composite(base, patch)
    differences = delta_e_for_pixels(base[boundary], rendered[boundary])
    return {
        "boundaryMeanDeltaE": round(float(differences.mean()), 4),
        "boundaryP95DeltaE": round(float(np.percentile(differences, 95)), 4),
        "boundaryClearlyVisiblePercent": round(
            float((differences >= 5).mean() * 100),
            3,
        ),
    }


def full_seam_metrics(
    generation_base: np.ndarray,
    generated: np.ndarray,
    runtime_base: np.ndarray,
    patch: np.ndarray,
) -> dict[str, float]:
    rendered = composite(runtime_base, patch)
    return {
        **seam_metrics(runtime_base, patch),
        **continued_change_metrics(
            generation_base,
            generated,
            runtime_base,
            rendered,
            patch[..., 3],
        ),
    }


def lossy_metrics(
    base: np.ndarray,
    lossless_patch: np.ndarray,
    lossy_patch: np.ndarray,
) -> dict[str, float | int]:
    lossless_rendered = composite(base, lossless_patch)
    lossy_rendered = composite(base, lossy_patch)
    present = lossless_patch[..., 3] > 0
    differences = delta_e_for_pixels(
        lossless_rendered[present],
        lossy_rendered[present],
    )
    return {
        "alphaMismatchPixels": int(
            np.count_nonzero(
                lossless_patch[..., 3] != lossy_patch[..., 3]
            )
        ),
        "renderedMeanDeltaE": round(float(differences.mean()), 4),
        "renderedP95DeltaE": round(
            float(np.percentile(differences, 95)),
            4,
        ),
        "renderedClearlyVisiblePercent": round(
            float((differences >= 5).mean() * 100),
            4,
        ),
    }


def refined_patch(
    base: np.ndarray,
    generated: np.ndarray,
    coarse_mask: np.ndarray,
) -> tuple[np.ndarray, dict[str, float]]:
    differences = delta_e(base, generated)
    alpha, details = refined_alpha(differences, coarse_mask)
    patch = np.zeros((*generated.shape[:2], 4), dtype=np.uint8)
    patch[alpha > 0, :3] = generated[alpha > 0]
    patch[..., 3] = alpha
    return patch, {
        **details,
        "coarseOpaquePercent": round(float(coarse_mask.mean() * 100), 4),
        "refinedPresentPercent": round(float((alpha > 0).mean() * 100), 4),
        "refinedFullyOpaquePercent": round(
            float((alpha == 255).mean() * 100),
            4,
        ),
    }


def crop_for_review(mask: np.ndarray, margin: int = 48) -> tuple[int, int, int, int]:
    y, x = np.nonzero(mask)
    return (
        max(0, int(x.min()) - margin),
        max(0, int(y.min()) - margin),
        min(mask.shape[1], int(x.max()) + margin + 1),
        min(mask.shape[0], int(y.max()) + margin + 1),
    )


def review_sheet(
    base: np.ndarray,
    current: np.ndarray,
    proposed: np.ndarray,
    generated: np.ndarray,
    crop: tuple[int, int, int, int],
    destination: Path,
) -> None:
    left, top, right, bottom = crop
    panels = [
        ("runtime base", base),
        ("current hard-cell patch", composite(base, current)),
        ("proposed pixel mask", composite(base, proposed)),
        ("Nano Banana output", generated),
    ]
    width = 340
    crop_width = right - left
    crop_height = bottom - top
    height = round(crop_height * width / crop_width)
    label_height = 30
    sheet = Image.new("RGB", (width * len(panels), height + label_height), "#07110f")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    for index, (label, pixels) in enumerate(panels):
        image = Image.fromarray(pixels).crop(crop).resize(
            (width, height),
            Image.Resampling.NEAREST,
        )
        x = index * width
        sheet.paste(image, (x, label_height))
        draw.text((x + 8, 8), label, fill="#effff6", font=font)
    sheet.save(destination, "WEBP", quality=94, method=6)


def main() -> int:
    summary = json.loads(SUMMARY.read_text())
    records = {record["asset"]: record for record in summary["assets"]}
    bases = runtime_compact_bases()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    results = []
    for asset in CASES:
        record = records[asset]
        scene = scene_id(record)
        with Image.open(asset) as image:
            current = np.asarray(image.convert("RGBA"))
        with Image.open(record["source"]) as image:
            generated_image = image.convert("RGB")
            generated = np.asarray(generated_image)
        with Image.open(scene_base(scene)) as image:
            generation_base = np.asarray(
                image.convert("RGB").resize(
                    generated_image.size,
                    Image.Resampling.LANCZOS,
                )
            )
        with Image.open(bases[scene]) as image:
            runtime_base = np.asarray(
                center_cover(image.convert("RGB"), generated_image.size)
            )
        proposed, details = refined_patch(
            generation_base,
            generated,
            current[..., 3] > 0,
        )
        case_output = OUTPUT / scene / Path(asset).stem
        case_output.mkdir(parents=True, exist_ok=True)
        proposed_path = case_output / "proposed-patch.webp"
        Image.fromarray(proposed).save(
            proposed_path,
            "WEBP",
            lossless=True,
            method=6,
            exact=True,
        )
        with Image.open(proposed_path) as image:
            proposed = np.asarray(image.convert("RGBA"))
        lossy_candidates = []
        for quality in LOSSY_QUALITIES:
            lossy_path = case_output / f"proposed-patch-q{quality}.webp"
            Image.fromarray(proposed).save(
                lossy_path,
                "WEBP",
                quality=quality,
                method=6,
                exact=True,
            )
            with Image.open(lossy_path) as image:
                decoded_lossy = np.asarray(image.convert("RGBA"))
            lossy_candidates.append({
                "quality": quality,
                "bytes": lossy_path.stat().st_size,
                "savingVsLosslessPercent": round(
                    (1 - lossy_path.stat().st_size / proposed_path.stat().st_size)
                    * 100,
                    2,
                ),
                **lossy_metrics(runtime_base, proposed, decoded_lossy),
            })
        crop = crop_for_review(current[..., 3] > 0)
        review_sheet(
            runtime_base,
            current,
            proposed,
            generated,
            crop,
            case_output / "comparison.webp",
        )
        Image.fromarray(proposed[..., 3]).save(case_output / "proposed-alpha.png")
        result = {
            "asset": asset,
            **details,
            "currentBytes": (ROOT / asset).stat().st_size,
            "proposedBytes": proposed_path.stat().st_size,
            "lossyCandidates": lossy_candidates,
            "currentSeam": full_seam_metrics(
                generation_base,
                generated,
                runtime_base,
                current,
            ),
            "proposedSeam": full_seam_metrics(
                generation_base,
                generated,
                runtime_base,
                proposed,
            ),
            "comparison": str(
                (case_output / "comparison.webp").relative_to(ROOT)
            ),
        }
        results.append(result)
        print(
            f"{scene}/{Path(asset).name}: "
            f"{result['currentSeam']['visibleContinuedChangePairPercent']:.1f}% -> "
            f"{result['proposedSeam']['visibleContinuedChangePairPercent']:.1f}% "
            "arbitrary visible cuts"
        )
    (OUTPUT / "summary.json").write_text(
        json.dumps(
            {
                "algorithm": {
                    "coarseCellMaskUsedOnlyAsRoi": True,
                    "lowThreshold": "outside-mask p75 delta-E, minimum 2.3",
                    "highThreshold": "outside-mask p95 delta-E, minimum 8.0",
                    "connectivity": "8-neighbor hysteresis",
                    "closingPixels": 2,
                    "dilationPixels": 2,
                    "inwardLinearFeatherPixels": FEATHER_PIXELS,
                },
                "cases": results,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Wrote {OUTPUT.relative_to(ROOT)}/summary.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
