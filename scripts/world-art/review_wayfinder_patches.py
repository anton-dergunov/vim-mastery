#!/usr/bin/env python3
"""Stage and generate the WP-03P-A Wayfinder full-board edit review batch.

The paid path uses Nano Banana 2 through Vertex AI and application-default
credentials. It never calls an OpenAI image generator. WP-03P-A writes only to
the ignored artifact tree, keeps every decodable Gemini result for human
review, and deliberately performs no diff extraction or aesthetic rejection.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont
from google.genai import errors


ROOT = Path(__file__).resolve().parents[2]
SCENE_ID = "wayfinder-crossroads"
UNIT_ID = "cursor-movement"
SCENE_TITLE = "Wayfinder Crossroads"
MODEL_ID = "gemini-3.1-flash-image"
REVIEW_ROOT = (
    ROOT / "artifacts/world-generation/patch-reviews"
    / SCENE_ID / "round-03"
)
VISIBILITY_METRICS = REVIEW_ROOT / "visibility/metrics.json"
MANIFEST_PATH = REVIEW_ROOT / "approval-manifest.json"
INVENTORY_PATH = REVIEW_ROOT / "object-inventory.json"
LEDGER_PATH = REVIEW_ROOT / "ledger.jsonl"
BASES = {
    profile: ROOT / f"assets/worlds/moonroot-ruins/scenes/{SCENE_ID}/{profile}/base.webp"
    for profile in ("tall", "compact", "wide")
}
LANDMARK_BOUNDS = (0.28, 0.48, 0.44, 0.52)
AVOID_RECURRING_MOTIFS: tuple[str, ...] = ()
PRESERVATION_ANCHORS = "paths, water, stones, roots, bridge, central wayfinder, and outer edges"
PROTECTED_LANDMARK_NAME = "central wayfinder"
WORK_PACKAGE = "WP-03P-A"
ROUND = 3
OUTPUT_COST_USD = 0.067
INPUT_COST_ALLOWANCE_USD = 0.0012


SITES = (
    {
        "id": "northwest-hanging-lantern",
        "surface": "root-and-stone wall",
        "bounds": (0.125, 0.045, 0.12, 0.15),
        "locator": (
            "the small warm amber lantern hanging in a carved wooden bracket "
            "near the upper-left stone steps"
        ),
        "appearance": (
            "a rectangular brass-and-wood lantern with one amber window, "
            "attached to the vertical root beside the upper-left stair"
        ),
        "changes": (
            "Replace it with a closed turquoise crystal seedpod lantern whose facets emit a strong cyan core.",
            "Replace it with a miniature root-grown observatory: a round violet lens held in a brass fork.",
            "Replace it with a hanging glass terrarium containing three large luminous moon mushrooms.",
            "Replace it with an ancient two-bell wayfinding chime, each bell glowing with a different magical color.",
            "Replace it with a compact caged firefly nest shaped like a crescent, clearly unlike the original lantern.",
        ),
    },
    {
        "id": "north-root-mushroom-shelf",
        "surface": "suspended central root",
        "bounds": (0.34, 0.225, 0.19, 0.17),
        "locator": (
            "the thick suspended root crossing the upper-middle water, directly "
            "above the open central paving"
        ),
        "appearance": (
            "a gnarled horizontal brown root with tiny purple mushrooms and "
            "moss, bridging the left tree into the central scene"
        ),
        "changes": (
            "Grow one large tiered shelf of cyan-and-violet luminous mushrooms from the root, with a bold fan silhouette.",
            "Turn the root section into a natural crystal cradle holding one bright floating-looking-but-root-supported moonstone.",
            "Add a tiny root-built waterwheel driven by a narrow magical trickle falling from the root into the pond.",
            "Transform the root section into a sleeping mossy salamander-shaped growth whose body remains visibly fused to the wood.",
            "Open a compact hollow in the root containing an amber fairy workshop with a clearly visible little workbench and lamp.",
        ),
    },
    {
        "id": "east-bridge-travel-cache",
        "surface": "upper-right bridge parapet",
        "bounds": (0.785, 0.135, 0.14, 0.15),
        "locator": (
            "the tiny strapped travel cache resting on the outer parapet of "
            "the upper-right arched stone bridge"
        ),
        "appearance": (
            "a small dark travel box or tied book bundle with a bright teal "
            "strap, supported by the bridge's right parapet"
        ),
        "changes": (
            "Replace the strapped cache with an open miniature spellbook whose pages project a large cyan compass rose made only of light.",
            "Replace it with a squat brass courier automaton perched securely on the parapet, with two bright glass eyes.",
            "Replace it with an open potion case containing three oversized differently shaped glowing bottles.",
            "Replace it with a root-bound crystal radio whose violet tuning rings and antenna make a completely new silhouette.",
            "Replace it with a tiny moss shrine containing a luminous blue moth resting beneath a clear stone arch.",
        ),
    },
    {
        "id": "west-crystal-bank",
        "surface": "far-left stone bank",
        "bounds": (0.0, 0.235, 0.145, 0.18),
        "locator": (
            "the blue crystal cluster embedded in the far-left rock shelf "
            "above the left water channel"
        ),
        "appearance": (
            "a compact cluster of pointed cyan and violet crystals growing "
            "from a dark stone ledge at the left edge"
        ),
        "changes": (
            "Replace the crystal cluster with a large open geode mouth showing concentric violet, cyan, and white mineral rings.",
            "Replace it with a dense family of tall luminous moonflowers rooted in the same stone pocket.",
            "Replace it with a miniature cascading spring emerging from a carved stone animal head and falling into the water.",
            "Replace it with a broad glowing fossil spiral embedded in the bank, surrounded by cracked illuminated stone.",
            "Replace it with a compact root-and-brass beacon whose three wing-like crystal panels are fully unfolded.",
        ),
    },
    {
        "id": "west-stair-satchel",
        "surface": "west stair landing",
        "bounds": (0.17, 0.455, 0.11, 0.16),
        "locator": (
            "the small tan satchel resting on the square stone landing just "
            "left of the central paving and above the descending stairs"
        ),
        "appearance": (
            "a closed tan-brown soft leather bag with straps, supported by a "
            "flat mossy stone landing"
        ),
        "changes": (
            "Open the satchel wide and reveal an oversized glowing turquoise orb nested inside with violet sparkles.",
            "Replace the satchel with a tiny animated-looking treasure mimic chest, mouth open but friendly, firmly sitting on the landing.",
            "Replace it with an unfurled magical map whose bright route lines rise as a small holographic landscape.",
            "Replace it with a compact alchemist kit: one large bubbling flask, two bottles, and a brass burner on the stone.",
            "Transform it into a moss-covered portable shrine with a conspicuous amber doorway and cyan roof crystal.",
        ),
    },
    {
        "id": "southwest-open-rucksack",
        "surface": "lower-left stone shelf",
        "bounds": (0.14, 0.72, 0.14, 0.25),
        "locator": (
            "the larger brown rucksack at the bottom-left, standing on the "
            "small stone shelf beside the dark water"
        ),
        "appearance": (
            "a tall closed brown leather backpack with flap, pockets, straps, "
            "and a rolled item, resting upright on the ledge"
        ),
        "changes": (
            "Open the large rucksack and show a bright glass jar, a rainbow portal disk, scrolls, and crystals spilling magical light upward.",
            "Open it into an impossibly deep starry pocket dimension with one large moon and several floating cyan islands visible inside.",
            "Transform it into a travelling mushroom garden, with three huge colorful luminous caps growing from the open top.",
            "Open it to reveal a compact brass telescope, a folded winged map, and a strongly glowing violet compass.",
            "Replace it with a friendly root-built pack creature curled on the shelf, carrying visibly oversized crystal cargo.",
        ),
    },
    {
        "id": "left-water-lily-drift",
        "surface": "left water channel",
        "bounds": (0.055, 0.42, 0.225, 0.2),
        "locator": (
            "the shallow turquoise water and scattered lily pads immediately "
            "left of the descending central-left stone stairs"
        ),
        "appearance": (
            "calm cyan water with several small green lily pads and faint "
            "horizontal current marks"
        ),
        "changes": (
            "Create one large unmistakable spiral whirlpool made of luminous cyan water, ringed by displaced lily pads.",
            "Grow three enormous violet-and-blue lotus flowers from the water, each fully open and strongly luminous.",
            "Reveal a clearly visible submerged circular ruin with glowing runes abstracted as non-text geometric marks beneath the water.",
            "Add a tiny leaf boat carrying a bright crystal sail, naturally floating and leaving a bold curved wake.",
            "Transform the water into a contained school of five large glowing koi-like spirit fish circling in a readable ring.",
        ),
    },
    {
        "id": "east-river-current",
        "surface": "east water channel",
        "bounds": (0.78, 0.37, 0.22, 0.22),
        "locator": (
            "the deep turquoise river at middle-right below the arched bridge, "
            "including its lily pads but not the stone bridge"
        ),
        "appearance": (
            "a dark cyan channel with horizontal highlights and several green "
            "lily pads between root-covered stone banks"
        ),
        "changes": (
            "Form a bold forked ribbon of bright magical current with two large glowing stepping lilies across it.",
            "Reveal a huge luminous sleeping water dragon eye beneath the surface, clearly contained within the channel.",
            "Add a compact floating root-island with a single oversized violet mushroom and a strong reflected glow.",
            "Turn the current into a circular star-water vortex containing a clearly visible tiny night sky and crescent moon.",
            "Add three large translucent cyan spirit frogs leaping in sequence above the water with coherent splashes.",
        ),
    },
    {
        "id": "east-crystal-bank",
        "surface": "far-right river bank",
        "bounds": (0.885, 0.355, 0.115, 0.2),
        "locator": (
            "the bright crystal cluster on the far-right stone bank beside the "
            "middle-right river"
        ),
        "appearance": (
            "one tall blue-violet crystal with smaller crystals and leafy "
            "plants, rooted in a narrow rock shelf at the right edge"
        ),
        "changes": (
            "Replace it with a broad crystal tree whose cyan trunk supports a clearly visible violet gemstone canopy.",
            "Replace it with an open stone dragon egg containing a brilliant curled crystal hatchling.",
            "Replace it with a large moonflower bell bent over the river and casting a strong cyan reflection.",
            "Replace it with a compact three-tier waterfall shrine built into the bank, each basin glowing differently.",
            "Replace it with an ancient broken brass astrolabe half-reclaimed by roots and emitting a bold circular light.",
        ),
    },
    {
        "id": "southeast-lantern-ledge",
        "surface": "lower-right stone ledge",
        "bounds": (0.895, 0.575, 0.105, 0.2),
        "locator": (
            "the warm amber lantern on the far lower-right ledge, beside the "
            "root-covered stone causeway"
        ),
        "appearance": (
            "a squat brass lantern with one orange flame and circular base, "
            "standing on the outer stone ledge"
        ),
        "changes": (
            "Replace it with a large root-bound crystal brazier holding a bright floating violet flame.",
            "Replace it with three distinct mushroom lanterns of different heights, all rooted in the ledge moss.",
            "Replace it with a compact mechanical firefly lighthouse whose cyan lens projects one broad visible beam.",
            "Replace it with an open stone flower containing a large amber magical flame at its center.",
            "Replace it with a tiny moonwell bowl showing a bright starfield inside and a hovering crescent above it.",
        ),
    },
)


def configure_scene(config_path: Path, round_number: int = 3) -> None:
    """Apply a scene-specific inventory while retaining the reviewed workflow."""
    global SCENE_ID, UNIT_ID, SCENE_TITLE, REVIEW_ROOT, VISIBILITY_METRICS
    global MANIFEST_PATH, INVENTORY_PATH, LEDGER_PATH, BASES, LANDMARK_BOUNDS, SITES
    global AVOID_RECURRING_MOTIFS, PRESERVATION_ANCHORS, PROTECTED_LANDMARK_NAME
    global WORK_PACKAGE, ROUND
    config = json.loads(config_path.read_text())
    SCENE_ID = config["sceneId"]
    UNIT_ID = config["unitId"]
    SCENE_TITLE = config["sceneTitle"]
    ROUND = round_number
    REVIEW_ROOT = ROOT / "artifacts/world-generation/patch-reviews" / SCENE_ID / f"round-{ROUND:02d}"
    VISIBILITY_METRICS = REVIEW_ROOT / "visibility/metrics.json"
    MANIFEST_PATH = REVIEW_ROOT / "approval-manifest.json"
    INVENTORY_PATH = REVIEW_ROOT / "object-inventory.json"
    LEDGER_PATH = REVIEW_ROOT / "ledger.jsonl"
    configured_base = config.get("compactBase")
    BASES = (
        {"compact": ROOT / configured_base}
        if configured_base
        else {
            profile: ROOT / f"assets/worlds/moonroot-ruins/scenes/{SCENE_ID}/{profile}/base.webp"
            for profile in ("tall", "compact", "wide")
        }
    )
    LANDMARK_BOUNDS = tuple(config["landmarkBounds"])
    SITES = tuple(config["sites"])
    AVOID_RECURRING_MOTIFS = tuple(config.get("avoidRecurringMotifs", ()))
    PRESERVATION_ANCHORS = config.get(
        "preservationAnchors",
        "paths, water, stones, roots, bridge, central wayfinder, and outer edges",
    )
    PROTECTED_LANDMARK_NAME = config.get(
        "protectedLandmarkName", "the authored landmark"
    )
    WORK_PACKAGE = config.get("workPackage", "WP-03P-A")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=False) + "\n")


def pixel_box(
    bounds: tuple[float, float, float, float],
    size: tuple[int, int],
) -> tuple[int, int, int, int]:
    x, y, width, height = bounds
    return (
        round(x * size[0]),
        round(y * size[1]),
        round((x + width) * size[0]),
        round((y + height) * size[1]),
    )


def intersects(
    first: tuple[float, float, float, float],
    second: tuple[float, float, float, float],
) -> bool:
    ax, ay, aw, ah = first
    bx, by, bw, bh = second
    return ax < bx + bw and ax + aw > bx and ay < by + bh and ay + ah > by


def parse_focal(value: str) -> tuple[float, float]:
    parts = value.replace("%", "").split()
    if len(parts) != 2:
        return 0.5, 0.5
    return float(parts[0]) / 100, float(parts[1]) / 100


def capture_mask(capture: dict[str, Any], base_size: tuple[int, int]) -> Image.Image:
    width, height = base_size
    world_width = float(capture["world"]["width"])
    world_height = float(capture["world"]["height"])
    inset = float(capture.get("pseudoInsetPixels", 4))
    layer_width = world_width + inset * 2
    layer_height = world_height + inset * 2
    scale = max(layer_width / width, layer_height / height)
    rendered_width = width * scale
    rendered_height = height * scale
    focal_x, focal_y = parse_focal(capture.get("focalPosition", "50% 50%"))
    offset_x = -inset + (layer_width - rendered_width) * focal_x
    offset_y = -inset + (layer_height - rendered_height) * focal_y

    def source_box(world_box: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
        left, top, right, bottom = world_box
        return (
            round((left - offset_x) / scale),
            round((top - offset_y) / scale),
            round((right - offset_x) / scale),
            round((bottom - offset_y) / scale),
        )

    mask = Image.new("L", base_size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle(source_box((0, 0, world_width, world_height)), fill=255)
    for occlusion in capture.get("occlusions", []):
        bounds = occlusion["bounds"]
        draw.rectangle(
            source_box((
                bounds["x"] * world_width,
                bounds["y"] * world_height,
                (bounds["x"] + bounds["width"]) * world_width,
                (bounds["y"] + bounds["height"]) * world_height,
            )),
            fill=0,
        )
    return mask


def site_fraction(mask: Image.Image, bounds: tuple[float, float, float, float]) -> float:
    crop = mask.crop(pixel_box(bounds, mask.size))
    return sum(crop.get_flattened_data()) / (255 * crop.width * crop.height)


def build_visibility_artifacts() -> dict[str, Any]:
    if not VISIBILITY_METRICS.is_file():
        if set(BASES) == {"compact"}:
            return {
                "schemaVersion": 2,
                "status": "deferred-until-live-scene-integration",
                "profiles": {
                    "compact": {
                        "base": str(BASES["compact"].relative_to(ROOT)),
                        "captureIds": [],
                        "captureCount": 0,
                    }
                },
                "compactSiteVisibility": {
                    site["id"]: {"approved-4-3-source": 1.0}
                    for site in SITES
                },
            }
        raise RuntimeError(
            "Run node scripts/world-art/capture_patch_visibility.mjs first"
        )
    metrics = json.loads(VISIBILITY_METRICS.read_text())
    output: dict[str, Any] = {
        "schemaVersion": 2,
        "metrics": str(VISIBILITY_METRICS.relative_to(ROOT)),
        "profiles": {},
    }
    for profile, base_path in BASES.items():
        with Image.open(base_path) as source:
            base = source.convert("RGB")
        captures = [
            capture for capture in metrics["captures"]
            if capture["sceneProfile"] == profile and capture["backdropVisible"]
        ]
        masks = [capture_mask(capture, base.size) for capture in captures]
        counts = [0] * (base.width * base.height)
        for mask in masks:
            counts = [
                total + (pixel > 0)
                for total, pixel in zip(counts, mask.get_flattened_data())
            ]
        maximum = max(1, len(masks))
        overlay = Image.new("RGBA", base.size)
        pixels = []
        for count in counts:
            if count == 0:
                pixels.append((224, 54, 72, 142))
            elif count == maximum:
                pixels.append((50, 220, 132, 82))
            else:
                pixels.append((255, 196, 72, 100))
        overlay.putdata(pixels)
        atlas = base.convert("RGBA")
        atlas.alpha_composite(overlay)
        draw = ImageDraw.Draw(atlas, "RGBA")
        if profile == "compact":
            for site in SITES:
                box = pixel_box(site["bounds"], base.size)
                draw.rectangle(box, outline=(255, 93, 228, 255), width=5)
                draw.text(
                    (box[0] + 4, box[1] + 3),
                    site["id"],
                    fill=(255, 255, 255, 255),
                    stroke_width=2,
                    stroke_fill=(14, 8, 20, 230),
                    font=ImageFont.load_default(size=18),
                )
        atlas_path = REVIEW_ROOT / f"visibility/visibility-atlas-{profile}.png"
        atlas.save(atlas_path, optimize=True)
        output["profiles"][profile] = {
            "base": str(base_path.relative_to(ROOT)),
            "captureIds": [capture["id"] for capture in captures],
            "captureCount": len(captures),
            "atlas": str(atlas_path.relative_to(ROOT)),
        }

    compact_base = Image.open(BASES["compact"])
    compact_captures = [
        capture for capture in metrics["captures"]
        if capture["sceneProfile"] == "compact" and capture["backdropVisible"]
    ]
    compact_masks = [capture_mask(capture, compact_base.size) for capture in compact_captures]
    output["compactSiteVisibility"] = {
        site["id"]: {
            capture["id"]: round(site_fraction(mask, site["bounds"]), 5)
            for capture, mask in zip(compact_captures, compact_masks)
        }
        for site in SITES
    }
    return output


def expanded_bounds(
    bounds: tuple[float, float, float, float],
    margin: float = 0.055,
) -> tuple[float, float, float, float]:
    x, y, width, height = bounds
    left = max(0, x - margin)
    top = max(0, y - margin)
    right = min(1, x + width + margin)
    bottom = min(1, y + height + margin)
    return left, top, right - left, bottom - top


def create_locator(
    base: Image.Image,
    site: dict[str, Any],
    destination: Path,
) -> dict[str, Any]:
    context = expanded_bounds(site["bounds"])
    context_box = pixel_box(context, base.size)
    crop = base.crop(context_box).convert("RGB")
    local_x = site["bounds"][0] - context[0]
    local_y = site["bounds"][1] - context[1]
    local_bounds = (
        local_x / context[2],
        local_y / context[3],
        site["bounds"][2] / context[2],
        site["bounds"][3] / context[3],
    )
    crop.thumbnail((384, 384), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(crop, "RGBA")
    target = pixel_box(local_bounds, crop.size)
    width = max(4, round(min(crop.size) / 70))
    draw.rectangle(target, outline=(255, 28, 213, 255), width=width)
    draw.rectangle(
        (0, 0, crop.width, 30),
        fill=(13, 10, 24, 226),
    )
    draw.text(
        (7, 7),
        f"LOCATOR ONLY: {site['id']}",
        fill=(255, 255, 255, 255),
        font=ImageFont.load_default(size=16),
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    crop.save(destination, optimize=True)
    return {
        "path": str(destination.relative_to(ROOT)),
        "sha256": sha256(destination),
        "dimensions": list(crop.size),
        "contextBounds": dict(zip(("x", "y", "width", "height"), context)),
        "targetBoundsInFullBoard": dict(
            zip(("x", "y", "width", "height"), site["bounds"])
        ),
    }


def candidate_prompt(site: dict[str, Any], change: str) -> str:
    recurring_motifs = "; ".join(AVOID_RECURRING_MOTIFS)
    return f"""Use case: precise-object-edit
