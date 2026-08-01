#!/usr/bin/env python3
"""Generate five review-only WP-11 Intro Panel 1 candidates with Nano Banana Pro."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from datetime import UTC, datetime
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "artifacts/world-generation/wp11/intro-connected"
MODEL = "gemini-3-pro-image"  # Nano Banana Pro
REFERENCES = (
    ROOT / "assets/worlds/moonroot-ruins/scenes/mode-lantern-grounds/compact/base.webp",
    ROOT / "assets/worlds/starwater-sanctuary/scenes/starneedle-observatory/compact/base.webp",
    ROOT / "assets/worlds/archive-of-echoes/scenes/memory-archive/compact/base.webp",
    ROOT / "assets/worlds/brass-meridian/scenes/meridian-table/compact/base.webp",
)
AXES = (
    ("transition-topology", "Vary only how the four regional environments overlap at their boundaries."),
    ("current-path", "Vary only the restrained amber-cyan terrain-following current path."),
    ("archive-depth", "Vary only the degree and placement of the Archive's welcoming carved depth."),
    ("water-ridge-balance", "Vary only the relative prominence of Starwater reflection versus the Brass Meridian ridge."),
    ("landmark-subtlety", "Vary only how quietly the distant restored landmarks read while remaining embedded and small."),
    ("moonroot-threshold", "Lead with a more intimate but still panoramic Moonroot threshold before it opens naturally toward Starwater."),
    ("starwater-expanse", "Give the Starwater reflection more breathing room while retaining a clear continuous route into Archive depth."),
    ("archive-emergence", "Make the Archive emerge through a believable water-and-stone descent instead of reading as a separate underground cutaway."),
    ("meridian-arrival", "Make the Brass Meridian arrival feel more distant, precise, and naturally supported by the ridge."),
    ("lower-third-quiet", "Protect a calmer, real environmental lower-third reading zone while keeping it richly composed rather than empty."),
    ("three-plane-depth", "Strengthen the separation of foreground, middle ground, and distant depth without changing the regional journey."),
    ("organic-architecture-balance", "Balance the Moonroot organic forms with the later glass, archive, and brass architecture more elegantly."),
    ("luminous-rhythm", "Vary only the restrained rhythm of warm lanterns, cyan paths, and violet accents across the panorama."),
    ("water-to-conduit-handoff", "Make the handoff from reflective water to archive rails and Meridian conduits feel more continuous and physically plausible."),
    ("phone-crop-resilience", "Prioritize a clean, legible crop at narrow phone widths without sacrificing the full panoramic scene."),
)
PROMPT = """Use case: cinematic key art for an original mobile learning game
Asset type: first panel of a three-panel story introduction
Output: one 2K 16:9 polished 2D pixel-art illustration

REFERENCE ORDER
The four attached approved Vim Wilds boards are material and architecture references only, in this fixed order: Moonroot, Starwater, Archive, Brass Meridian. Preserve their original rendering language, palette discipline, materials, and slightly elevated side-on perspective. Do not copy any one board's camera or turn these references into four panels.

Create one continuous distant panorama of the Vim Wilds at a calm remembered height of harmony. This is a single believable landscape with atmospheric depth—not four screenshots, four framed quadrants, a collage, a board-game map, or an infographic.

Compose the regions as a left-to-right environmental journey with natural overlaps and depth transitions. Moonroot Ruins begins in a blue-green moonlit forest sanctuary of enormous roots, mossed dark stone, still water, tiny amber lanterns, violet spores, and turquoise mineral veins. It opens toward Starwater Sanctuary: spacious dark reflective water, slim stone islands, translucent reeds, glass observatory forms, pale cyan and violet reflections, and sparse warm navigation lights. The water and stone descend naturally into the Archive of Echoes, glimpsed through a deep welcoming carved chamber with suspended shelves, teal crystal drawers, distant brass beacons, amber memory lights, and violet shadow. Archive rails and light channels rise toward Brass Meridian beneath a dark ridge: precise brass routes, copper conduits, glass lenses, controlled ember light, and narrow cyan current.

Show small, distant restored landmark silhouettes embedded in their regions, not enlarged hero props. Connect the four regions with two or three extremely thin amber and cyan currents that follow real terrain, water, arches, rails, and conduits. The connections should guide the eye in one gentle sweep and make the world feel linguistically coordinated, not electrically powered.

Use three depth planes, a restrained luminous focal rhythm, painterly pixel clusters, crisp silhouettes, deep navy foundations, and consistent slightly elevated side-on perspective. Leave broad calm dark negative space across much of the lower third so responsive HTML copy remains readable, but keep that space as real water, stone shadow, or atmospheric terrain—not a blank rectangle.

