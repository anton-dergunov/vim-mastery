#!/usr/bin/env python3
"""Convert approved runtime scene variants to quality-95 WebP atomically enough for review."""
from __future__ import annotations

import json
import sys
from argparse import ArgumentParser
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
PRESENTATION = ROOT / "content/presentation.json"


def webp_destination(source: Path) -> Path:
    return source.with_suffix(".webp")


def convert(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.save(destination, "WEBP", quality=95, method=6)
    with Image.open(destination) as result:
        result.verify()


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument(
        "--asset-root",
        action="append",
        default=[],
        help="Convert one registered asset root; repeat to process several roots.",
    )
    args = parser.parse_args()
    presentation = json.loads(PRESENTATION.read_text())
    all_variant_roots = []
    for unit in presentation["units"].values():
        scene_id = unit.get("sceneId")
        scene = unit.get("scenes", {}).get(scene_id, {})
        variants = scene.get("remoteVariants")
        if variants:
            all_variant_roots.append(ROOT / variants["assetRoot"])

    requested_roots = {ROOT / value for value in args.asset_root}
    unknown_roots = requested_roots - set(all_variant_roots)
    if unknown_roots:
        parser.error(f"unregistered variant root(s): {', '.join(str(root.relative_to(ROOT)) for root in sorted(unknown_roots))}")
    variant_roots = [root for root in all_variant_roots if not requested_roots or root in requested_roots]

    sources = sorted(source for root in variant_roots for source in root.glob("*.png"))
    if not sources:
        print("No runtime PNG variants found; nothing to convert.")
        return 0

    converted = 0
    for source in sources:
        destination = webp_destination(source)
        if not destination.is_file():
            convert(source, destination)
            converted += 1

    missing = [source for source in sources if not webp_destination(source).is_file()]
    if missing:
        print(f"Refusing to remove PNGs; {len(missing)} WebP output(s) are missing.", file=sys.stderr)
        return 1

    before = sum(source.stat().st_size for source in sources)
    for source in sources:
        source.unlink()

    remaining_pngs = [source for root in all_variant_roots for source in root.glob("*.png")]
    if not remaining_pngs:
        for unit in presentation["units"].values():
            scene_id = unit.get("sceneId")
            scene = unit.get("scenes", {}).get(scene_id, {})
            variants = scene.get("remoteVariants")
            if variants:
                variants["format"] = "webp"
        PRESENTATION.write_text(json.dumps(presentation, indent=2) + "\n")

    after = sum(webp_destination(source).stat().st_size for source in sources)
    print(f"Converted {converted} new WebP file(s); replaced {len(sources)} PNG variant(s): {before / 1024 / 1024:.2f} MiB -> {after / 1024 / 1024:.2f} MiB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
