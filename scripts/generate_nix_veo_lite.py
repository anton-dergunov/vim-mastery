#!/usr/bin/env python3
"""Generate one Veo 3.1 Lite comparison animation for nix_happy.png.

Authentication intentionally matches generate_nix_test.py: the Google Gen AI
SDK runs in Vertex AI mode with Application Default Credentials and reads the
project/location from GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Sequence

from google import genai
from google.genai import types
from PIL import Image

import animate_character


MODEL = "veo-3.1-lite-generate-001"
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = SCRIPT_DIR / "nix_happy.png"
DEFAULT_PREPARED_INPUT = SCRIPT_DIR / "nix_happy_veo_input.png"
DEFAULT_OUTPUT = SCRIPT_DIR / "nix_happy_veo_lite.mp4"

PROMPT = """
Locked camera and a completely static dark neutral background.
Animate only the supplied original 2D pixel-art fantasy moth mascot, Nix, in a
short joyful success celebration. Nix makes one small buoyant hop, rapidly
flutters all existing wings, raises and gently bobs the lantern staff, and the
lantern and eyes brighten while a few small golden sparks appear. Preserve the
exact character design, silhouette, pixel-art rendering, teal hood, two glowing
eyes, antennae, existing wing count and shapes, staff, clothing, proportions,
colours, and camera angle. Keep the full body visible and centred at the same
scale. End settled in the original pose. Deliberately stylised 2D sprite
animation, not photorealistic.
""".strip()

NEGATIVE_PROMPT = """
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing
background, new objects, extra limbs, extra wings, missing wings, missing
staff, mutated anatomy, changed costume, changed face, text, captions,
watermark, realistic texture, photorealism, 3D render
""".strip()


class VeoError(RuntimeError):
    """Raised when Veo cannot return a usable video."""


def prepare_input(source_path: Path, destination: Path, device: str) -> Path:
    """Remove the baked checkerboard and place Nix on Veo's 9:16 canvas."""
    if not source_path.is_file():
        raise VeoError(f"Input image does not exist: {source_path}")
    source_bytes = source_path.read_bytes()
    source = Image.open(source_path)
    cleaned = animate_character.prepare_foreground_cached(
        source,
        source_bytes,
        animate_character.default_cache_dir(),
        animate_character.choose_device(device),
    )
    crop = cleaned.crop(animate_character.foreground_bbox(cleaned))

    canvas_size = (720, 1280)
    max_character_size = (620, 900)
    scale = min(max_character_size[0] / crop.width, max_character_size[1] / crop.height)
    rendered_size = (round(crop.width * scale), round(crop.height * scale))
    character = crop.resize(rendered_size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", canvas_size, (26, 32, 30, 255))
    position = (
        (canvas.width - character.width) // 2,
        (canvas.height - character.height) // 2,
    )
    canvas.alpha_composite(character, position)
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(destination, format="PNG", optimize=True)
    return destination


def generate_video(
    project_id: str,
    location: str,
    prepared_input: Path,
    output: Path,
    seed: int,
    timeout_seconds: int,
) -> Path:
    client = genai.Client(vertexai=True, project=project_id, location=location)
    operation = client.models.generate_videos(
        model=MODEL,
        prompt=PROMPT,
        image=types.Image(
            image_bytes=prepared_input.read_bytes(),
            mime_type="image/png",
        ),
        config=types.GenerateVideosConfig(
            number_of_videos=1,
            duration_seconds=4,
            fps=24,
            seed=seed,
            aspect_ratio="9:16",
            resolution="720p",
            negative_prompt=NEGATIVE_PROMPT,
            generate_audio=False,
            resize_mode=types.ImageResizeMode.PAD,
        ),
    )
    print(f"Started {MODEL}: {operation.name}", file=sys.stderr, flush=True)
    deadline = time.monotonic() + timeout_seconds
    while not operation.done:
        if time.monotonic() >= deadline:
            raise VeoError(
                f"Veo operation did not finish within {timeout_seconds} seconds: {operation.name}"
            )
        time.sleep(15)
        operation = client.operations.get(operation)
        print("Waiting for Veo...", file=sys.stderr, flush=True)

    if operation.error:
        raise VeoError(f"Veo operation failed: {operation.error}")
    response = operation.result or operation.response
    if response is None or not response.generated_videos:
        reasons = getattr(response, "rai_media_filtered_reasons", None) if response else None
        raise VeoError(f"Veo returned no video. Filter reasons: {reasons}")
    video = response.generated_videos[0].video
    if video is None:
        raise VeoError("Veo returned an empty generated-video record")
    if not video.video_bytes:
        raise VeoError(
            "Veo returned a remote URI instead of inline bytes. "
            f"URI: {video.uri or '<missing>'}"
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    video.save(str(output))
    return output


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate one four-second Nix animation with Veo 3.1 Lite on Vertex AI."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--prepared-input", type=Path, default=DEFAULT_PREPARED_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", "YOUR_PROJECT_ID"))
    parser.add_argument(
        "--location",
        default=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
        help="Vertex AI location (default: GOOGLE_CLOUD_LOCATION or us-central1)",
    )
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--timeout", type=int, default=900, help="Operation timeout in seconds")
    parser.add_argument(
        "--device",
        choices=("auto", "cpu", "mps", "cuda"),
        default="auto",
        help="Device used only for local checkerboard removal",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.project or args.project == "YOUR_PROJECT_ID":
        raise SystemExit(
            "Set GOOGLE_CLOUD_PROJECT or pass --project with the Vertex AI project ID."
        )
    if args.output.suffix.lower() != ".mp4":
        raise SystemExit("--output must use an .mp4 extension")
    try:
        prepared = prepare_input(args.input, args.prepared_input, args.device)
        print(f"Prepared Veo input: {prepared}", file=sys.stderr, flush=True)
        output = generate_video(
            args.project,
            args.location,
            prepared,
            args.output,
            args.seed,
            args.timeout,
        )
    except VeoError as error:
        raise SystemExit(str(error)) from error
    print(f"Saved: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
