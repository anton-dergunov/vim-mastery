#!/usr/bin/env python3
"""Prepare reviewed Moonroot scene profiles and exact-registration proof patches."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "artifacts" / "world-generation" / "unit-scenes"
OUTPUT_ROOT = ROOT / "assets" / "worlds" / "moonroot-ruins" / "scenes"
PRESENTATION = ROOT / "content" / "presentation.json"
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
LANDMARK_REGIONS = {
    "mode-lantern-grounds": (0.06, 0.38, 0.38, 0.98),
    "wayfinder-crossroads": (0.28, 0.48, 0.72, 1.0),
    "scribes-spring": (0.18, 0.5, 0.82, 1.0),
    "grammar-gate-court": (0.27, 0.28, 0.73, 0.9),
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


def pixel_box(bounds: dict[str, float] | tuple[float, float, float, float], size: tuple[int, int]) -> tuple[int, int, int, int]:
    if isinstance(bounds, dict):
        left, top = bounds["x"], bounds["y"]
        right, bottom = left + bounds["width"], top + bounds["height"]
    else:
        left, top, right, bottom = bounds
    width, height = size
    return (
        round(left * width),
        round(top * height),
        round(right * width),
        round(bottom * height),
    )


def feathered_patch(base: Image.Image, box: tuple[int, int, int, int], variant: str) -> Image.Image:
    crop = base.crop(box)
    if variant == "phase-a":
        changed = ImageEnhance.Color(ImageEnhance.Brightness(crop).enhance(1.13)).enhance(1.16)
        tint = Image.new("RGB", crop.size, "#78d7c1")
        changed = Image.blend(changed, tint, 0.055)
        opacity = 188
    elif variant == "phase-b":
        changed = ImageEnhance.Contrast(ImageEnhance.Brightness(crop).enhance(1.1)).enhance(1.08)
        tint = Image.new("RGB", crop.size, "#a77bff")
        changed = Image.blend(changed, tint, 0.045)
        opacity = 174
    elif variant == "phase-c":
        changed = ImageEnhance.Color(ImageEnhance.Brightness(crop).enhance(1.16)).enhance(1.08)
        tint = Image.new("RGB", crop.size, "#b7e9dc")
        changed = Image.blend(changed, tint, 0.055)
        opacity = 164
    elif variant == "landmark-dormant":
        changed = ImageEnhance.Color(ImageEnhance.Brightness(crop).enhance(0.72)).enhance(0.72)
        opacity = 174
    elif variant == "landmark-restored":
        changed = ImageEnhance.Color(ImageEnhance.Brightness(crop).enhance(1.22)).enhance(1.2)
        tint = Image.new("RGB", crop.size, "#ffd47d")
        changed = Image.blend(changed, tint, 0.065)
        opacity = 196
    else:
        raise ValueError(variant)

    margin = max(5, round(min(crop.size) * 0.055))
    alpha = Image.new("L", crop.size, 0)
    core = Image.new("L", (max(1, crop.width - margin * 2), max(1, crop.height - margin * 2)), opacity)
    alpha.paste(core, (margin, margin))
    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=max(3, margin // 2)))
    canvas = Image.new("RGBA", base.size, (0, 0, 0, 0))
    canvas.paste(changed.convert("RGBA"), box[:2], alpha)
    return canvas


def assert_registered(patch: Image.Image, base: Image.Image, allowed_box: tuple[int, int, int, int], label: str) -> None:
    if patch.size != base.size:
        raise RuntimeError(f"{label}: patch and base dimensions differ")
    alpha_box = patch.getchannel("A").getbbox()
    if not alpha_box:
        raise RuntimeError(f"{label}: patch contains no changed pixels")
    if (
        alpha_box[0] < allowed_box[0]
        or alpha_box[1] < allowed_box[1]
        or alpha_box[2] > allowed_box[2]
        or alpha_box[3] > allowed_box[3]
    ):
        raise RuntimeError(f"{label}: changed pixels escape the declared patch region")


def main() -> int:
    presentation = json.loads(PRESENTATION.read_text())
    approval_data = json.loads(APPROVALS.read_text())
    approvals = {item["unitId"]: item for item in approval_data["approvals"]}
    ledger = {"schemaVersion": 1, "assets": []}
    for unit_id, scene_id in UNIT_SCENES.items():
        scene = presentation["units"][unit_id]["scenes"][scene_id]
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

            for patch_id, bounds in scene["patchRegions"].items():
                box = pixel_box(bounds, base.size)
                patch = feathered_patch(base, box, patch_id)
                assert_registered(patch, base, box, f"{unit_id}/{profile}/{patch_id}")
                patch.save(output / f"{patch_id}.webp", "WEBP", lossless=True, method=6)

            landmark_box = pixel_box(LANDMARK_REGIONS[scene_id], base.size)
            for state in ("landmark-dormant", "landmark-restored"):
                patch = feathered_patch(base, landmark_box, state)
                assert_registered(patch, base, landmark_box, f"{unit_id}/{profile}/{state}")
                patch.save(output / f"{state}.webp", "WEBP", lossless=True, method=6)

    ledger_path = OUTPUT_ROOT / "source-ledger.json"
    ledger_path.write_text(json.dumps(ledger, indent=2) + "\n")
    print(f"Prepared {len(ledger['assets'])} approved scene profiles.")
    print(f"Wrote {ledger_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
