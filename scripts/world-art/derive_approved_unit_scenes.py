#!/usr/bin/env python3
"""Derive tall and wide scene profiles only from explicitly approved sources.

By default each missing profile is generated once, straight to
``<profile>-source.png``. ``--candidates N`` writes N numbered candidates beside
it instead, for the owner to choose from, and ``--promote N`` makes the chosen
one the source and deletes the rest. ``--repair`` regenerates from the existing
source rather than the approved scene, to paint out an occlusion mask the model
copied into it. ``--text-occlusion`` derives without the mask image, describing
the covered band in words from ``layout-masks/metrics.json``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
SCENE_ROOT = ROOT / "artifacts" / "world-generation" / "unit-scenes"
MASK_ROOT = ROOT / "artifacts" / "world-generation" / "layout-masks"
MODEL = "gemini-3.1-flash-image"
PROFILES = {
    "tall": ("4:5", MASK_ROOT / "tall-dom-mask.png"),
    "wide": ("16:9", MASK_ROOT / "wide-dom-mask.png"),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def approved_source(directory: Path, manifest: dict[str, Any]) -> Path:
    candidate_id = manifest.get("approval", {}).get("candidateId")
    candidates = {candidate["id"]: candidate for candidate in manifest["candidates"]}
    candidate = candidates.get(candidate_id)
    if not candidate or candidate.get("approvalState") != "approved":
        raise RuntimeError(f"{manifest['unitId']} has no explicitly approved source")
    source = directory / candidate["path"]
    if not source.is_file() or candidate.get("sha256") != sha256(source):
        raise RuntimeError(f"{manifest['unitId']} approved source is missing or has changed")
    return source


def prompt(profile: str, unit_id: str, scene_id: str) -> str:
    framing = (
        "Recompose and extend the approved location vertically for a 4:5 board. "
        "Preserve meaningful grounded foreground below the editor and useful atmosphere above it."
        if profile == "tall"
        else
        "Recompose and extend the approved location horizontally for a 16:9 board. "
        "Continue coherent traversable scenery into both sides and keep attachments physically plausible."
    )
    return f"""Use case: precise-object-edit
Asset type: responsive Vim Wilds unit-scene profile
Primary request: Create the {profile} responsive profile of the attached approved {unit_id} scene ({scene_id}).
Input images: Image 1 is the approved scene and edit target; Image 2 is measurement-only UI occlusion data.
Composition/framing: {framing}
Style/medium: preserve the approved original pixel-art rendering, palette, materials, perspective, landmark identity and spatial logic.
UI occlusion reference: The red-hatched image records where live HTML can cover the art. Do not reproduce its colors, rectangle, hatching, shape or emptiness. Keep important unique details visible outside it while allowing ordinary scenery to continue naturally behind it.
Constraints: the result must be a complete coherent scene when no editor is present; every object remains supported by real terrain or architecture; no characters.
Avoid: a new central black hole; an editor-shaped cavity; floating objects; isolated props; writing; symbols; code; UI; text; watermark.
Change only what responsive recomposition requires."""


def occlusion_sentence(profile: str) -> str:
    """Say in words where live HTML covers the board, from the measured layout."""
    metrics = json.loads((MASK_ROOT / "metrics.json").read_text())
    editor = next(item for item in metrics["profiles"] if item["id"] == profile)["editor"]
    left, top = editor["x"], editor["y"]
    right, bottom = left + editor["width"], top + editor["height"]
    return (
        f"UI occlusion: live HTML can cover the band from {left:.0%} to {right:.0%} of the width and "
        f"{top:.0%} to {bottom:.0%} of the height. Paint ordinary scenery there as everywhere else, "
        "keep important unique details outside it, and do not mark, outline, tint or empty that band."
    )


def text_occlusion_prompt(profile: str, unit_id: str, scene_id: str) -> str:
    """The derive prompt with the mask image replaced by a sentence."""
    lines = prompt(profile, unit_id, scene_id).splitlines()
    lines = [
        "Input images: Image 1 is the approved scene and edit target." if line.startswith("Input images:")
        else occlusion_sentence(profile) if line.startswith("UI occlusion reference:")
        else line
        for line in lines
    ]
    return "\n".join(lines)


def repair_prompt(profile: str, unit_id: str, scene_id: str) -> str:
    return f"""Use case: precise-object-edit
