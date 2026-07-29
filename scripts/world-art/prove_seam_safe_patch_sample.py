#!/usr/bin/env python3
"""Render a deterministic random sample of refined scene patches for review."""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from audit_production_scene_patch_seams import center_cover, runtime_compact_bases
from extract_production_scene_patches import scene_base
from prove_seam_safe_patch_refinement import composite, refined_patch, scene_id


ROOT = Path(__file__).resolve().parents[2]
SUMMARY = ROOT / "scripts/world-art/production-scene-patch-summary.json"
OUTPUT = ROOT / "artifacts/world-generation/seam-safe-patch-random-sample"
SEED = 20260729
SAMPLE_SIZE = 20
WEBP_QUALITY = 95


def contact_sheet(
    samples: list[tuple[str, np.ndarray]],
    destination: Path,
) -> None:
    columns = 4
    tile_width = 360
    tile_height = 269
    label_height = 42
    rows = (len(samples) + columns - 1) // columns
    sheet = Image.new(
        "RGB",
        (columns * tile_width, rows * (tile_height + label_height)),
        "#07110f",
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=13)
    for index, (label, pixels) in enumerate(samples):
        column = index % columns
        row = index // columns
        left = column * tile_width
        top = row * (tile_height + label_height)
        image = Image.fromarray(pixels).resize(
            (tile_width, tile_height),
            Image.Resampling.LANCZOS,
        )
        sheet.paste(image, (left, top + label_height))
        draw.text(
            (left + 8, top + 7),
            label,
            fill="#effff6",
            font=font,
        )
    sheet.save(destination, "WEBP", quality=92, method=6)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--indices",
        type=int,
        nargs="+",
        help="Render only these one-based indices from the fixed random sample.",
    )
    args = parser.parse_args()
    summary = json.loads(SUMMARY.read_text())
    complete_sample = random.Random(SEED).sample(
        summary["assets"],
        SAMPLE_SIZE,
    )
    indexed_sample = list(enumerate(complete_sample, start=1))
    output = OUTPUT
    if args.indices:
        requested = set(args.indices)
        if not requested <= set(range(1, SAMPLE_SIZE + 1)):
            raise ValueError(f"indices must be between 1 and {SAMPLE_SIZE}")
        indexed_sample = [
            item for item in indexed_sample if item[0] in requested
        ]
        suffix = "-".join(f"{index:02d}" for index in sorted(requested))
        output = OUTPUT / f"focused-{suffix}"
    bases = runtime_compact_bases()
    output.mkdir(parents=True, exist_ok=True)
    rendered_samples: list[tuple[str, np.ndarray]] = []
    manifest = []
    for index, record in indexed_sample:
        scene = scene_id(record)
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
        with Image.open(record["asset"]) as image:
            current_patch = np.asarray(image.convert("RGBA"))
        proposed, details = refined_patch(
            generation_base,
            generated,
            current_patch[..., 3] > 0,
        )
        filename = f"{index:02d}-{scene}-{Path(record['asset']).stem}"
        patch_path = output / f"{filename}-patch-q{WEBP_QUALITY}.webp"
        Image.fromarray(proposed).save(
            patch_path,
            "WEBP",
            quality=WEBP_QUALITY,
            method=6,
            exact=True,
        )
        with Image.open(patch_path) as image:
            decoded_patch = np.asarray(image.convert("RGBA"))
        with Image.open(bases[scene]) as image:
            runtime_base = np.asarray(
                center_cover(image.convert("RGB"), generated_image.size)
            )
        rendered = composite(runtime_base, decoded_patch)
        rendered_path = output / f"{filename}-composite.webp"
        Image.fromarray(rendered).save(
            rendered_path,
            "WEBP",
            quality=95,
            method=6,
        )
        label = f"{index:02d} {scene} / {Path(record['asset']).stem}"
        rendered_samples.append((label, rendered))
        manifest.append({
            "index": index,
            "sceneId": scene,
            "source": record["source"],
            "currentPatch": record["asset"],
            "newPatch": str(patch_path.relative_to(ROOT)),
            "composite": str(rendered_path.relative_to(ROOT)),
            "newPatchBytes": patch_path.stat().st_size,
            **details,
        })
        print(f"{index:02d} {scene}/{Path(record['asset']).name}")
    contact_sheet(rendered_samples, output / "contact-sheet.webp")
    (output / "manifest.json").write_text(
        json.dumps(
            {
                "seed": SEED,
                "sampleSize": len(indexed_sample),
                "indices": [index for index, _ in indexed_sample],
                "selection": "uniform random sample without replacement",
                "patchWebpQuality": WEBP_QUALITY,
                "samples": manifest,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Wrote {output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
