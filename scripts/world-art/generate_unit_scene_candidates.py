#!/usr/bin/env python3
"""Generate approval-gated Moonroot unit-scene candidates with Nano Banana 2."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw
from google.genai import errors


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_ROOT = ROOT / "artifacts" / "world-generation" / "unit-scenes"
MASK_METRICS = ROOT / "artifacts" / "world-generation" / "layout-masks" / "metrics.json"
REFERENCE_PATHS = (
    ROOT / "assets" / "enchanted-ruins.png",
    ROOT / "assets" / "world-kit.png",
)
MODEL = "gemini-3.1-flash-image"

UNITS = {
    "modal-model": {
        "sceneId": "mode-lantern-grounds",
        "location": "the grounds surrounding the ancient Mode Lantern",
        "landmark": "a waist-high ancient lantern with four visibly separate nested glass rings around a dim amber core",
        "meaning": "one place can hold several distinct states without becoming confusing",
    },
    "cursor-movement": {
        "sceneId": "wayfinder-crossroads",
        "location": "a moonlit forest crossroads of stone paths, roots, bridges and shallow water",
        "landmark": "a circular stone-and-brass wayfinder with four disconnected path arms and a resting central needle",
        "meaning": "direction, reachable destinations and deliberate movement through a coherent place",
    },
    "entering-changing-text": {
        "sceneId": "scribes-spring",
        "location": "a sheltered spring where luminous water passes through old carved channels",
        "landmark": "a suspended quill-like crystal above a small spring whose channel is visibly interrupted",
        "meaning": "new material can enter the world and existing material can be reshaped",
    },
    "operator-grammar": {
        "sceneId": "grammar-gate-court",
        "location": "the final Moonroot threshold leading toward the starlit region beyond",
        "landmark": "a compact gate made from two complementary mechanisms that nearly meet at the centre",
        "meaning": "an action and a range become useful when their two parts connect",
    },
}

CANDIDATE_DIRECTIONS = (
    (
        "landmark-destination",
        "Make the landmark site a believable destination integrated into architecture or terrain. It may be central, off-centre or partly framed, but it must stand on or attach to a real surface.",
    ),
    (
        "environmental-vista",
        "Lead with a memorable Moonroot environmental vista or natural phenomenon. The landmark is secondary and may sit toward an edge; the location must remain identifiable without it.",
    ),
    (
        "path-and-arrival",
        "Compose around arrival: a path, watercourse, bridge, stairs, threshold or line of light leads through the scene. Avoid a symmetrical empty stage.",
    ),
    (
        "intimate-place",
        "Create a closer, more intimate architectural or habitat view with tactile roots, stone, water and small lived-in details. Avoid a grand central portal composition.",
    ),
    (
        "asymmetric-experiment",
        "Use a strong asymmetric composition with one surprising but coherent spatial idea. There is no required hole, doorway, central void or editor-shaped empty region.",
    ),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_compact_mask() -> Path:
    metrics = json.loads(MASK_METRICS.read_text())
    profile = next(item for item in metrics["profiles"] if item["id"] == "compact")
    editor = profile["editor"]
    width, height = 1200, 900
    image = Image.new("RGB", (width, height), "#e6e2d8")
    draw = ImageDraw.Draw(image)
    box = (
        round(editor["x"] * width),
        round(editor["y"] * height),
        round((editor["x"] + editor["width"]) * width),
        round((editor["y"] + editor["height"]) * height),
    )
    draw.rectangle(box, fill="#f1a4a9", outline="#8e2333", width=8)
    spacing = 24
    for offset in range(-height, width, spacing):
        draw.line((offset, 0, offset + height, height), fill="#d75a65", width=5)
    draw.rectangle(box, outline="#8e2333", width=8)
    destination = MASK_METRICS.parent / "compact-generation-mask.png"
    image.save(destination, optimize=True)
    return destination


def candidate_prompt(unit: dict[str, str], direction: str) -> str:
    return f"""Use case: stylized-concept
