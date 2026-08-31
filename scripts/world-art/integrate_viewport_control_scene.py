#!/usr/bin/env python3
"""Promote the approved Beacon Glass Gallery profiles to Unit 10's runtime scene."""

from __future__ import annotations

import hashlib
import json
import argparse
from copy import deepcopy
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT = ROOT / "artifacts/world-generation/unit-scenes/viewport-control"
PRESENTATION = ROOT / "content/presentation.json"
SCENE_ROOT = ROOT / "assets/worlds/archive-of-echoes/scenes/beacon-glass-gallery"
SCENE_ID = "beacon-glass-gallery"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verified_sources() -> tuple[dict, dict[str, Path]]:
    manifest = json.loads((ARTIFACT / "manifest.json").read_text())
    approval = manifest.get("approval", {})
    candidates = {candidate["id"]: candidate for candidate in manifest.get("candidates", [])}
    approved = candidates.get(approval.get("candidateId"))
    if not approved or approved.get("approvalState") != "approved":
        raise RuntimeError("Viewport control needs an explicitly approved source")
    sources = {"compact": ARTIFACT / approved["path"]}
    for profile in ("tall", "wide"):
        derivative = manifest.get("derivatives", {}).get(profile)
        if not derivative:
            raise RuntimeError(f"Missing approved {profile} derivation")
        source = ARTIFACT / derivative["path"]
        if not source.is_file() or derivative.get("sha256") != sha256(source):
            raise RuntimeError(f"Viewport control {profile} derivation is missing or changed")
        sources[profile] = source
    if not sources["compact"].is_file() or approved.get("sha256") != sha256(sources["compact"]):
        raise RuntimeError("Viewport control compact source is missing or changed")
    return manifest, sources


def webp(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.convert("RGB").save(destination, "WEBP", quality=92, method=6)


def scene_definition() -> dict:
    root = "assets/worlds/archive-of-echoes/scenes/beacon-glass-gallery"
    return {
        "id": SCENE_ID,
        "patchRegions": {
            "phase-a": {"x": 0.04, "y": 0.66, "width": 0.26, "height": 0.24},
            "phase-b": {"x": 0.70, "y": 0.64, "width": 0.26, "height": 0.25},
            "phase-c": {"x": 0.39, "y": 0.04, "width": 0.22, "height": 0.20},
        },
        "profiles": {
            profile: {"base": f"{root}/{profile}/base.webp", "focalPosition": "50% 50%", "patches": {}}
            for profile in ("tall", "compact", "wide")
        },
        "phasePatches": {phase: [] for phase in ("explain", "demonstrate", "isolate", "mix", "challenge", "summary")},
        "landmarkPatches": {"dormant": None, "restored": None},
    }


def restore_borrowed_scene() -> None:
    """Keep Unit 10 valid until its own fifty complete-board variants exist."""
    presentation = json.loads(PRESENTATION.read_text())
    unit = presentation["units"]["viewport-control"]
    borrowed = deepcopy(presentation["units"]["position-memory"]["scenes"]["far-beacons"])
    backdrop = "assets/worlds/archive-of-echoes/scenes/far-beacons/compact/base.webp"
    unit["sceneId"] = "far-beacons"
    unit["scenes"] = {"far-beacons": borrowed}
    unit["storyBackdrop"] = backdrop
    unit["completion"]["storyBackdrop"] = backdrop
    PRESENTATION.write_text(json.dumps(presentation, indent=2, ensure_ascii=False) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--integrate", action="store_true", help="switch Unit 10 after its 50 variants are approved")
    parser.add_argument("--restore-borrowed-scene", action="store_true", help="restore the temporary Far Beacons binding")
    args = parser.parse_args()
    if args.integrate and args.restore_borrowed_scene:
        raise SystemExit("Choose either --integrate or --restore-borrowed-scene")
    if args.restore_borrowed_scene:
        restore_borrowed_scene()
        print("Restored viewport-control's temporary Far Beacons binding")
        return 0

    manifest, sources = verified_sources()
    for profile, source in sources.items():
        webp(source, SCENE_ROOT / profile / "base.webp")
    compact = SCENE_ROOT / "compact" / "base.webp"
    (SCENE_ROOT / "compact" / "source.json").write_text(json.dumps({
        "schemaVersion": 1,
        "unitId": manifest["unitId"],
        "sceneId": SCENE_ID,
        "worldId": manifest["worldId"],
        "source": "base.webp",
        "sha256": sha256(compact),
        "model": manifest["model"],
        "approval": manifest["approval"],
        "derivatives": manifest["derivatives"],
    }, indent=2) + "\n")

    if not args.integrate:
        print(f"Staged {SCENE_ID}; use --integrate after its 50 variants are approved")
        return 0

    presentation = json.loads(PRESENTATION.read_text())
    unit = presentation["units"]["viewport-control"]
    unit["sceneId"] = SCENE_ID
    unit["scenes"] = {SCENE_ID: scene_definition()}
    backdrop = "assets/worlds/archive-of-echoes/scenes/beacon-glass-gallery/compact/base.webp"
    unit["storyBackdrop"] = backdrop
    unit["completion"]["storyBackdrop"] = backdrop
    PRESENTATION.write_text(json.dumps(presentation, indent=2, ensure_ascii=False) + "\n")
    print(f"Integrated {SCENE_ID} for viewport-control")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