Asset type: one complete 4:3 Vim Wilds environmental board candidate

INPUT ROLES
- Image 1 is the approved complete {SCENE_TITLE} board and the exact edit target.
- Image 2 is a locator crop from Image 1. Its magenta rectangle and label are reference markup only. Never reproduce that rectangle, label, crop framing, or any other markup.

TARGET
- Location: {site["locator"]}.
- Existing object/material: {site["appearance"]}.
- Support surface: {site["surface"]}.

PRIMARY EDIT
{change}

PRESERVATION IS THE MAIN REQUIREMENT
Return the complete board, not a crop. Keep the canvas, framing, camera, perspective, {PRESERVATION_ANCHORS}, every other prop, all edge content, palette, lighting, pixel-art rendering, and spatial relationships as close to Image 1 as possible. Change only the named target and the few immediately adjacent pixels needed for contact, shadow, reflection, or local magical glow. The replacement must be physically attached to or supported by the named surface. Preserve the whole generated board so its lighting changes remain coherent during the runtime crossfade.

The target itself must change substantially: it needs an unmistakably new silhouette and content that remains legible when the complete board is displayed small. Do not settle for a tint, brightness shift, tiny sparkles, or a nearly identical version of the existing object.

SERIES VARIETY
This board is part of a curated series. Do not use these recurring concepts in this candidate: {recurring_motifs or "none specified"}. Invent the specifically requested replacement rather than substituting a familiar generic magical prop.