Asset type: responsive Vim Wilds unit-scene profile
Primary request: Repair the attached {profile} profile of the {unit_id} scene ({scene_id}). A flat red rectangle with diagonal pink hatching was pasted over the top centre of the picture by mistake. Remove it completely.
Inpainting: paint the scene that belongs behind the rectangle, continuing the sky, architecture, terrain and lighting that surround it so the repaired area cannot be told apart from the rest.
Style/medium: preserve the original pixel-art rendering, palette, materials, perspective and pixel scale exactly.
Constraints: change nothing outside the rectangle; keep the same framing, aspect ratio and every existing object in place; no characters.
Avoid: any red or pink fill; hatching; a rectangle outline; a flat or empty patch; a new landmark in the repaired area; writing; symbols; code; UI; text; watermark."""


def candidate_path(directory: Path, profile: str, number: int) -> Path:
    return directory / f"{profile}-candidate-{number:02d}.png"


def copied_mask_fraction(path: Path) -> float:
    """Share of the picture painted in the occlusion mask's red hatching."""
    from PIL import Image

    with Image.open(path) as image:
        small = image.convert("RGB").resize((image.width // 8, image.height // 8))
    pixels = list(small.getdata())
    hatched = sum(1 for r, g, b in pixels if r > 170 and r - g > 60 and r - b > 40 and b > 60 and g < 190)
    return hatched / len(pixels)


# Real scenery reaches about half a percent of mask-coloured pixels (lanterns,
# banners); a copied mask covers several times that.
COPIED_MASK_THRESHOLD = 0.012


def promote(directory: Path, manifest: dict[str, Any], profile: str, number: int) -> Path:
    """Make one candidate the profile's source and delete the others."""
    chosen = candidate_path(directory, profile, number)
    if not chosen.is_file():
        raise RuntimeError(f"{manifest['unitId']} has no {chosen.name}")
    records = {
        record["path"]: record
        for record in manifest.get("derivativeCandidates", {}).get(profile, [])
    }
    destination = directory / f"{profile}-source.png"
    shutil.copyfile(chosen, destination)
    record = records.get(chosen.name, {})
    manifest.setdefault("derivatives", {})[profile] = {
        "path": destination.name,
        "sha256": sha256(destination),
        "generatedAt": record.get("generatedAt", datetime.now(UTC).isoformat()),
        "model": record.get("model", MODEL),
        "mode": record.get("mode", "derive"),
        "promotedFrom": chosen.name,
    }
    for leftover in directory.glob(f"{profile}-candidate-*.png"):
        leftover.unlink()
    review = directory / f"{profile}-candidates-review.png"
    if review.exists():
        review.unlink()
    manifest.get("derivativeCandidates", {}).pop(profile, None)
    if not manifest.get("derivativeCandidates"):
        manifest.pop("derivativeCandidates", None)
    return destination


def plan_jobs(
    directory: Path,
    manifest: dict[str, Any],
    profiles: list[str],
    candidates: int,
    repair: bool,
) -> list[tuple[str, Path, Path]]:
    """List (profile, input image, destination) for what is still missing."""
    jobs = []
    for profile in profiles:
        current = directory / f"{profile}-source.png"
        if repair:
            if not current.is_file():
                raise RuntimeError(f"{manifest['unitId']} has no {current.name} to repair")
            source = current
        else:
            source = approved_source(directory, manifest)
        if candidates:
            destinations = [candidate_path(directory, profile, number) for number in range(1, candidates + 1)]
        else:
            destinations = [current]
        jobs.extend((profile, source, destination) for destination in destinations if not destination.exists())
    return jobs


class NoImageOutput(RuntimeError):
    """Vertex accepted a derivation request but returned no image payload."""


def extract_image(response: Any) -> bytes:
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data
    raise NoImageOutput(f"Gemini returned no image: {response}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--unit", help="derive one unit; defaults to every unit with an approved scene")
    parser.add_argument("--profile", choices=tuple(PROFILES), help="derive one profile")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--candidates", type=int, default=0, help="write this many numbered candidates instead of the source")
    parser.add_argument("--repair", action="store_true", help="paint a copied occlusion mask out of the existing source")
    parser.add_argument("--text-occlusion", action="store_true", help="describe the covered band in words instead of attaching the mask image")
    parser.add_argument("--promote", type=int, metavar="N", help="make candidate N the source; needs --unit and --profile")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    parser.add_argument("--location", default=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
    parser.add_argument("--min-request-interval", type=float, default=20.0)
    parser.add_argument("--quota-backoff-seconds", type=float, default=45.0)
    parser.add_argument("--max-quota-retries", type=int, default=3)
    args = parser.parse_args()
    if args.promote is not None:
        if not args.unit or not args.profile:
            raise SystemExit("--promote needs --unit and --profile")
        directory = next(
            (path.parent for path in sorted(SCENE_ROOT.glob("*/manifest.json"))
             if json.loads(path.read_text())["unitId"] == args.unit),
            None,
        )
        if directory is None:
            raise SystemExit(f"No scene manifest for unit {args.unit}")
        manifest_path = directory / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        destination = promote(directory, manifest, args.profile, args.promote)
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"Promoted candidate {args.promote} to {destination.relative_to(ROOT)}")
        return 0
    if args.repair and not args.candidates:
        raise SystemExit("--repair replaces an existing source, so it needs --candidates")
    if not args.project:
        raise SystemExit("Set GOOGLE_CLOUD_PROJECT or pass --project")
    needs_mask = not args.repair and not args.text_occlusion
    wanted = [args.profile] if args.profile else list(PROFILES)
    missing_masks = [PROFILES[profile][1] for profile in wanted if needs_mask and not PROFILES[profile][1].is_file()]
    if missing_masks:
        raise SystemExit(f"Missing DOM masks: {', '.join(map(str, missing_masks))}")

    jobs: list[tuple[Path, dict[str, Any], Path, str]] = []
    directories = sorted(path for path in SCENE_ROOT.iterdir() if path.is_dir() and (path / "manifest.json").is_file())
    for directory in directories:
        manifest_path = directory / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        if args.unit and manifest["unitId"] != args.unit:
            continue
        profiles = [args.profile] if args.profile else list(PROFILES)
        for profile, source, destination in plan_jobs(directory, manifest, profiles, args.candidates, args.repair):
            jobs.append((manifest_path, manifest, source, profile, destination))

    print(f"Approved scene derivation plan: {len(jobs)} missing image(s)")
    if not args.execute:
        for _, manifest, _, profile, destination in jobs:
            print(f'  {manifest["unitId"]}/{profile} -> {destination.name}')
        print("Dry run only; add --execute to submit Vertex requests.")
        return 0

    from google import genai
    from google.genai import errors, types

    client = genai.Client(vertexai=True, project=args.project, location=args.location)
    last_submission = 0.0
    for manifest_path, manifest, source, profile, destination in jobs:
        ratio, mask = PROFILES[profile]
        # Other jobs may have written this unit's manifest since it was planned.
        manifest = json.loads(manifest_path.read_text())
        delay = args.min_request_interval - (time.monotonic() - last_submission)
        if delay > 0:
            time.sleep(delay)
        print(f'Submitting {manifest["unitId"]}/{profile} -> {destination.name}…', flush=True)
        if args.repair:
            # The mask is what the model copied, so a repair never sees it.
            parts = [
                types.Part.from_text(text=repair_prompt(profile, manifest["unitId"], manifest["sceneId"])),
                types.Part.from_bytes(data=source.read_bytes(), mime_type="image/png"),
            ]
        elif args.text_occlusion:
            parts = [
                types.Part.from_text(text=text_occlusion_prompt(profile, manifest["unitId"], manifest["sceneId"])),
                types.Part.from_bytes(data=source.read_bytes(), mime_type="image/png"),
            ]
        else:
            parts = [
                types.Part.from_text(text=prompt(profile, manifest["unitId"], manifest["sceneId"])),
                types.Part.from_bytes(data=source.read_bytes(), mime_type="image/png"),
                types.Part.from_bytes(data=mask.read_bytes(), mime_type="image/png"),
            ]
        for attempt in range(args.max_quota_retries + 1):
            try:
                response = client.models.generate_content(
                    model=MODEL,
                    contents=parts,
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE"],
                        image_config=types.ImageConfig(
                            aspect_ratio=ratio,
                            image_size="2K",
                            output_mime_type="image/png",
                        ),
                    ),
                )
                image_bytes = extract_image(response)
                break
            except errors.ClientError as error:
                if error.code != 429 or attempt >= args.max_quota_retries:
                    raise
                print(
                    f"Vertex quota boundary; waiting {args.quota_backoff_seconds:.0f}s "
                    f"before retry {attempt + 2}/{args.max_quota_retries + 1}…",
                    flush=True,
                )
                time.sleep(args.quota_backoff_seconds)
            except NoImageOutput as error:
                manifest.setdefault("derivationWarnings", []).append({
                    "profile": profile,
                    "at": datetime.now(UTC).isoformat(),
                    "reason": str(error),
                })
                manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
                if attempt >= args.max_quota_retries:
                    raise
                print(
                    f"Vertex returned no image; waiting {args.quota_backoff_seconds:.0f}s "
                    f"before retry {attempt + 2}/{args.max_quota_retries + 1}…",
                    flush=True,
                )
                time.sleep(args.quota_backoff_seconds)
        last_submission = time.monotonic()
        destination.write_bytes(image_bytes)
        record = {
            "path": destination.name,
            "sha256": sha256(destination),
            "generatedAt": datetime.now(UTC).isoformat(),
            "model": MODEL,
        }
        if args.candidates:
            record["mode"] = "repair" if args.repair else "derive-text-occlusion" if args.text_occlusion else "derive"
            records = manifest.setdefault("derivativeCandidates", {}).setdefault(profile, [])
            records[:] = [item for item in records if item["path"] != destination.name] + [record]
        else:
            manifest.setdefault("derivatives", {})[profile] = record
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"Saved {destination.relative_to(ROOT)}", flush=True)
        fraction = copied_mask_fraction(destination)
        if fraction > COPIED_MASK_THRESHOLD:
            print(f"  WARNING: {fraction:.1%} of {destination.name} is mask-coloured; it may carry a copied occlusion mask.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
