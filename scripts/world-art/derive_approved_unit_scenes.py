#!/usr/bin/env python3
"""Derive tall and wide scene profiles only from explicitly approved sources."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from google.genai import errors


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


def extract_image(response: Any) -> bytes:
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data
    raise RuntimeError(f"Gemini returned no image: {response}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--unit", help="derive one unit; defaults to every approved Moonroot unit")
    parser.add_argument("--profile", choices=tuple(PROFILES), help="derive one profile")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    parser.add_argument("--location", default=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
    parser.add_argument("--min-request-interval", type=float, default=20.0)
    parser.add_argument("--quota-backoff-seconds", type=float, default=45.0)
    parser.add_argument("--max-quota-retries", type=int, default=3)
    args = parser.parse_args()
    if not args.project:
        raise SystemExit("Set GOOGLE_CLOUD_PROJECT or pass --project")
    missing_masks = [mask for _, mask in PROFILES.values() if not mask.is_file()]
    if missing_masks:
        raise SystemExit(f"Missing DOM masks: {', '.join(map(str, missing_masks))}")

    jobs: list[tuple[Path, dict[str, Any], Path, str]] = []
    directories = sorted(path for path in SCENE_ROOT.iterdir() if path.is_dir() and (path / "manifest.json").is_file())
    for directory in directories:
        manifest_path = directory / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        if args.unit and manifest["unitId"] != args.unit:
            continue
        source = approved_source(directory, manifest)
        profiles = [args.profile] if args.profile else list(PROFILES)
        for profile in profiles:
            destination = directory / f"{profile}-source.png"
            if not destination.exists():
                jobs.append((manifest_path, manifest, source, profile))

    print(f"Approved scene derivation plan: {len(jobs)} missing profile(s)")
    if not args.execute:
        for _, manifest, _, profile in jobs:
            print(f'  {manifest["unitId"]}/{profile}')
        print("Dry run only; add --execute to submit Vertex requests.")
        return 0

    from google import genai
    from google.genai import types

    client = genai.Client(vertexai=True, project=args.project, location=args.location)
    last_submission = 0.0
    for manifest_path, manifest, source, profile in jobs:
        ratio, mask = PROFILES[profile]
        delay = args.min_request_interval - (time.monotonic() - last_submission)
        if delay > 0:
            time.sleep(delay)
        print(f'Submitting {manifest["unitId"]}/{profile}…', flush=True)
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
        last_submission = time.monotonic()
        destination = manifest_path.parent / f"{profile}-source.png"
        destination.write_bytes(extract_image(response))
        manifest.setdefault("derivatives", {})[profile] = {
            "path": destination.name,
            "sha256": sha256(destination),
            "generatedAt": datetime.now(UTC).isoformat(),
            "model": MODEL,
        }
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"Saved {destination.relative_to(ROOT)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
