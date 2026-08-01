#!/usr/bin/env python3
"""Promote the owner's approved WP-11 portrait unit endings."""

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REVIEW_ROOT = (
    ROOT / "artifacts" / "world-generation" / "wp11" / "story-review-v2"
    / "unit-endings"
)
RUNTIME_ROOT = ROOT / "assets" / "worlds" / "story" / "units"
PRESENTATION_PATH = ROOT / "content" / "presentation.json"

APPROVALS = {
    "modal-model": 5,
    "cursor-movement": 2,
    "entering-changing-text": 3,
    "operator-grammar": 1,
    "precision-motions-search": 1,
    "text-objects": 1,
    "visual-selection": 5,
    "registers-putting": 3,
    "long-range-navigation": 3,
    "repeatable-editing": 2,
    "command-line-ranges-line-operations": 4,
    "substitution-practical-regex": 2,
    "macros": 4,
    "global-normal-automation": 4,
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    presentation = json.loads(PRESENTATION_PATH.read_text())
    if set(APPROVALS) != set(presentation["units"]):
        raise RuntimeError("The approval map must cover every presentation unit exactly once")

    RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
    approved_at = datetime.now(UTC).isoformat()
    for unit_id, candidate_number in APPROVALS.items():
        directory = REVIEW_ROOT / f"{unit_id}-restoration-3x4"
        manifest_path = directory / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        candidate_id = f"candidate-{candidate_number:02d}"
        candidates = {candidate["id"]: candidate for candidate in manifest["candidates"]}
        candidate = candidates.get(candidate_id)
        if candidate is None:
            raise RuntimeError(f"Unknown approval {unit_id}/{candidate_id}")
        source = directory / candidate["path"]
        if not source.is_file():
            raise RuntimeError(f"Missing approved image: {source}")
        source_hash = sha256(source)
        if candidate.get("sha256") and candidate["sha256"] != source_hash:
            raise RuntimeError(f"Generated-image hash changed: {source}")

        for item in manifest["candidates"]:
            item["approvalState"] = "approved" if item["id"] == candidate_id else "rejected"
        candidate["sha256"] = source_hash
        manifest["approval"] = {
            "candidateId": candidate_id,
            "approvedAt": approved_at,
            "notes": "Owner-selected production unit-ending story image.",
        }
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

        destination = RUNTIME_ROOT / f"{unit_id}.png"
        shutil.copyfile(source, destination)
        if sha256(destination) != source_hash:
            raise RuntimeError(f"Promotion verification failed: {destination}")
        presentation["units"][unit_id]["completion"]["storyImage"] = str(
            destination.relative_to(ROOT)
        )
        print(f"Promoted {unit_id}/{candidate_id} -> {destination.relative_to(ROOT)}")

    PRESENTATION_PATH.write_text(json.dumps(presentation, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
