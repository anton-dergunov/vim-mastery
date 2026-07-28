#!/usr/bin/env python3
"""Copy explicitly approved 4:3 scene sources into the tracked asset tree."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_ROOT = ROOT / "artifacts" / "world-generation" / "unit-scenes"
ASSET_ROOT = ROOT / "assets" / "worlds"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def promote(directory: Path) -> Path:
    manifest = json.loads((directory / "manifest.json").read_text())
    approval = manifest.get("approval", {})
    candidate_id = approval.get("candidateId")
    candidates = {candidate["id"]: candidate for candidate in manifest["candidates"]}
    candidate = candidates.get(candidate_id)
    if not candidate or candidate.get("approvalState") != "approved":
        raise RuntimeError(f"{manifest['unitId']} has no approved candidate")
    source = directory / candidate["path"]
    if not source.is_file() or candidate.get("sha256") != sha256(source):
        raise RuntimeError(f"{manifest['unitId']} approved candidate is missing or changed")

    destination_dir = ASSET_ROOT / manifest["worldId"] / "scenes" / manifest["sceneId"] / "compact"
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = destination_dir / "base.png"
    shutil.copy2(source, destination)
    provenance = {
        "schemaVersion": 1,
        "unitId": manifest["unitId"],
        "sceneId": manifest["sceneId"],
        "worldId": manifest["worldId"],
        "source": "base.png",
        "sha256": sha256(destination),
        "model": manifest.get("model"),
        "approval": approval,
    }
    (destination_dir / "source.json").write_text(json.dumps(provenance, indent=2) + "\n")
    return destination


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--unit", action="append", help="promote one approved unit; repeatable")
    args = parser.parse_args()
    directories = sorted(path for path in ARTIFACT_ROOT.iterdir() if (path / "manifest.json").is_file())
    selected = [path for path in directories if not args.unit or json.loads((path / "manifest.json").read_text())["unitId"] in args.unit]
    for directory in selected:
        destination = promote(directory)
        print(destination.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
