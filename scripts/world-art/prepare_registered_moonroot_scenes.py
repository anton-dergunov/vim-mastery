#!/usr/bin/env python3
"""Prepare the three Moonroot board profiles from each approved scene source."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "artifacts" / "world-generation" / "unit-scenes"
OUTPUT_ROOT = ROOT / "assets" / "worlds" / "moonroot-ruins" / "scenes"
APPROVALS = ROOT / "scripts" / "world-art" / "moonroot-scene-approvals.json"
PROFILE_SIZES = {
    "tall": (960, 1200),
    "compact": (1200, 900),
    "wide": (1280, 720),
}
UNIT_SCENES = {
    "modal-model": "mode-lantern-grounds",
    "cursor-movement": "wayfinder-crossroads",
    "entering-changing-text": "scribes-spring",
    "operator-grammar": "grammar-gate-court",
}
def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def approved_source(unit_id: str, scene_id: str, profile: str, approvals: dict[str, dict]) -> Path:
    directory = SOURCE_ROOT / unit_id
    manifest = json.loads((directory / "manifest.json").read_text())
    approval = approvals.get(unit_id)
    if not approval or approval["sceneId"] != scene_id:
        raise RuntimeError(f"{unit_id}/{scene_id} is absent from the tracked approval ledger")
    approved_id = manifest.get("approval", {}).get("candidateId")
    if approved_id != approval["candidateId"]:
        raise RuntimeError(f"{unit_id} artifact approval disagrees with the tracked approval ledger")
    candidate = next((item for item in manifest["candidates"] if item["id"] == approved_id), None)
    if not candidate or candidate.get("approvalState") != "approved":
        raise RuntimeError(f"{unit_id} has no explicit approved candidate")
    if profile == "compact":
        path = directory / candidate["path"]
        expected_hash = approval["sourceSha256"]
        if candidate["sha256"] != expected_hash:
            raise RuntimeError(f"{unit_id} approved source hash disagrees with the tracked approval ledger")
    else:
        derivative = manifest.get("derivatives", {}).get(profile)
        if not derivative:
            raise RuntimeError(f"{unit_id}/{profile} has not been derived from its approved source")
        path = directory / derivative["path"]
        expected_hash = approval[f"{profile}Sha256"]
        if derivative["sha256"] != expected_hash:
            raise RuntimeError(f"{unit_id}/{profile} hash disagrees with the tracked approval ledger")
    if not path.is_file() or sha256(path) != expected_hash:
        raise RuntimeError(f"{unit_id}/{profile} source is missing or has changed")
    return path


def cover_resize(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_width, target_height = size
    scale = max(target_width / source.width, target_height / source.height)
    resized = source.resize(
        (round(source.width * scale), round(source.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - target_width) // 2
    top = (resized.height - target_height) // 2
    return resized.crop((left, top, left + target_width, top + target_height)).convert("RGB")


def main() -> int:
    approval_data = json.loads(APPROVALS.read_text())
    approvals = {item["unitId"]: item for item in approval_data["approvals"]}
    ledger = {"schemaVersion": 1, "assets": []}
    for unit_id, scene_id in UNIT_SCENES.items():
        for profile, size in PROFILE_SIZES.items():
            source_path = approved_source(unit_id, scene_id, profile, approvals)
            base = cover_resize(Image.open(source_path), size)
            output = OUTPUT_ROOT / scene_id / profile
            output.mkdir(parents=True, exist_ok=True)
            base_path = output / "base.webp"
            base.save(base_path, "WEBP", quality=84, method=6)
            ledger["assets"].append({
                "unitId": unit_id,
                "sceneId": scene_id,
                "profile": profile,
                "asset": str(base_path.relative_to(ROOT)),
                "source": str(source_path.relative_to(ROOT)),
                "sourceSha256": sha256(source_path),
                "sha256": sha256(base_path),
                "dimensions": list(base.size),
            })

    ledger_path = OUTPUT_ROOT / "source-ledger.json"
    ledger_path.write_text(json.dumps(ledger, indent=2) + "\n")
    print(f"Prepared {len(ledger['assets'])} approved scene profiles.")
    print(f"Wrote {ledger_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
