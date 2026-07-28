#!/usr/bin/env python3
"""Record the reviewed source candidate used for unit-scene derivation."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_ROOT = ROOT / "artifacts" / "world-generation" / "unit-scenes"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("unit_id")
    parser.add_argument("candidate_id")
    parser.add_argument("--notes", default="")
    args = parser.parse_args()
    manifest_path = ARTIFACT_ROOT / args.unit_id / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"Missing manifest: {manifest_path}")
    manifest = json.loads(manifest_path.read_text())
    candidates = {candidate["id"]: candidate for candidate in manifest["candidates"]}
    if args.candidate_id not in candidates:
        raise SystemExit(f"Unknown candidate: {args.candidate_id}")
    candidate_path = manifest_path.parent / candidates[args.candidate_id]["path"]
    if not candidate_path.is_file():
        raise SystemExit(f"Candidate image is missing: {candidate_path}")
    for candidate in candidates.values():
        candidate["approvalState"] = "approved" if candidate["id"] == args.candidate_id else "rejected"
    candidates[args.candidate_id]["sha256"] = sha256(candidate_path)
    manifest["approval"] = {
        "candidateId": args.candidate_id,
        "approvedAt": datetime.now(UTC).isoformat(),
        "notes": args.notes,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Approved {args.unit_id}/{args.candidate_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
