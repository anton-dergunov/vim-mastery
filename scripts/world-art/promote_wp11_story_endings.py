#!/usr/bin/env python3
"""Atomically promote owner-selected WP-11 portrait unit endings.

Only the three endings currently behind the bespoke-art approval gate may be
promoted. Candidate manifests and runtime presentation data are not changed
until every selection, source hash, image dimension, WebP conversion and
17-ending uniqueness check has passed.

Promotion installs two files per unit: the streamed WebP the runtime reads, and
the lossless PNG master beside it. The master is the approved candidate source
byte for byte, because the review tree it comes from is not tracked in git.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
REVIEW_ROOT = ROOT / "artifacts/world-generation/wp11/story-review-v2/unit-endings"
RUNTIME_ROOT = ROOT / "assets/worlds/story/units"
PRESENTATION_PATH = ROOT / "content/presentation.json"
APPROVAL_UNITS = (
    "viewport-control",
    "real-code-workflow-capstones",
    "mastery-loops",
)
EXPECTED_SOURCE_SIZE = (1792, 2400)
CWEBP_SETTINGS = ["-quiet", "-mt", "-m", "6", "-q", "90", "-metadata", "none"]
# WP-11 originally named Unit 9 long-range-navigation. This alias records the
# corrected historical source identity without changing the live unit id.
HISTORICAL_SOURCE_ALIASES = {"position-memory": "long-range-navigation"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def parse_approval(value: str) -> tuple[str, int]:
    unit_id, separator, number = value.partition("=")
    if not separator or unit_id not in APPROVAL_UNITS:
        raise argparse.ArgumentTypeError(
            f"expected one of {', '.join(APPROVAL_UNITS)}=<1-5>"
        )
    try:
        candidate_number = int(number)
    except ValueError as error:
        raise argparse.ArgumentTypeError("candidate number must be 1–5") from error
    if candidate_number not in range(1, 6):
        raise argparse.ArgumentTypeError("candidate number must be 1–5")
    return unit_id, candidate_number


def validate_image(path: Path, expected_size: tuple[int, int] | None = None) -> tuple[int, int]:
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        dimensions = image.size
    if expected_size and dimensions != expected_size:
        raise RuntimeError(f"{path}: expected {expected_size}, found {dimensions}")
    return dimensions


def write_json_temp(path: Path, value: dict) -> Path:
    temporary = path.with_name(f".{path.name}.promotion.tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    return temporary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--approve",
        action="append",
        type=parse_approval,
        required=True,
        metavar="UNIT=NUMBER",
        help="owner-approved candidate number; pass once for each pending unit",
    )
    args = parser.parse_args()
    approvals = dict(args.approve)
    if len(approvals) != len(args.approve):
        raise SystemExit("Each unit may be approved only once")
    if set(approvals) != set(APPROVAL_UNITS):
        missing = ", ".join(unit for unit in APPROVAL_UNITS if unit not in approvals)
        raise SystemExit(f"All three approval-gated units are required; missing: {missing}")

    presentation = json.loads(PRESENTATION_PATH.read_text())
    if len(presentation.get("units", {})) != 17:
        raise RuntimeError("Promotion requires the complete 17-unit presentation manifest")
    selected: dict[str, dict] = {}
    staged_manifests: dict[Path, dict] = {}
    approved_at = datetime.now(UTC).isoformat()

    with tempfile.TemporaryDirectory(prefix="vim-wilds-story-promotion-") as temporary_name:
        temporary_root = Path(temporary_name)
        for unit_id, candidate_number in approvals.items():
            directory = REVIEW_ROOT / f"{unit_id}-restoration-3x4"
            manifest_path = directory / "manifest.json"
            manifest = json.loads(manifest_path.read_text())
            if manifest.get("unitId") != unit_id:
                raise RuntimeError(f"{manifest_path}: unit identity mismatch")
            candidate_id = f"candidate-{candidate_number:02d}"
            candidates = {candidate["id"]: candidate for candidate in manifest["candidates"]}
            candidate = candidates.get(candidate_id)
            if candidate is None:
                raise RuntimeError(f"Unknown approval {unit_id}/{candidate_id}")
            source = directory / candidate["path"]
            if not source.is_file():
                raise RuntimeError(f"Missing approved image: {source}")
            source_hash = sha256(source)
            if not candidate.get("sha256") or candidate["sha256"] != source_hash:
                raise RuntimeError(f"Generated-image hash is missing or changed: {source}")
            dimensions = validate_image(source, EXPECTED_SOURCE_SIZE)

            staged = temporary_root / f"{unit_id}.webp"
            subprocess.run(
                ["cwebp", *CWEBP_SETTINGS, str(source), "-o", str(staged)],
                check=True,
            )
            validate_image(staged)
            output_hash = sha256(staged)
            staged_master = temporary_root / f"{unit_id}.png"
            shutil.copyfile(source, staged_master)
            selected[unit_id] = {
                "candidateId": candidate_id,
                "sourceSha256": source_hash,
                "sourceDimensions": list(dimensions),
                "staged": staged,
                "stagedMaster": staged_master,
                "outputSha256": output_hash,
            }

            for item in manifest["candidates"]:
                item["approvalState"] = "approved" if item["id"] == candidate_id else "rejected"
            manifest["approval"] = {
                "candidateId": candidate_id,
                "approvedAt": approved_at,
                "notes": "Owner-selected production unit-ending story image.",
                "sourceSha256": source_hash,
                "runtimeSha256": output_hash,
                "runtimePath": f"assets/worlds/story/units/{unit_id}.webp",
                "masterPath": f"assets/worlds/story/units/{unit_id}.png",
                "conversion": {"tool": "cwebp", "arguments": CWEBP_SETTINGS},
            }
            staged_manifests[manifest_path] = manifest

        ending_hashes: dict[str, str] = {}
        for unit_id, unit in presentation["units"].items():
            if unit_id in selected:
                path = selected[unit_id]["staged"]
                unit["completion"]["storyImage"] = f"assets/worlds/story/units/{unit_id}.webp"
                unit["completion"].pop("storyArtStatus", None)
            else:
                path = ROOT / unit["completion"]["storyImage"]
            validate_image(path)
            digest = sha256(path)
            duplicate = ending_hashes.get(digest)
            if duplicate:
                raise RuntimeError(f"Unit endings are not distinct: {duplicate} and {unit_id}")
            ending_hashes[digest] = unit_id
        if len(ending_hashes) != 17:
            raise RuntimeError("Expected 17 distinct, valid unit-ending images")

        RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
        manifest_temps = {
            path: write_json_temp(path, manifest)
            for path, manifest in staged_manifests.items()
        }
        presentation_temp = write_json_temp(PRESENTATION_PATH, presentation)
        for unit_id, item in selected.items():
            destination = RUNTIME_ROOT / f"{unit_id}.webp"
            item["staged"].replace(destination)
            if sha256(destination) != item["outputSha256"]:
                raise RuntimeError(f"Runtime verification failed: {destination}")
            master = RUNTIME_ROOT / f"{unit_id}.png"
            item["stagedMaster"].replace(master)
            if sha256(master) != item["sourceSha256"]:
                raise RuntimeError(f"Master verification failed: {master}")
        for path, temporary in manifest_temps.items():
            temporary.replace(path)
        presentation_temp.replace(PRESENTATION_PATH)

    for unit_id in APPROVAL_UNITS:
        item = selected[unit_id]
        print(
            f"Promoted {unit_id}/{item['candidateId']} -> "
            f"assets/worlds/story/units/{unit_id}.webp and {unit_id}.png"
        )
    print("Verified 17 distinct, valid story endings and cleared all pending-art gates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
