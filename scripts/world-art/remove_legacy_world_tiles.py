#!/usr/bin/env python3
"""Remove superseded tiled-board metadata and static backdrop/prop files."""
from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PRESENTATION = ROOT / "content/presentation.json"


def main() -> int:
    presentation = json.loads(PRESENTATION.read_text())
    for world in presentation["worlds"].values():
        world.pop("backdrops", None)
        world.pop("props", None)
    PRESENTATION.write_text(json.dumps(presentation, indent=2) + "\n")

    removed = []
    for source in sorted((ROOT / "assets/worlds").glob("*/backdrop-*.webp")):
        source.unlink()
        removed.append(source.relative_to(ROOT))
    for source in sorted((ROOT / "assets/worlds").glob("*/props/*.webp")):
        source.unlink()
        removed.append(source.relative_to(ROOT))
    world_kit = ROOT / "assets/world-kit.png"
    if world_kit.is_file():
        world_kit.unlink()
        removed.append(world_kit.relative_to(ROOT))
    print(f"Removed {len(removed)} legacy board image(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
