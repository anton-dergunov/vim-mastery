#!/usr/bin/env python3
"""Rebuild the board WebPs that no other script produces, from their kept sources.

Two kinds of shipped file are plain re-encodes of an approved PNG under the
ignored ``artifacts/world-generation/`` tree:

* the base boards of the ten WP-04 scenes (quality 92), from each unit's
  approved candidate and its tall and wide sources in ``unit-scenes/``;
* the full-board variants of those scenes and of the four Moonroot scenes
  (quality 95), from the generated edit of the same name in ``patch-reviews/``.

The other boards have their own builders: ``prepare_registered_moonroot_scenes.py``
for the Moonroot bases, and ``integrate_board_edit_patches.py`` for the five
later boards, whose variants are transparent patches.

By default this checks that every file would come out byte for byte the same;
``--write`` replaces any that differ.
"""

from __future__ import annotations

import argparse
import io
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "artifacts" / "world-generation"
PRESENTATION = ROOT / "content" / "presentation.json"
PATCH_SUMMARY = ROOT / "scripts" / "world-art" / "board-edit-patch-summary.json"
BASE_QUALITY = 92
VARIANT_QUALITY = 95


def encode(source: Path, quality: int) -> bytes:
    buffer = io.BytesIO()
    with Image.open(source) as image:
        image.save(buffer, "WEBP", quality=quality, method=6)
    return buffer.getvalue()


def planned_files() -> list[tuple[Path, Path, int]]:
    presentation = json.loads(PRESENTATION.read_text())
    patched = {scene["sceneId"] for scene in json.loads(PATCH_SUMMARY.read_text())["scenes"]}
    manifests = {}
    for path in (ART / "unit-scenes").glob("*/manifest.json"):
        manifest = json.loads(path.read_text())
        # Keyed by scene: Unit 9's source folder still carries its pre-split id.
        manifests[manifest["sceneId"]] = (path.parent, manifest)
    plan = []
    for unit in presentation["units"].values():
        scene_id = unit["sceneId"]
        if scene_id in patched:
            continue
        scene = unit["scenes"][scene_id]
        if unit["worldId"] != "moonroot-ruins":
            directory, manifest = manifests[scene_id]
            approved = next(item for item in manifest["candidates"] if item["id"] == manifest["approval"]["candidateId"])
            sources = {"compact": directory / approved["path"], "tall": directory / "tall-source.png", "wide": directory / "wide-source.png"}
            for profile, source in sources.items():
                plan.append((source, ROOT / scene["profiles"][profile]["base"], BASE_QUALITY))
        variants = ROOT / scene["remoteVariants"]["assetRoot"]
        for runtime in sorted(variants.glob("*.webp")):
            matches = list((ART / "patch-reviews" / scene_id).glob(f"*/generated/{runtime.stem}.png"))
            if len(matches) != 1:
                raise RuntimeError(f"{runtime.relative_to(ROOT)}: expected one generated source, found {len(matches)}")
            plan.append((matches[0], runtime, VARIANT_QUALITY))
    return plan


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--write", action="store_true", help="replace shipped files that differ")
    args = parser.parse_args()
    plan = planned_files()
    differing = []
    for source, runtime, quality in plan:
        if not source.is_file():
            raise RuntimeError(f"missing source {source.relative_to(ROOT)} for {runtime.relative_to(ROOT)}")
        encoded = encode(source, quality)
        if runtime.is_file() and runtime.read_bytes() == encoded:
            continue
        differing.append(runtime)
        if args.write:
            runtime.parent.mkdir(parents=True, exist_ok=True)
            runtime.write_bytes(encoded)
    outcome = "rewritten" if args.write else "differ from their source"
    print(f"Checked {len(plan)} board WebPs; {len(differing)} {outcome}.")
    for runtime in differing[:20]:
        print(f"  {runtime.relative_to(ROOT)}")
    return 1 if differing and not args.write else 0


if __name__ == "__main__":
    raise SystemExit(main())
