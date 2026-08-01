#!/usr/bin/env python3
"""Generate review-only WP-11 Intro Panels 2 and 3 with Nano Banana Pro.

Panel 2 is deliberately an image edit of Panel 1 candidate 07, the user's
provisional single-source choice. Neither output is a production asset.
"""

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
MODEL = "gemini-3-pro-image"  # Nano Banana Pro
CONNECTED = ROOT / "artifacts/world-generation/wp11/intro-connected/candidate-07.png"
MOONROOT = ROOT / "assets/worlds/moonroot-ruins/scenes/mode-lantern-grounds/compact/base.webp"
NIX = ROOT / "assets/characters/nix/idle.png"
MODE_LANTERN_DORMANT = ROOT / "assets/worlds/moonroot-ruins/scenes/mode-lantern-grounds/compact/landmark-dormant.webp"

PANELS = {
    "interrupted": {
        "output": ROOT / "artifacts/world-generation/wp11/intro-interrupted",
        "references": (CONNECTED,),
        "axes": (
            ("moonroot-thread", "Stop the Moonroot-to-Starwater connection just before its receiving landmark."),
            ("starwater-thread", "Stop one Starwater connection just before its receiving landmark."),
            ("archive-thread", "Stop the Archive receiving thread while preserving its rail geometry exactly."),
            ("meridian-thread", "Pause the final Meridian connection at its existing receiving mechanism."),
            ("quiet-dormancy", "Use the least dramatic dormant-light balance while keeping one unfinished thread unmistakable."),
        ),
        "prompt": """Use case: precise-object-edit
Asset type: second panel of a three-panel story introduction
Output: one 2K 16:9 polished 2D pixel-art illustration
Input image: the attached image is the exact Panel 1 connected panorama edit target.

Create the second story panel as an exact-state edit of the attached connected panorama. Preserve the exact 16:9 canvas, camera, horizon, crop, region positions, terrain, architecture, waterline, palette, pixel density, atmospheric depth, and lower-third negative space. A crossfade between Panels 1 and 2 must reveal a change in state, not a different painting.

Change harmony into a quiet interruption. One important amber-cyan current should stop a short distance before its receiving landmark, ending in a soft stable unfinished thread rather than a spark. Two other existing connections may drift slightly out of alignment with their existing channels. Restored landmark lights become low dormant embers; one observatory lens rests off-axis; distant archive beacons no longer share a connecting thread; selected Meridian mechanisms pause at visibly different phases. Add only a few suspended mineral or glass fragments where existing structures plausibly contain them. Paths remain traversable, water remains calm, architecture remains intact, and every region is safe.

Communicate an unfinished instruction left relationships incomplete, not war, destruction, corruption, death, danger, or an evil force. Keep the image warm enough to invite restoration.
Constraints: change only the state details described above; preserve all composition and visual invariants exactly. No characters, villain, storm, lightning, explosion, fire, smoke, collapse, red alarm light, weapons, global cracks, black portal, text, symbols, code, UI, captions, logo, or watermark.""",
    },
    "nix-threshold": {
        "output": ROOT / "artifacts/world-generation/wp11/intro-nix-threshold",
        "references": (MOONROOT, NIX, MODE_LANTERN_DORMANT),
        "axes": (
            ("threshold-distance", "Vary only the Nix-to-Mode-Lantern distance while preserving Nix as a small readable silhouette."),
            ("root-framing", "Vary only the gentle rooted threshold framing around the invitation path."),
            ("water-reflection", "Vary only the faint real-water or stone reflection that connects Nix and the dormant landmark."),
            ("environmental-intimacy", "Vary only the degree of environmental intimacy while the landmark and setting remain larger than Nix."),
            ("phone-legibility", "Prioritize a readable Nix and lantern silhouette at a narrow phone crop without turning Nix into a close-up."),
        ),
        "prompt": """Use case: cinematic key art for an original mobile learning game
Asset type: third panel of a three-panel story introduction
Output: one 2K 16:9 polished 2D pixel-art illustration
Input images in fixed order: Image 1 is the approved Moonroot scene and rendering reference; Image 2 is canonical Nix identity reference; Image 3 is the dormant Mode Lantern state reference.

Create an intimate arrival at the threshold of Moonroot Ruins. Preserve the approved Moonroot rendering language, blue-green dusk palette, enormous rooted architecture, mossed dark stone, shallow still water, tiny amber lights, restrained violet spores, turquoise mineral seams, and slightly elevated side-on perspective. The place is ancient, warm, mysterious, and safe.

Place canonical Nix on a real stone or root-supported threshold in the lower middle distance, small enough that the environment remains the protagonist but large enough for the silhouette to read on a phone. Preserve Nix exactly: compact teal-hooded firefly mage; shadowed face with exactly two amber eyes; exactly two antennae; exactly two translucent cream wings; dark teal embroidered hood with warm gold trim; compact brown travel clothes; teal boots; dark wooden square-hook lantern staff. Keep every permanent prop attached and use the same pixel-art proportions and camera angle as Image 2.

Nix stands in a calm capable posture and lifts or angles the lantern staff toward the dormant Mode Lantern at its physically supported terrace. The landmark shows four misaligned nested glass rings around one dim amber core. A single narrow warm light travels from Nix's lantern toward the landmark but stops as a gentle invitation at the outer ring; it does not restore the landmark yet. Let one faint reflection connect the two across real stone or water. Communicate recognition, companionship, and an invitation to learn—not prophecy or rescue.

Reserve broad calm dark environmental space across the lower third for HTML copy without drawing a blank panel. Maintain clear silhouettes around Nix and the landmark; keep high-frequency detail away from the copy zone.
No extra character, duplicate Nix, changed costume, extra limbs, extra wings, missing staff, giant character close-up, heroic battle pose, chosen-one motif, danger, monster, text, speech bubble, runes, letters, code, UI, caption, logo, or watermark.""",
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def mime_type(path: Path) -> str:
    return "image/png" if path.suffix.lower() == ".png" else "image/webp"


def candidate_plan(panel: str) -> dict:
    spec = PANELS[panel]
    return {
        "schemaVersion": 1,
        "kind": "wp11-story-review-candidates",
        "panel": panel,
        "model": MODEL,
        "createdAt": datetime.now(UTC).isoformat(),
        "approval": {"candidateId": None, "approvedAt": None, "notes": "Review-only; no production promotion."},
        "references": [{"path": str(path.relative_to(ROOT)), "sha256": sha256(path)} for path in spec["references"]],
        "candidates": [
            {
                "id": f"candidate-{index:02d}", "axis": axis, "path": f"candidate-{index:02d}.png",
                "approvalState": "pending", "prompt": f"{spec['prompt']}\n\nCOMPARISON AXIS\n{direction}\nChange no other narrative or composition constraint.",
            }
            for index, (axis, direction) in enumerate(spec["axes"], 1)
        ],
    }


def extract_image(response) -> bytes:
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data
    raise RuntimeError("Gemini returned no image output")


def generate(panel: str, args: argparse.Namespace) -> None:
    spec = PANELS[panel]
    missing = [path for path in spec["references"] if not path.is_file()]
    if missing:
        raise SystemExit(f"Missing required reference: {', '.join(map(str, missing))}")
    output = spec["output"]
    output.mkdir(parents=True, exist_ok=True)
    manifest_path = output / "manifest.json"
    data = json.loads(manifest_path.read_text()) if manifest_path.exists() else candidate_plan(panel)
    candidates = [data["candidates"][args.candidate - 1]] if args.candidate else data["candidates"]
    jobs = [candidate for candidate in candidates if not (output / candidate["path"]).is_file()]
    print(f"WP-11 {panel}: {len(jobs)} missing {MODEL} review candidate(s)")
    if not args.execute:
        manifest_path.write_text(json.dumps(data, indent=2) + "\n")
        return
    from google import genai
    from google.genai import errors, types
    client = genai.Client(vertexai=True, project=args.project, location=args.location)
    references = [types.Part.from_bytes(data=path.read_bytes(), mime_type=mime_type(path)) for path in spec["references"]]
    last_submission = 0.0
    for candidate in jobs:
        pause = args.min_request_interval - (time.monotonic() - last_submission)
        if pause > 0:
            time.sleep(pause)
        print(f"Submitting {panel}/{candidate['id']} ({candidate['axis']})…", flush=True)
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
                print(f"Vertex quota boundary; waiting {args.quota_backoff_seconds:.0f}s before retry…", flush=True)
                time.sleep(args.quota_backoff_seconds)
        last_submission = time.monotonic()
        destination = output / candidate["path"]
        destination.write_bytes(extract_image(response))
        candidate.update({"sha256": sha256(destination), "sourceDimensions": list(Image.open(destination).size), "generatedAt": datetime.now(UTC).isoformat(), "model": MODEL})
        manifest_path.write_text(json.dumps(data, indent=2) + "\n")
        print(f"Saved {destination.relative_to(ROOT)}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--panel", choices=tuple(PANELS), action="append")
    parser.add_argument("--candidate", type=int, choices=range(1, 6))
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    parser.add_argument("--location", default=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
    parser.add_argument("--min-request-interval", type=float, default=15)
    parser.add_argument("--quota-backoff-seconds", type=float, default=60)
    parser.add_argument("--max-quota-retries", type=int, default=2)
    args = parser.parse_args()
    if not args.project:
        raise SystemExit("Set GOOGLE_CLOUD_PROJECT or pass --project")
    for panel in args.panel or tuple(PANELS):
        generate(panel, args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