Avoid: changes elsewhere; warped or redrawn board geometry; altered {PROTECTED_LANDMARK_NAME} or outer edges; relocated objects; extra unrelated magical effects; characters; text; letters; numbers; code; UI; locator markup; watermark; photorealism; smooth 3D rendering.

Output exactly one complete 1K 4:3 PNG image."""


def stage() -> None:
    if MANIFEST_PATH.is_file():
        existing = json.loads(MANIFEST_PATH.read_text())
        generated_count = sum(
            bool(candidate.get("output"))
            for candidate in existing.get("candidates", [])
        )
        if generated_count:
            print(
                f"Already staged with {generated_count} generated candidate(s); "
                "preserving the resumable manifest"
            )
            return
    for site in SITES:
        if intersects(site["bounds"], LANDMARK_BOUNDS):
            raise RuntimeError(
                f"{site['id']} overlaps protected landmark {PROTECTED_LANDMARK_NAME}"
            )
        if len(site["changes"]) != 5:
            raise RuntimeError(f"{site['id']} must define five candidate changes")
    missing = [path for path in BASES.values() if not path.is_file()]
    if missing:
        raise RuntimeError(f"Missing scene bases: {', '.join(map(str, missing))}")

    visibility = build_visibility_artifacts()
    with Image.open(BASES["compact"]) as source:
        base = source.convert("RGB")
    full_board = REVIEW_ROOT / f"inputs/{SCENE_ID}-compact-base.png"
    full_board.parent.mkdir(parents=True, exist_ok=True)
    base.save(full_board, optimize=True)

    inventory = {
        "schemaVersion": 2,
        "purpose": "Gemini prompt inventory; compact source sites are reauthored per responsive profile only after human selection",
        "unitId": UNIT_ID,
        "sceneId": SCENE_ID,
        "fullBoard": {
            "path": str(full_board.relative_to(ROOT)),
            "sha256": sha256(full_board),
            "dimensions": list(base.size),
            "mediaType": "image/png",
        },
        "visibility": visibility,
        "protectedRegions": {
            "authoredLandmark": dict(
                zip(("x", "y", "width", "height"), LANDMARK_BOUNDS)
            ),
        },
        "sites": [],
    }
    manifest = {
        "schemaVersion": 3,
        "workPackage": WORK_PACKAGE,
        "unitId": UNIT_ID,
        "sceneId": SCENE_ID,
        "round": 3,
        "provider": "Google Vertex AI",
        "authentication": "application-default-credentials",
        "model": MODEL_ID,
        "inputPolicy": "full-board-plus-boxed-locator",
        "generationPolicy": "full-board-edit-no-local-compositing",
        "reviewPolicy": "human-only-aesthetic-selection",
        "createdAt": datetime.now(UTC).isoformat(),
        "approvalState": "pending-human-selection",
        "requiredWinnerCount": 10,
        "winnerPolicy": "any ten explicit candidates; multiple winners may share one semantic site",
        "candidates": [],
    }
    for site in SITES:
        locator_path = REVIEW_ROOT / f"inputs/locators/{site['id']}.png"
        locator = create_locator(base, site, locator_path)
        visibility_values = visibility["compactSiteVisibility"].get(site["id"], {})
        inventory["sites"].append({
            "id": site["id"],
            "surface": site["surface"],
            "locatorDescription": site["locator"],
            "existingAppearance": site["appearance"],
            "compactBounds": dict(
                zip(("x", "y", "width", "height"), site["bounds"])
            ),
            "compactVisibilityByCapture": visibility_values,
            "responsivePolicy": (
                "Do not reuse these normalized bounds in tall or wide. "
                "WP-03P-B must locate the corresponding object or a suitable "
                "profile-specific support surface."
            ),
            "transformationIdeas": list(site["changes"]),
            "locatorImage": locator,
        })
        for ordinal, change in enumerate(site["changes"], 1):
            candidate_id = f"{site['id']}-c{ordinal:02d}"
            manifest["candidates"].append({
                "id": candidate_id,
                "siteId": site["id"],
                "ordinal": ordinal,
                "transformation": change,
                "prompt": candidate_prompt(site, change),
                "inputs": [
                    {
                        "role": "exact-full-board-edit-target",
                        "path": str(full_board.relative_to(ROOT)),
                        "sha256": sha256(full_board),
                        "mediaType": "image/png",
                    },
                    {
                        "role": "boxed-locator-reference-only",
                        **locator,
                        "mediaType": "image/png",
                    },
                ],
                "output": None,
                "boxedReview": None,
                "approvalState": "pending",
                "mechanicalValidation": "not-generated",
            })
    write_json(INVENTORY_PATH, inventory)
    write_json(MANIFEST_PATH, manifest)
    print(
        f"Staged {len(inventory['sites'])} sites and "
        f"{len(manifest['candidates'])} full-board Gemini jobs"
    )
    print(f"Manifest: {MANIFEST_PATH.relative_to(ROOT)}")


def extract_image(response: Any) -> bytes:
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data
    raise RuntimeError(f"Gemini returned no image: {response}")


def default_project() -> str:
    configured = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
    if configured:
        return configured
    try:
        result = subprocess.run(
            ["gcloud", "config", "get-value", "project"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return ""
    value = result.stdout.strip()
    return "" if value == "(unset)" else value


def append_ledger(event: dict[str, Any]) -> None:
    LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER_PATH.open("a") as handle:
        handle.write(json.dumps({
            "timestamp": datetime.now(UTC).isoformat(),
            **event,
        }) + "\n")


def estimated_spend() -> float:
    if not LEDGER_PATH.is_file():
        return 0.0
    return sum(
        float(json.loads(line).get("estimatedCostUsd", 0))
        for line in LEDGER_PATH.read_text().splitlines()
        if line.strip() and json.loads(line).get("event") == "submitted"
    )


def make_review(
    source: Path,
    candidate: dict[str, Any],
    inventory: dict[str, Any],
) -> Path:
    site = next(item for item in inventory["sites"] if item["id"] == candidate["siteId"])
    with Image.open(source) as generated:
        review = generated.convert("RGB")
    box = pixel_box(tuple(site["compactBounds"].values()), review.size)
    draw = ImageDraw.Draw(review, "RGBA")
    width = max(4, round(review.width / 240))
    draw.rectangle(box, outline=(255, 49, 218, 255), width=width)
    label = f"{SCENE_ID} / {candidate['id']}"
    label_width = min(review.width - 24, max(300, len(label) * 13))
    draw.rounded_rectangle(
        (12, 12, 12 + label_width, 54),
        radius=8,
        fill=(6, 15, 18, 230),
    )
    draw.text(
        (24, 24),
        label,
        fill=(255, 246, 222, 255),
        font=ImageFont.load_default(size=21),
    )
    destination = REVIEW_ROOT / f"review/{candidate['id']}.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    review.save(destination, optimize=True)
    return destination


def generate(args: argparse.Namespace) -> None:
    if not MANIFEST_PATH.is_file() or not INVENTORY_PATH.is_file():
        raise RuntimeError("Run stage before generate")
    if not args.project:
        raise RuntimeError("Set GOOGLE_CLOUD_PROJECT or pass --project")
    manifest = json.loads(MANIFEST_PATH.read_text())
    inventory = json.loads(INVENTORY_PATH.read_text())
    pending = [
        candidate for candidate in manifest["candidates"]
        if not candidate.get("output")
    ]
    if args.limit is not None:
        pending = pending[:args.limit]
    unit_cost = OUTPUT_COST_USD + INPUT_COST_ALLOWANCE_USD
    projected = estimated_spend() + len(pending) * unit_cost
    print(
        f"Gemini full-board plan: {len(pending)} request(s); "
        f"estimated round spend after completion ${projected:.2f} "
        f"(budget ${args.budget_usd:.2f})"
    )
    if projected > args.budget_usd + 1e-9:
        raise RuntimeError("Budget cap would be exceeded")
    if not args.execute:
        print("Dry run only; add --execute to submit paid Vertex requests.")
        return

    from google import genai
    from google.genai import types

    client = genai.Client(
        vertexai=True,
        project=args.project,
        location=args.location,
    )
    full_board = ROOT / inventory["fullBoard"]["path"]
    last_submission = 0.0
    for candidate in pending:
        locator = ROOT / candidate["inputs"][1]["path"]
        delay = args.min_request_interval - (time.monotonic() - last_submission)
        if delay > 0:
            time.sleep(delay)
        print(f"Submitting {candidate['id']}…", flush=True)
        for attempt in range(args.max_quota_retries + 1):
            try:
                response = client.models.generate_content(
                    model=MODEL_ID,
                    contents=[
                        types.Part.from_text(text=candidate["prompt"]),
                        types.Part.from_bytes(
                            data=full_board.read_bytes(),
                            mime_type="image/png",
                        ),
                        types.Part.from_bytes(
                            data=locator.read_bytes(),
                            mime_type="image/png",
                        ),
                    ],
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE"],
                        image_config=types.ImageConfig(
                            aspect_ratio="4:3",
                            image_size="1K",
                            output_mime_type="image/png",
                        ),
                    ),
                )
                break
            except errors.ClientError as error:
                if error.code != 429 or attempt >= args.max_quota_retries:
                    append_ledger({
                        "event": "request-rejected",
                        "candidateId": candidate["id"],
                        "model": MODEL_ID,
                        "reason": str(error),
                    })
                    raise
                print(
                    f"Vertex quota boundary; waiting {args.quota_backoff_seconds:.0f}s "
                    f"before retry {attempt + 2}/{args.max_quota_retries + 1}…",
                    flush=True,
                )
                time.sleep(args.quota_backoff_seconds)
        last_submission = time.monotonic()
        append_ledger({
            "event": "submitted",
            "candidateId": candidate["id"],
            "model": MODEL_ID,
            "estimatedCostUsd": round(unit_cost, 6),
        })
        destination = REVIEW_ROOT / f"generated/{candidate['id']}.png"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(extract_image(response))
        with Image.open(destination) as image:
            image.verify()
        with Image.open(destination) as image:
            dimensions = list(image.size)
            ratio = image.width / image.height
        if abs(ratio - 4 / 3) > 0.02:
            validation: Any = {
                "status": "warning",
                "reason": "Gemini output aspect ratio differs from requested 4:3",
                "dimensions": dimensions,
            }
        else:
            validation = {
                "status": "passed",
                "dimensions": dimensions,
                "scope": "decode and aspect ratio only; aesthetic review is human",
            }
        review = make_review(destination, candidate, inventory)
        candidate.update({
            "output": {
                "path": str(destination.relative_to(ROOT)),
                "sha256": sha256(destination),
                "dimensions": dimensions,
                "mediaType": "image/png",
            },
            "boxedReview": {
                "path": str(review.relative_to(ROOT)),
                "sha256": sha256(review),
            },
            "generatedAt": datetime.now(UTC).isoformat(),
            "mechanicalValidation": validation,
        })
        write_json(MANIFEST_PATH, manifest)
        append_ledger({
            "event": "completed",
            "candidateId": candidate["id"],
            "path": str(destination.relative_to(ROOT)),
            "sha256": sha256(destination),
        })
        print(f"Saved {destination.relative_to(ROOT)}", flush=True)


def status() -> None:
    if not MANIFEST_PATH.is_file():
        print("Not staged")
        return
    manifest = json.loads(MANIFEST_PATH.read_text())
    generated = [item for item in manifest["candidates"] if item.get("output")]
    approved = [
        item for item in manifest["candidates"]
        if item.get("approvalState") == "approved"
    ]
    print(
        f"{SCENE_ID} round {ROUND:02d}: {len(generated)}/{len(manifest['candidates'])} generated; "
        f"{len(approved)}/{manifest['requiredWinnerCount']} explicitly approved; "
        f"estimated spend ${estimated_spend():.2f}"
    )


def approve_all() -> None:
    """Record an explicit owner decision to retain every generated candidate."""
    manifest = json.loads(MANIFEST_PATH.read_text())
    missing = [
        candidate["id"]
        for candidate in manifest["candidates"]
        if not candidate.get("output")
        or not (ROOT / candidate["output"]["path"]).is_file()
    ]
    if missing:
        raise RuntimeError(
            "Cannot approve all until every candidate has a generated output: "
            + ", ".join(missing)
        )
    for candidate in manifest["candidates"]:
        candidate["approvalState"] = "approved"
    manifest["approvalState"] = "owner-approved-all"
    manifest["requiredWinnerCount"] = len(manifest["candidates"])
    manifest["winnerPolicy"] = "owner explicitly approved every generated candidate"
    manifest["approvedAt"] = datetime.now(UTC).isoformat()
    write_json(MANIFEST_PATH, manifest)
    print(f"Recorded owner approval for all {len(manifest['candidates'])} candidates")


def approve_present() -> None:
    """Approve every extant output while retaining deleted outputs for replacement."""
    manifest = json.loads(MANIFEST_PATH.read_text())
    present = []
    missing = []
    for candidate in manifest["candidates"]:
        output = candidate.get("output")
        if output and (ROOT / output["path"]).is_file():
            candidate["approvalState"] = "approved"
            present.append(candidate["id"])
        else:
            candidate["approvalState"] = "replacement-required"
            missing.append(candidate["id"])
    manifest["approvalState"] = "owner-approved-present-outputs"
    manifest["requiredWinnerCount"] = len(present)
    manifest["winnerPolicy"] = "owner approved every extant output; deleted outputs require a replacement round"
    manifest["approvedAt"] = datetime.now(UTC).isoformat()
    write_json(MANIFEST_PATH, manifest)
    print(f"Recorded owner approval for {len(present)} extant candidates; {len(missing)} replacement(s) required")


def stage_replacements(from_round: int) -> None:
    """Stage only deleted candidates in a clean later review round."""
    source_root = ROOT / "artifacts/world-generation/patch-reviews" / SCENE_ID / f"round-{from_round:02d}"
    source_manifest_path = source_root / "approval-manifest.json"
    source_inventory_path = source_root / "object-inventory.json"
    if not source_manifest_path.is_file() or not source_inventory_path.is_file():
        raise RuntimeError(f"Missing source round {from_round:02d} for {SCENE_ID}")
    if MANIFEST_PATH.is_file():
        existing = json.loads(MANIFEST_PATH.read_text())
        if any(candidate.get("output") for candidate in existing.get("candidates", [])):
            print(f"Replacement round {ROUND:02d} already has generated output; preserving it")
            return
    source_manifest = json.loads(source_manifest_path.read_text())
    replacements = [
        candidate for candidate in source_manifest["candidates"]
        if candidate.get("output") and not (ROOT / candidate["output"]["path"]).is_file()
    ]
    if not replacements:
        print(f"No deleted outputs found in {SCENE_ID} round {from_round:02d}")
        return
    manifest = {
        **source_manifest,
        "round": ROUND,
        "createdAt": datetime.now(UTC).isoformat(),
        "approvalState": "pending-human-selection",
        "requiredWinnerCount": len(replacements),
        "winnerPolicy": "all owner-approved replacement candidates",
        "replacementOfRound": from_round,
        "candidates": [],
    }
    for source in replacements:
        candidate = {**source}
        candidate["output"] = None
        candidate["boxedReview"] = None
        candidate["approvalState"] = "pending"
        candidate["mechanicalValidation"] = "not-generated"
        candidate.pop("generatedAt", None)
        manifest["candidates"].append(candidate)
    write_json(INVENTORY_PATH, json.loads(source_inventory_path.read_text()))
    write_json(MANIFEST_PATH, manifest)
    print(f"Staged {len(replacements)} deleted candidate replacement(s) in round {ROUND:02d}")


def promote() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text())
    winners = [
        candidate for candidate in manifest["candidates"]
        if candidate.get("approvalState") == "approved"
    ]
    if len(winners) != manifest["requiredWinnerCount"]:
        raise RuntimeError(
            "WP-03P-B is locked until the manifest's explicitly approved candidate count is met"
        )
    if not winners:
        raise RuntimeError("WP-03P-B requires at least one explicitly approved candidate")
    destination_root = ROOT / f"assets/worlds/moonroot-ruins/scenes/{SCENE_ID}/variants"
    destination_root.mkdir(parents=True, exist_ok=True)
    for candidate in winners:
        source = ROOT / candidate["output"]["path"]
        if not source.is_file():
            raise RuntimeError(f"Missing approved candidate output: {source}")
        destination = destination_root / f"{candidate['id']}.png"
        shutil.copy2(source, destination)
    manifest["promotion"] = {
        "workPackage": "WP-03P-B",
        "promotedAt": datetime.now(UTC).isoformat(),
        "destination": str(destination_root.relative_to(ROOT)),
        "candidateIds": [candidate["id"] for candidate in winners],
    }
    write_json(MANIFEST_PATH, manifest)
    print(f"Promoted {len(winners)} approved variants to {destination_root.relative_to(ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--scene-config",
        type=Path,
        help="JSON inventory for another approved scene; preserves the Wayfinder default",
    )
    parser.add_argument("--round", type=int, default=3, help="review round number (default: 3)")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("stage")
    replacements = subparsers.add_parser("stage-replacements")
    replacements.add_argument("--from-round", type=int, default=3)
    generator = subparsers.add_parser("generate")
    generator.add_argument("--execute", action="store_true")
    generator.add_argument("--project", default=default_project())
    generator.add_argument(
        "--location",
        default=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
    )
    generator.add_argument("--limit", type=int)
    generator.add_argument("--budget-usd", type=float, default=4.0)
    generator.add_argument("--min-request-interval", type=float, default=15.0)
    generator.add_argument("--quota-backoff-seconds", type=float, default=75.0)
    generator.add_argument("--max-quota-retries", type=int, default=2)
    subparsers.add_parser("status")
    subparsers.add_parser("approve-all")
    subparsers.add_parser("approve-present")
    subparsers.add_parser("promote")
    args = parser.parse_args()
    if args.scene_config:
        configure_scene(args.scene_config, args.round)
    if args.command == "stage":
        stage()
    elif args.command == "generate":
        generate(args)
    elif args.command == "approve-all":
        approve_all()
    elif args.command == "approve-present":
        approve_present()
    elif args.command == "stage-replacements":
        stage_replacements(args.from_round)
    elif args.command == "status":
        status()
    else:
        promote()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
