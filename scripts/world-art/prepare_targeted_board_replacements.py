#!/usr/bin/env python3
"""Stage the owner-rejected Session 23 board edits in clean replacement rounds."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RUNNER = ROOT / "scripts/world-art/review_wayfinder_patches.py"
CONFIG_ROOT = ROOT / "artifacts/world-generation/future-board-media-runs"

REPLACEMENTS = {
    "keepers-relay": {
        "central-distributor-c03": (
            "The prior result was an unrelated scene. Replace only the small brass distributor bridge inside the named locator: show one sealed cyan-glass courier capsule halfway into that exact grounded three-way brass junction. Keep the three fixed outlet conduits visible, but show exactly one capsule, entirely inside the locator area. Do not invent a room, building, waterway, different camera, or any additional scene beyond this local rail detail."
        ),
    },
    "mosslight-landing": {
        "water-drop-ripple-c01": (
            "Replace only the named shallow foreground water patch with a compact cluster of three turquoise mineral crystals visibly rooted in the stream bed beneath the surface. Keep the nearby lily pads, bridge, banks, reflections, and water boundary fixed; this must read as a new submerged object, not a ripple."
        ),
        "water-drop-ripple-c02": (
            "Replace only the named shallow foreground water patch with one broad pale-violet water-lily bloom held by a small visible pad and submerged roots. Keep the nearby lily pads, bridge, banks, reflections, and water boundary fixed; this must read as a new supported aquatic plant, not a ripple."
        ),
        "water-drop-ripple-c03": (
            "Replace only the named shallow foreground water patch with a small moss-covered stone marker fully anchored on the stream bed, its smooth top breaking the surface and carrying a tiny cyan glow. Keep the nearby lily pads, bridge, banks, reflections, and water boundary fixed; no isolated droplet rings."
        ),
        "water-drop-ripple-c04": (
            "Replace only the named shallow foreground water patch with a clear miniature school of four tiny cyan spirit-fish-like light forms swimming in one tight contained arc beneath the surface. Keep the nearby lily pads, bridge, banks, reflections, and water boundary fixed; show no droplet or circular ripple as the primary change."
        ),
        "water-drop-ripple-c05": (
            "Replace only the named shallow foreground water patch with a single tiny floating leaf boat carrying an unlit blank glass flask, naturally supported by the water and leaving one short wake. Keep the nearby lily pads, bridge, banks, reflections, and water boundary fixed; this must be a new local object, not a ripple."
        ),
    },
}

KEEPER_R3 = {
    "central-distributor-c03": (
        "The prior replacement read as a capsule and must not be repeated. Replace only the small brass distributor bridge inside the named locator with a squat, clearly mechanical three-way brass signal valve bolted to the existing rail: a broad hexagonal central body, three short fixed conduit mouths, one small square teal-glass inspection window, and a low amber indicator. It must remain entirely within the locator, grounded on the existing junction, and read as a compact valve manifold—not a capsule, tube, bottle, rocket, animal, or object from another scene. Do not alter the room, water, bridge, rails, cliffs, camera, or any other board detail."
    ),
}

MOSS_R3 = {
    "water-drop-ripple-c03": (
        "The prior replacement looked like a tomb and must not be repeated. Replace only the named shallow foreground water patch with one small non-humanoid luminous turquoise water salamander gliding just beneath the surface between the existing lily pads. Give it a soft curved tail, subtle cyan reflection, and a clearly local underwater silhouette. Keep the bridge, banks, lily pads, reflections, water boundary, and all other board geometry fixed. No tomb, monument, grave marker, shrine, humanoid figure, or large creature."
    ),
}


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n")


def replacement_prompt(existing: str, change: str) -> str:
    before, remainder = existing.split("\nPRIMARY EDIT\n", 1)
    _, after = remainder.split("\n\nPRESERVATION IS THE MAIN REQUIREMENT", 1)
    return f"{before}\nPRIMARY EDIT\n{change}\n\nPRESERVATION IS THE MAIN REQUIREMENT{after}"


def archive_source_round(scene: str, candidates: dict[str, str], source_round: int) -> None:
    root = ROOT / "artifacts/world-generation/patch-reviews" / scene / f"round-{source_round:02d}"
    manifest_path = root / "approval-manifest.json"
    manifest = json.loads(manifest_path.read_text())
    lookup = {candidate["id"]: candidate for candidate in manifest["candidates"]}
    for candidate_id in candidates:
        candidate = lookup[candidate_id]
        output_record = candidate.get("output")
        if not output_record:
            continue
        output = ROOT / output_record["path"]
        review = ROOT / candidate["boxedReview"]["path"]
        archive = root / "rejected-by-owner"
        archive.mkdir(exist_ok=True)
        if output.is_file():
            shutil.move(output, archive / output.name)
        if review.is_file():
            shutil.move(review, archive / review.name)
        candidate["regenerationReason"] = "owner-rejected: unrelated scene or insufficiently varied water treatment"
        candidate["approvalState"] = "replacement-staged"
    manifest["updatedAt"] = datetime.now(UTC).isoformat()
    write_json(manifest_path, manifest)


def stage(
    scene: str,
    candidates: dict[str, str],
    source_round: int,
    replacement_round: int,
) -> None:
    archive_source_round(scene, candidates, source_round)
    config = CONFIG_ROOT / scene / "scene-config.json"
    subprocess.run(
        [
            sys.executable, str(RUNNER), "--scene-config", str(config),
            "--round", str(replacement_round), "stage-replacements",
            "--from-round", str(source_round),
        ],
        cwd=ROOT,
        check=True,
    )
    path = ROOT / "artifacts/world-generation/patch-reviews" / scene / f"round-{replacement_round:02d}/approval-manifest.json"
    manifest = json.loads(path.read_text())
    for candidate in manifest["candidates"]:
        change = candidates[candidate["id"]]
        candidate["transformation"] = change
        candidate["prompt"] = replacement_prompt(candidate["prompt"], change)
        candidate["regenerationReason"] = "owner-requested targeted replacement"
    manifest["workPackage"] = f"S23-{scene}-R{replacement_round}"
    manifest["updatedAt"] = datetime.now(UTC).isoformat()
    write_json(path, manifest)


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--keeper-r3", action="store_true")
    parser.add_argument("--round3", action="store_true")
    args = parser.parse_args()
    if args.keeper_r3:
        stage("keepers-relay", KEEPER_R3, 2, 3)
        print("Staged 1 replacement for keepers-relay round 03")
        return 0
    if args.round3:
        stage("keepers-relay", KEEPER_R3, 2, 3)
        stage("mosslight-landing", MOSS_R3, 2, 3)
        print("Staged 2 targeted replacements in round 03")
        return 0
    for scene, candidates in REPLACEMENTS.items():
        stage(scene, candidates, 1, 2)
        print(f"Staged {len(candidates)} replacement(s) for {scene}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
