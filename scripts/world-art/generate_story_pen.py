#!/usr/bin/env python3
"""Generate the WP-11 handwriting pen with Gemini Nano Banana Pro."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import UTC, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_ROOT = (
    ROOT / "artifacts" / "world-generation" / "wp11" / "story-pen"
)
MODEL = "gemini-3-pro-image"  # Gemini Nano Banana Pro
REFERENCES: list[Path] = []
PROMPT = """Use case: illustration-story
Asset type: isolated animated handwriting cursor for the Vim Wilds story overlay
Primary request: Create one elegant flying magical writing quill with a small warm-gold metal nib at its lower-left tip, a compact pale parchment feather extending toward the upper right, and a restrained turquoise-gold ink glimmer gathered immediately around the nib. It should look like it is actively writing a story by itself, without a hand.
Composition: one complete quill only, diagonal from lower left to upper right, centered with generous padding. The nib must be the visually precise anchor and remain readable when the asset is displayed only 32 to 52 CSS pixels tall.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane or lighting variation.
Style/medium: polished 2D fantasy pixel art for a premium mobile game; crisp readable silhouette, painterly pixel clusters, restrained ancient-fantasy materials, soft cream parchment, antique warm gold and turquoise magical accents; a few restrained magical motes close to the nib only.
Constraints: no hand, no arm, no character, no inkwell, no paper, no landscape, no cast shadow, no contact shadow, no reflection, no text, no letters, no numbers, no UI, no border, no logo, no watermark. Do not use #ff00ff anywhere in the quill or its magic.
Output one square image."""


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def mime_type(path: Path) -> str:
    return "image/png" if path.suffix.lower() == ".png" else "image/webp"


def extract_image(response) -> bytes:
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data
    raise RuntimeError("Gemini returned no image payload")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    parser.add_argument("--location", default=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
    args = parser.parse_args()

    missing = [path for path in REFERENCES if not path.is_file()]
    if missing:
        raise SystemExit(f"Missing style reference(s): {', '.join(map(str, missing))}")
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    destination = OUTPUT_ROOT / "candidate-01.png"
    manifest_path = OUTPUT_ROOT / "manifest.json"
    manifest = {
        "schemaVersion": 1,
        "kind": "wp11-story-writing-pen",
        "model": MODEL,
        "modelFamily": "Gemini Nano Banana",
        "aspectRatio": "1:1",
        "prompt": PROMPT,
        "references": [
            {"path": str(path.relative_to(ROOT)), "sha256": sha256(path)}
            for path in REFERENCES
        ],
        "candidate": {
            "id": "candidate-01",
            "path": destination.name,
            "approvalState": "implementation-selected",
        },
    }
    if destination.is_file():
        manifest["candidate"].update({
            "sha256": sha256(destination),
            "generatedAt": datetime.fromtimestamp(
                destination.stat().st_mtime, UTC
            ).isoformat(),
        })
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"Already generated: {destination.relative_to(ROOT)}")
        return 0
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    if not args.execute:
        print(f"Dry run: {MODEL} -> {destination.relative_to(ROOT)}")
        return 0
    if not args.project:
        raise SystemExit("Set GOOGLE_CLOUD_PROJECT or pass --project")

    from google import genai
    from google.genai import types

    client = genai.Client(vertexai=True, project=args.project, location=args.location)
    parts = [
        types.Part.from_text(text=PROMPT),
        *[
            types.Part.from_bytes(data=path.read_bytes(), mime_type=mime_type(path))
            for path in REFERENCES
        ],
    ]
    response = client.models.generate_content(
        model=MODEL,
        contents=parts,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio="1:1",
                image_size="1K",
                output_mime_type="image/png",
            ),
        ),
    )
    destination.write_bytes(extract_image(response))
    manifest["candidate"].update({
        "sha256": sha256(destination),
        "generatedAt": datetime.now(UTC).isoformat(),
    })
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Saved {destination.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
