#!/usr/bin/env python3
"""Rebuild the small board thumbnails the course map lists units with.

The map shows every unit at once. Decoding seventeen full boards to paint
64-pixel strips would cost a phone hundreds of megabytes, so each unit's scene
ships ``thumb.webp`` beside its profile folders, downscaled from the tracked
compact base. ``sceneThumbnailPath`` in ``src/world/presentation-data.js``
derives the same path, and the media policy precaches it.

By default this checks that every thumbnail would come out byte for byte the
same; ``--write`` replaces any that differ or are missing.
"""

from __future__ import annotations

import argparse
import io
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
PRESENTATION = ROOT / "content" / "presentation.json"
WIDTH = 320
QUALITY = 80
COMPACT_SUFFIX = "/compact/base.webp"


def planned_files() -> list[tuple[Path, Path]]:
    presentation = json.loads(PRESENTATION.read_text())
    plan = {}
    for unit in presentation["units"].values():
        base = unit["scenes"][unit["sceneId"]]["profiles"]["compact"]["base"]
        if not base.endswith(COMPACT_SUFFIX):
            raise SystemExit(f"{unit['id']}: compact base {base} does not follow the scene folder layout")
        target = ROOT / (base[: -len(COMPACT_SUFFIX)] + "/thumb.webp")
        plan[target] = ROOT / base
    return sorted(plan.items())


def encode(source: Path) -> bytes:
    with Image.open(source) as image:
        image = image.convert("RGB")
        height = round(image.height * WIDTH / image.width)
        thumbnail = image.resize((WIDTH, height), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    thumbnail.save(buffer, "WEBP", quality=QUALITY, method=6)
    return buffer.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--write", action="store_true", help="replace thumbnails that differ or are missing")
    args = parser.parse_args()
    stale = []
    for target, source in planned_files():
        data = encode(source)
        if target.exists() and target.read_bytes() == data:
            continue
        stale.append(target)
        if args.write:
            target.write_bytes(data)
    for target in stale:
        print(f"{'wrote' if args.write else 'stale'} {target.relative_to(ROOT)}")
    return 0 if args.write or not stale else 1


if __name__ == "__main__":
    raise SystemExit(main())