No characters. No text, letters, runes, code, UI, borders, region labels, icons, arrows, maps, compass rose, generated signage, pseudo-writing, logo, or watermark. Avoid a four-biome strip, equal quadrants, fantasy world map, daylight, catastrophe, high-saturation neon, or copied game composition."""


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def build_manifest() -> dict:
    return {
        "schemaVersion": 1,
        "kind": "wp11-story-review-candidates",
        "panel": "connected-wilds",
        "model": MODEL,
        "createdAt": datetime.now(UTC).isoformat(),
        "approval": {"candidateId": None, "approvedAt": None, "notes": ""},
        "references": [{"path": str(path.relative_to(ROOT)), "sha256": sha256(path)} for path in REFERENCES],
        "candidates": [
            {"id": f"candidate-{index:02d}", "axis": axis, "path": f"candidate-{index:02d}.png", "approvalState": "pending", "prompt": f"{PROMPT}\n\nCOMPARISON AXIS\n{direction}\nChange no other narrative or composition constraint."}
            for index, (axis, direction) in enumerate(AXES, 1)
        ],
    }


def ensure_candidate_plan(data: dict) -> None:
    """Extend an existing review manifest without replacing generated metadata."""
    candidates = data.setdefault("candidates", [])
    existing = {candidate.get("id") for candidate in candidates}
    for index, (axis, direction) in enumerate(AXES, 1):
        candidate_id = f"candidate-{index:02d}"
        if candidate_id not in existing:
            candidates.append({
                "id": candidate_id,
                "axis": axis,
                "path": f"candidate-{index:02d}.png",
                "approvalState": "pending",
                "prompt": f"{PROMPT}\n\nCOMPARISON AXIS\n{direction}\nChange no other narrative or composition constraint.",
            })


def extract_image(response) -> bytes:
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data
    raise RuntimeError("Gemini returned no image output")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", type=int, choices=range(1, len(AXES) + 1))
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    parser.add_argument("--location", default=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
    parser.add_argument("--min-request-interval", type=float, default=15)
    parser.add_argument("--quota-backoff-seconds", type=float, default=60)
    parser.add_argument("--max-quota-retries", type=int, default=2)
    args = parser.parse_args()
    if not args.project:
        raise SystemExit("Set GOOGLE_CLOUD_PROJECT or pass --project")
    missing = [path for path in REFERENCES if not path.is_file()]
    if missing:
        raise SystemExit(f"Missing approved references: {', '.join(map(str, missing))}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUTPUT / "manifest.json"
    data = json.loads(manifest_path.read_text()) if manifest_path.exists() else build_manifest()
    ensure_candidate_plan(data)
    selected = [data["candidates"][args.candidate - 1]] if args.candidate else data["candidates"]
    jobs = [candidate for candidate in selected if not (OUTPUT / candidate["path"]).exists()]
    print(f"WP-11 story-art plan: {len(jobs)} missing {MODEL} candidate(s)")
    for candidate in jobs:
        print(f"  {candidate['id']}: {candidate['axis']}")
    if not args.execute:
        manifest_path.write_text(json.dumps(data, indent=2) + "\n")
        print("Dry run only; use --execute to submit review-only Vertex requests.")
        return 0
    from google import genai
    from google.genai import types
    from google.genai import errors
    client = genai.Client(vertexai=True, project=args.project, location=args.location)
    references = [types.Part.from_bytes(data=path.read_bytes(), mime_type="image/webp") for path in REFERENCES]
    last_submission = 0.0
    for candidate in jobs:
        pause = args.min_request_interval - (time.monotonic() - last_submission)
        if pause > 0:
            time.sleep(pause)
        print(f"Submitting {candidate['id']} ({candidate['axis']})…", flush=True)
        for attempt in range(args.max_quota_retries + 1):
            try:
                response = client.models.generate_content(
                    model=MODEL,
                    contents=[types.Part.from_text(text=candidate["prompt"]), *references],
                    config=types.GenerateContentConfig(response_modalities=["IMAGE"], image_config=types.ImageConfig(aspect_ratio="16:9", image_size="2K", output_mime_type="image/png")),
                )
                break
            except errors.ClientError as error:
                if error.code != 429 or attempt >= args.max_quota_retries:
                    raise
                print(f"Vertex quota boundary; waiting {args.quota_backoff_seconds:.0f}s before retry {attempt + 2}/{args.max_quota_retries + 1}…", flush=True)
                time.sleep(args.quota_backoff_seconds)
        last_submission = time.monotonic()
        destination = OUTPUT / candidate["path"]
        destination.write_bytes(extract_image(response))
        candidate.update({"sha256": sha256(destination), "sourceDimensions": list(Image.open(destination).size), "generatedAt": datetime.now(UTC).isoformat(), "model": MODEL})
        manifest_path.write_text(json.dumps(data, indent=2) + "\n")
        print(f"Saved {destination.relative_to(ROOT)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