Asset type: responsive environmental backdrop for the live Vim Wilds exercise board
Primary request: Create a new original Moonroot Ruins location for one learning unit.
Scene/backdrop: {unit["location"]}.
Landmark vocabulary: {unit["landmark"]}. The landmark may lead or support the composition according to the candidate direction, but any visible object must be physically supported by the environment.
Conceptual feeling: {unit["meaning"]}.
Style/medium: polished original 2D pixel-art fantasy, crisp silhouettes and painterly pixel clusters; match the attached Vim Wilds references in rendering language, restrained amber, turquoise and violet accents, and deep blue-green moonlight.
Composition/framing: 4:3 landscape. {direction}
UI occlusion reference: The attached red-hatched image records the area a real HTML editor can cover. It is measurement data only. Do not reproduce its colors, rectangle, hatching, shape or emptiness. The world must remain a coherent complete illustration when the editor is absent. Keep irreplaceable focal detail outside that covered area, but ordinary scenery may continue naturally behind it.
Constraints: coherent background, middle ground and foreground; grounded objects; consistent side-on or gently elevated game perspective; readable outer scenery when the editor is present; no characters.
Avoid: a generic black hole; an editor-shaped cavity; a compulsory central doorway; floating architecture; isolated prop-sheet objects; top-down map perspective; writing; letters; code; keyboard keys; signs; captions; UI; logos; pseudo-text; watermark; recognizable franchise imagery.
Output one 2K 4:3 image."""


def build_manifest(unit_id: str, unit: dict[str, str], mask: Path) -> dict[str, Any]:
    return {
        "schemaVersion": 2,
        "unitId": unit_id,
        "sceneId": unit["sceneId"],
        "worldId": "moonroot-ruins",
        "model": MODEL,
        "createdAt": datetime.now(UTC).isoformat(),
        "approval": {"candidateId": None, "approvedAt": None, "notes": ""},
        "references": [
            {"path": str(path.relative_to(ROOT)), "sha256": sha256(path)}
            for path in (*REFERENCE_PATHS, mask)
        ],
        "candidates": [
            {
                "id": f"candidate-{index:02d}",
                "directionId": direction_id,
                "direction": direction,
                "prompt": candidate_prompt(unit, direction),
                "path": f"candidate-{index:02d}.png",
                "approvalState": "pending",
            }
            for index, (direction_id, direction) in enumerate(CANDIDATE_DIRECTIONS, 1)
        ],
    }


def extract_image(response: Any) -> bytes:
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data
    raise RuntimeError(f"Gemini returned no image: {response}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--unit", choices=tuple(UNITS), help="generate one unit; defaults to all four")
    parser.add_argument("--candidate", type=int, choices=range(1, 6), help="generate one candidate number")
    parser.add_argument("--execute", action="store_true", help="submit paid Vertex requests")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    parser.add_argument("--location", default=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
    parser.add_argument("--min-request-interval", type=float, default=15.0)
    parser.add_argument("--quota-backoff-seconds", type=float, default=75.0)
    parser.add_argument("--max-quota-retries", type=int, default=2)
    args = parser.parse_args()
    if not MASK_METRICS.is_file():
        raise SystemExit("Run node scripts/world-art/capture_scene_masks.mjs first")
    if not args.project:
        raise SystemExit("Set GOOGLE_CLOUD_PROJECT or pass --project")
    missing = [path for path in REFERENCE_PATHS if not path.is_file()]
    if missing:
        raise SystemExit(f"Missing reference images: {', '.join(map(str, missing))}")

    mask = create_compact_mask()
    selected_units = {args.unit: UNITS[args.unit]} if args.unit else UNITS
    jobs: list[tuple[Path, dict[str, Any], dict[str, Any]]] = []
    for unit_id, unit in selected_units.items():
        directory = ARTIFACT_ROOT / unit_id
        directory.mkdir(parents=True, exist_ok=True)
        manifest_path = directory / "manifest.json"
        manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else build_manifest(unit_id, unit, mask)
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        candidates = manifest["candidates"]
        if args.candidate:
            candidates = [candidates[args.candidate - 1]]
        for candidate in candidates:
            if not (directory / candidate["path"]).exists():
                jobs.append((manifest_path, manifest, candidate))

    print(f"Moonroot unit-scene plan: {len(jobs)} missing {MODEL} candidate(s)")
    if not args.execute:
        for _, manifest, candidate in jobs:
            print(f'  {manifest["unitId"]}/{candidate["id"]}: {candidate["directionId"]}')
        print("Dry run only; add --execute to submit Vertex requests.")
        return 0

    from google import genai
    from google.genai import types

    client = genai.Client(vertexai=True, project=args.project, location=args.location)
    reference_parts = [
        types.Part.from_bytes(data=path.read_bytes(), mime_type="image/png")
        for path in (*REFERENCE_PATHS, mask)
    ]
    last_submission = 0.0
    for manifest_path, manifest, candidate in jobs:
        delay = args.min_request_interval - (time.monotonic() - last_submission)
        if delay > 0:
            time.sleep(delay)
        print(f'Submitting {manifest["unitId"]}/{candidate["id"]}…', flush=True)
        for attempt in range(args.max_quota_retries + 1):
            try:
                response = client.models.generate_content(
                    model=MODEL,
                    contents=[types.Part.from_text(text=candidate["prompt"]), *reference_parts],
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE"],
                        image_config=types.ImageConfig(
                            aspect_ratio="4:3",
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
        destination = manifest_path.parent / candidate["path"]
        destination.write_bytes(extract_image(response))
        candidate["sha256"] = sha256(destination)
        candidate["sourceDimensions"] = list(Image.open(destination).size)
        candidate["generatedAt"] = datetime.now(UTC).isoformat()
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"Saved {destination.relative_to(ROOT)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
