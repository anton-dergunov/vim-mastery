#!/usr/bin/env python3
"""Repair the lossless PNG masters that sit beside the runtime story endings.

Every unit ending ships as a WebP the runtime reads, with the owner-approved
candidate PNG kept beside it byte for byte. The master matters because the
review tree it comes from is not tracked in git, so the copy under `assets/` is
the only backed-up lossless original.

Promotions before this script installed the WebP alone, which let three masters
drift: `viewport-control` kept the placeholder copied during the Unit 9 split,
and the two capstone units never got a master at all. This script reconciles
every unit against the approval recorded in its review manifest, and `--check`
reports drift without writing anything.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from promote_wp11_story_endings import (
    EXPECTED_SOURCE_SIZE,
    HISTORICAL_SOURCE_ALIASES,
    PRESENTATION_PATH,
    REVIEW_ROOT,
    RUNTIME_ROOT,
    sha256,
    validate_image,
)


def approved_source(unit_id: str) -> tuple[Path, str, str]:
    """Return the approved candidate path, its id, and its recorded hash."""
    source_id = HISTORICAL_SOURCE_ALIASES.get(unit_id, unit_id)
    directory = REVIEW_ROOT / f"{source_id}-restoration-3x4"
    manifest_path = directory / "manifest.json"
    if not manifest_path.is_file():
        raise RuntimeError(f"{unit_id}: no review manifest at {manifest_path}")
    manifest = json.loads(manifest_path.read_text())
    approval = manifest.get("approval") or {}
    candidate_id = approval.get("candidateId")
    if not candidate_id:
        raise RuntimeError(f"{unit_id}: {manifest_path} records no approved candidate")
    candidates = {candidate["id"]: candidate for candidate in manifest["candidates"]}
    candidate = candidates.get(candidate_id)
    if candidate is None:
        raise RuntimeError(f"{unit_id}: approved {candidate_id} is not in {manifest_path}")
    source = directory / candidate["path"]
    if not source.is_file():
        raise RuntimeError(f"{unit_id}: missing approved image {source}")
    recorded = approval.get("sourceSha256") or candidate.get("sha256")
    if not recorded:
        raise RuntimeError(f"{unit_id}: {manifest_path} records no source hash")
    return source, candidate_id, recorded


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="report drift and exit non-zero without writing any file",
    )
    args = parser.parse_args()

    presentation = json.loads(PRESENTATION_PATH.read_text())
    units = presentation.get("units", {})
    if len(units) != 17:
        raise SystemExit("Master sync requires the complete 17-unit presentation manifest")

    planned: list[tuple[str, Path, Path, str, str]] = []
    unchanged: list[str] = []
    for unit_id in units:
        source, candidate_id, recorded_hash = approved_source(unit_id)
        source_hash = sha256(source)
        if source_hash != recorded_hash:
            raise SystemExit(f"{unit_id}: {source} hash is missing or changed")
        validate_image(source, EXPECTED_SOURCE_SIZE)
        master = RUNTIME_ROOT / f"{unit_id}.png"
        if master.is_file() and sha256(master) == source_hash:
            unchanged.append(unit_id)
            continue
        state = "stale" if master.is_file() else "missing"
        planned.append((unit_id, source, master, candidate_id, state))

    for unit_id, _, _, candidate_id, state in planned:
        print(f"{state}: {unit_id} master does not match approved {candidate_id}")

    if args.check:
        if planned:
            print(f"{len(planned)} of 17 masters need syncing; {len(unchanged)} already match")
            return 1
        print("All 17 story-ending masters match their approved candidate")
        return 0

    if not planned:
        print("All 17 story-ending masters already match their approved candidate")
        return 0

    RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
    staged: list[tuple[str, Path, Path, str]] = []
    for unit_id, source, master, candidate_id, _ in planned:
        temporary = master.with_name(f".{master.name}.sync.tmp")
        temporary.write_bytes(source.read_bytes())
        staged.append((unit_id, temporary, master, candidate_id))
    try:
        for unit_id, temporary, master, candidate_id in staged:
            temporary.replace(master)
            print(f"Synced {unit_id} master from approved {candidate_id}")
    finally:
        for _, temporary, _, _ in staged:
            temporary.unlink(missing_ok=True)

    for unit_id, _, master, _, _ in planned:
        _, _, recorded_hash = approved_source(unit_id)
        if sha256(master) != recorded_hash:
            raise SystemExit(f"Master verification failed: {master}")
    print(f"Verified 17 story-ending masters ({len(planned)} synced, {len(unchanged)} unchanged)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
