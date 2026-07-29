#!/usr/bin/env python3
"""Promote approved WP-04 scene bases and complete-board variants for runtime."""
from __future__ import annotations
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CONFIGS = ROOT / "artifacts/world-generation/wp04-variant-inventories"
ART = ROOT / "artifacts/world-generation"
PRESENTATION = ROOT / "content/presentation.json"

def copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

def webp(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.save(destination, "WEBP", quality=92, method=6)

def main() -> int:
    presentation = json.loads(PRESENTATION.read_text())
    for config_path in sorted(CONFIGS.glob("*.json")):
        config = json.loads(config_path.read_text())
        unit, scene, world = config["unitId"], config["sceneId"], config["compactBase"].split("/")[2]
        root = ROOT / f"assets/worlds/{world}/scenes/{scene}"
        for profile in ("tall", "wide"):
            webp(ART / f"unit-scenes/{unit}/{profile}-source.png", root / profile / "base.webp")
        source_manifest = json.loads((ART / f"unit-scenes/{unit}/manifest.json").read_text())
        chosen = source_manifest["approval"]["candidateId"]
        candidate = next(item for item in source_manifest["candidates"] if item["id"] == chosen)
        webp(ART / f"unit-scenes/{unit}" / candidate["path"], root / "compact/base.webp")
        variant_root = root / "variants"
        approved = []
        for round_number in (3, 4):
            manifest_path = ART / f"patch-reviews/{scene}/round-{round_number:02d}/approval-manifest.json"
            if not manifest_path.is_file():
                continue
            for candidate in json.loads(manifest_path.read_text())["candidates"]:
                output = candidate.get("output")
                if candidate.get("approvalState") == "approved" and output and (ROOT / output["path"]).is_file():
                    copy(ROOT / output["path"], variant_root / f"{candidate['id']}.png")
                    approved.append(candidate["id"])
        if len(set(approved)) != 50:
            raise RuntimeError(f"{scene}: expected 50 approved variants, found {len(set(approved))}")
        unit_data = presentation["units"][unit]
        unit_data["sceneId"] = scene
        unit_data["storyBackdrop"] = f"assets/worlds/{world}/scenes/{scene}/compact/base.webp"
        unit_data.get("completion", {})["storyBackdrop"] = unit_data["storyBackdrop"]
        unit_data["scenes"] = {
            scene: {
                "id": scene,
                "patchRegions": {"phase-a": {"x": 0.04, "y": 0.66, "width": 0.26, "height": 0.24}, "phase-b": {"x": 0.70, "y": 0.64, "width": 0.26, "height": 0.25}, "phase-c": {"x": 0.39, "y": 0.04, "width": 0.22, "height": 0.20}},
                "profiles": {profile: {"base": f"assets/worlds/{world}/scenes/{scene}/{profile}/base.webp", "focalPosition": "50% 50%", "patches": {}} for profile in ("tall", "compact", "wide")},
                "remoteVariants": {"profiles": ["compact"], "assetRoot": f"assets/worlds/{world}/scenes/{scene}/variants", "format": "webp", "siteIds": [site["id"] for site in config["sites"]], "variantsPerSite": 5, "timing": {"initialDelayMs": 15000, "fadeMs": 2600, "holdMs": 7000, "gapMs": 15000}},
                "phasePatches": {phase: [] for phase in ("explain", "demonstrate", "isolate", "mix", "challenge", "summary")},
                "landmarkPatches": {"dormant": None, "restored": None},
            }
        }
    PRESENTATION.write_text(json.dumps(presentation, indent=2) + "\n")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
