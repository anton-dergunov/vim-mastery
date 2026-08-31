#!/usr/bin/env python3
"""Generate approval-gated unit-scene backdrop candidates with Nano Banana 2."""

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
)
MODEL = "gemini-3.1-flash-image"

REGION_STYLES = {
    "starwater-sanctuary": (
        "Starwater Sanctuary",
        "a nocturnal sanctuary built across dark reflective water: distant glass observatory structures, slim stone islands, star reflections, translucent reeds, pale cyan and violet light, and sparse warm-gold navigation points. The space feels precise, open and contemplative. Suggest lenses, alignment and reflection through architecture without symbols or writing. Avoid outer space, modern science equipment and neon cyberpunk clutter.",
    ),
    "archive-of-echoes": (
        "Archive of Echoes",
        "a warm subterranean archive carved into dark stone: crystal drawers, suspended shelves, distant beacons and quiet clockwork forms. Use teal glass, muted brass, amber memory lights and violet shadows. The place is cozy, wondrous and ordered, with repeated architectural rhythms. Avoid readable books, labels, dusty realism and steampunk clutter.",
    ),
    "brass-meridian": (
        "Brass Meridian",
        "a vast precision workshop and command observatory beneath a dark ridge: brass rails, copper conduits, glass lenses, controlled ember light and narrow cyan currents. The space feels powerful, exact and welcoming. Use endpoints, routes, pattern alignment and coordinated mechanisms as abstract spatial motifs. Avoid smoke, weapons, factories, grim industrial decay and excessive gears.",
    ),
}

UNITS = {
    "precision-motions-search": {
        "sceneId": "starneedle-observatory", "worldId": "starwater-sanctuary",
        "location": "the Starneedle Observatory terrace spanning still mirror-water",
        "landmark": "a slim stone observatory needle holding a floating glass lens aligned with a distant star reflection",
        "meaning": "precision comes from deliberately focusing on distant signs and exact points",
    },
    "text-objects": {
        "sceneId": "nested-garden", "worldId": "starwater-sanctuary",
        "location": "the Nested Garden of concentric glass arches and water terraces",
        "landmark": "three materially nested translucent stone-and-glass arches rooted in separate shallow terraces",
        "meaning": "nearby boundaries reveal the larger shapes that contain them",
    },
    "visual-selection": {
        "sceneId": "prism-crossing", "worldId": "starwater-sanctuary",
        "location": "Prism Crossing, where glass-pane bridges meet over reflective water",
        "landmark": "three broad pivoting glass panes on supported stone piers, each with a clearly different silhouette",
        "meaning": "one place can be traversed as a ribbon, a row or a block",
    },
    "registers-putting": {
        "sceneId": "memory-archive", "worldId": "archive-of-echoes",
        "location": "the Memory Archive cabinet chamber carved into quiet dark stone",
        "landmark": "a large built-in crystal drawer cabinet with one open drawer receiving a glowing memory vial",
        "meaning": "what is captured can be retained, chosen and placed deliberately",
    },
    "long-range-navigation": {
        "sceneId": "far-beacons", "worldId": "archive-of-echoes",
        "location": "the Far Beacon passage across a deep archive ravine",
        "landmark": "two distant brass-and-teal beacons connected by a thin supported thread of light over a causeway",
        "meaning": "great distances can be crossed and returned from without losing place",
    },
    "repeatable-editing": {
        "sceneId": "echo-clock", "worldId": "archive-of-echoes",
        "location": "the Echo Clock gallery of quiet repeating mechanisms",
        "landmark": "one large controlled clock wheel whose motion visibly propagates through three smaller related wheels",
        "meaning": "one well-shaped change can travel farther than a single moment",
    },
    "command-line-ranges-line-operations": {
        "sceneId": "meridian-table", "worldId": "brass-meridian",
        "location": "the Meridian Table route chamber beneath the dark ridge",
        "landmark": "a broad brass route table with two grounded endpoint markers joined by one narrow cyan current",
        "meaning": "exact endpoints define a route that a command current can follow",
    },
    "substitution-practical-regex": {
        "sceneId": "mirror-loom", "worldId": "brass-meridian",
        "location": "the Mirror Loom hall of glass lenses and copper threads",
        "landmark": "a supported lens-and-loom mechanism where only a selected set of glowing threads changes colour",
        "meaning": "patterns can be found and transformed without changing what does not match",
    },
    "macros": {
        "sceneId": "echo-foundry", "worldId": "brass-meridian",
        "location": "the Echo Foundry of recorder cylinders and replay mechanisms",
        "landmark": "a brass recorder cylinder linked by real conduits to three coordinated mechanisms replaying one movement",
        "meaning": "a complete sequence can be recorded and replayed without forgetting a step",
    },
    "global-normal-automation": {
        "sceneId": "meridian-engine", "worldId": "brass-meridian",
        "location": "the Meridian Engine convergence chamber where all restored routes meet",
        "landmark": "a monumental but welcoming brass-and-glass current junction that subtly echoes root, archive and prism materials",
        "meaning": "range, pattern, repetition and judgment can move together through one coordinated system",
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

FUTURE_CANDIDATE_DIRECTIONS = (
    ("landmark-destination", "Make the protected landmark a believable place integrated into architecture or terrain; it may be off-centre, but it must stand on or attach to a real support."),
    ("environmental-vista", "Lead with a memorable regional vista; let the landmark support the composition rather than dominate it."),
    ("path-and-arrival", "Compose around a path, bridge, stair, watercourse, rail, threshold, or line of light that leads through the scene without forming an empty central stage."),
    ("intimate-place", "Move closer to tactile stone, glass, roots, rails, water, shelves, or small lived-in details while preserving useful depth."),
    ("asymmetric-experiment", "Use a strong asymmetric composition and one surprising but coherent spatial idea; do not default to a central portal."),
)

# Revision two intentionally does not attach adjacent complete boards. The first
# run showed that they over-conditioned Nano Banana on prior composition rather
# than merely preserving the shared pixel-art language. This single style plate
# has no scene landmark or camera to imitate.
FUTURE_REVISION_TWO_REFERENCES = (ROOT / "assets/enchanted-ruins.png",)

# Session 23 deliberately keeps future and reserve boards out of the curriculum
# catalog. These semantic ids are nevertheless generated in the same approval
# workflow as existing unit scenes so every source, reference and output remains
# resumable and auditable.
FUTURE_SCENES = {
    "viewport-control": {
        "sceneId": "beacon-glass-gallery",
        "worldId": "archive-of-echoes",
        "title": "Beacon Glass Gallery",
        "references": (
            ROOT / "assets/worlds/archive-of-echoes/scenes/far-beacons/compact/base.webp",
            ROOT / "assets/worlds/archive-of-echoes/scenes/echo-clock/compact/base.webp",
        ),
        "prompt": """Create a new original Archive of Echoes location called the Beacon Glass Gallery. This is the clear interior viewing chamber reached immediately after the Far Beacons and immediately before the Echo Clock.

Build a long, physically believable archive balcony across a deep violet stone chamber. Anchor one large teal-glass viewing lens in a thick brass carriage on real floor rails or wall pivots, positioned off-centre and readable on a phone. The carriage may travel vertically or settle at upper, middle, and lower framing stops, but do not mark those stops with symbols. Through and around the lens, show layered archive depth: a far shore, one distant beacon glow, suspended shelves, supported causeways, and a corridor whose restrained circular brass rhythm quietly anticipates the Echo Clock. The same distant place should be visible at more than one scale through nested glass or adjacent apertures, expressing reframing without physical travel. Add localized haze or condensation only where it helps the lens read; the room itself remains clear and safe.

Regional art bible: a warm subterranean archive carved into dark plum and charcoal stone, with crystal drawers, suspended shelves, quiet mechanisms, teal glass, muted brass, amber memory lights, and violet shadows. It is cozy, wondrous, ordered, and deep.

Conceptual feeling: the observer can look far ahead, close at hand, or shift the window while remaining securely in one place. Communicate this through supported lens mechanics, repeated framing, depth, and a stable observation floor—not through camera UI, arrows, scrollbars, or diagrams.

Keep the lens silhouette, far-shore cue, entrance from the beacons, and exit toward the clock legible around the covered area. One unmistakable protected lens site must later support dormant and restored states. Avoid: reusing the paired Far Beacons as the main landmark; a giant clock as the main landmark; telescope cliché; camera viewfinder; picture frame; floating screen; editor-shaped cavity; central black portal; steampunk clutter.""",
    },
    "real-code-workflow-capstones": {
        "sceneId": "menders-confluence",
        "worldId": "brass-meridian",
        "title": "Menders' Confluence",
        "references": (
            ROOT / "assets/worlds/brass-meridian/scenes/meridian-engine/compact/base.webp",
            ROOT / "assets/worlds/story/ending/restored-wilds.png",
        ),
        "prompt": """Create a new original Brass Meridian location called Menders' Confluence, an operational repair annex immediately beyond the restored Meridian Engine. It is where difficult, irregular work from across the four Wilds is brought together after the great systems have awakened.

Build a welcoming, smaller-scale multi-level workshop annex into the dark ridge, dominated by Brass Meridian stone, copper rails, glass conduits, controlled ember light, and narrow cyan current. It should feel physically downstream from the monumental Meridian Engine but deliberately more tactile and human in scale. Anchor a broad, physically supported mender's bench or assembly dais off-centre. Give it four materially distinct but harmonized work bays connected by real clamps, rails, and conduits: one moss-dark stone and root detail recalling Moonroot, one pale lens or water-glass detail recalling Starwater, one teal archive-glass drawer detail recalling the Archive of Echoes, and one brass current fixture native to the Meridian. These are transported materials inside one coherent workshop, not four biomes pasted together. Show several incomplete but safe repair tasks of different shapes and scales, with a clear inspection route between them and an outgoing service corridor toward the next location.

The scene should suggest judgment before action: some repairs suit a clamp, some a lens, some a repeated jig, and some careful hand inspection. Express choice and composition through distinct grounded mechanisms and routes, never through tool icons, labels, command symbols, or a literal coding desk. The workshop is busy in structure but calm in state; restoration is complete and ordinary craft has begun.

Regional art bible: a vast precision workshop and command observatory beneath a dark ridge, using charcoal stone, aged brass, copper conduits, thick supported glass, controlled ember light, and narrow cyan current. Powerful, exact, warm, and safe. Avoid smoke, weapons, factory grime, oppressive industry, or excessive gears.

Keep the mender's bench silhouette, at least two contrasting work bays, the incoming Engine current, and the outgoing service route legible around the covered area. One protected bench site must later support dormant and restored story treatment. Avoid: four-way split-screen collage; miniature versions of existing landmarks; literal computer workstation; monitors; terminal window; tool icons; giant central portal; floating tools; unsafe sparks; steampunk clutter.""",
    },
    "mastery-loops": {
        "sceneId": "keepers-relay",
        "worldId": "brass-meridian",
        "title": "Keeper's Relay",
        "references": (
            ROOT / "assets/worlds/brass-meridian/scenes/meridian-engine/compact/base.webp",
            ROOT / "assets/worlds/story/ending/restored-wilds.png",
        ),
        "prompt": """Create a new original Brass Meridian location called Keeper's Relay, an open-air ridge station reached after Menders' Confluence and before the final view of the restored Wilds. It turns restored power into patient, repeated stewardship.

Build a high but welcoming rail-and-stone waystation on the exterior of the dark ridge. Anchor one broad circular relay mechanism into a real terrace or bridge junction, with several distinct supported route loops that leave, pass through small maintenance stations, and visibly return. Include one separate outward dispatch rail or glass conduit that continues toward distant safe lights. The loops must read as physical routes at different depths, not as a progress chart or diagram. Add a compact field-note alcove made from blank glass slips, unlabeled message capsules, or sealed drawers, suggesting knowledge that can be carried across many destinations without displaying writing.

Let the horizon quietly connect the four established regions through material and light rather than a theme-park panorama: moss-dark masonry at one near support, a pale Starwater reflection far below, teal Archive glass in relay housings, and Brass Meridian rails and amber lamps as the dominant structure. The station is already functioning. Some routes are ready for practice, some are cooling after use, and one path remains open beyond the frame. The emotional note is ongoing care, curiosity, and freedom—not graduation pomp or another emergency.

Regional art bible: Brass Meridian precision architecture opened to a calm blue-violet horizon, with charcoal ridge stone, aged brass, copper rails, supported glass conduits, narrow cyan current, restrained amber navigation lights, and subtle material echoes from the restored Wilds. Exact, expansive, safe, and lived in.

Keep the relay silhouette, one returning loop, one outward route, and the open horizon legible around the covered area. One protected relay site must later support a story state. Avoid: literal flowchart; progress rings; game level map; checklist; command prompt; readable field notes; arrows; fifth-world portal; graduation stage; trophy; giant central doorway; floating routes; unsafe height without rails.""",
    },
    "mosslight-landing": {
        "sceneId": "mosslight-landing",
        "worldId": "moonroot-ruins",
        "title": "Mosslight Landing",
        "references": (
            ROOT / "assets/worlds/story/intro/nix-at-the-threshold.png",
            ROOT / "assets/worlds/moonroot-ruins/scenes/mode-lantern-grounds/compact/base.webp",
        ),
        "prompt": """Create a new original Moonroot Ruins location called Mosslight Landing, a small safe foothold immediately inside the threshold and before the Mode Lantern Grounds.

Build an intimate root-sheltered landing of mossed dark stone beside shallow still water. A broad traversable path should arrive from a real threshold at one edge, cross a modest supported footbridge or stepping terrace, and continue toward a distant warm glow that plausibly leads to the Mode Lantern without showing a duplicate lantern landmark. Give the landing one quiet scenic anchor: a root-and-brass trail chime, a cluster of nested stone cups catching luminous water, or a low supported cairn with one dim amber core. Include cyan mushrooms, restrained violet spores, turquoise mineral seams, ferns, lily reflections, old arches, and tiny signs of a cared-for travel stop such as an unlabeled satchel niche or empty resting shelf.

The scene should feel like the first moment when the Wilds listens back: inviting, responsive, ancient, and safe. Keep the magic localized and modest. This is a beginning, not a grand gate, prophecy, shrine, classroom, or tutorial screen.

Regional art bible: Moonroot's blue-green dusk, enormous roots integrated with mossed charcoal stone, shallow reflective water, turquoise mineral light, small cyan and violet growths, and sparse warm amber guidance.

Keep the arrival edge, forward path, waterline, and quiet anchor legible around the covered area. Avoid: a second Mode Lantern; compass; writing spring; two-part gate; literal keyboard or keycaps; tutorial arrows; giant monument; throne; danger; monster; central black portal; editor-shaped cavity.""",
    },
    "open-trail-overlook": {
        "sceneId": "open-trail-overlook",
        "worldId": "brass-meridian",
        "title": "Open Trail Overlook",
        "references": (
            ROOT / "assets/worlds/story/ending/restored-wilds.png",
            ROOT / "assets/worlds/brass-meridian/scenes/meridian-engine/compact/base.webp",
        ),
        "prompt": """Create a new original late-story location called Open Trail Overlook, a calm Brass Meridian terrace where the restored routes can be seen continuing beyond the authored journey.

Build a spacious but sheltered ridge overlook from charcoal stone, aged brass railings, thick supported glass, and narrow cyan conduits. Let a real path arrive from Keeper's Relay, pass a low horizon relay or viewing instrument fixed to a stone plinth, and continue safely out of frame toward a warm distant landscape. The view may contain subtle, geographically plausible echoes of all four restored regions—Moonroot's rooted ruins in a near valley, a pale Starwater reflection, distant amber Archive windows, and the Brass Meridian ridge beneath the terrace—but keep them atmospheric and unified rather than four labelled quadrants. Show several already-lit routes converging behind the traveller and one ordinary open trail ahead. Do not invent a fifth world, fifth energy colour, or mysterious portal.

The scene should feel earned, quiet, and expansive. It can support one more advanced unit, open practice, a maintenance epilogue, or the handoff into the existing finale. Its visual subject is possibility after mastery, not a trophy, finish line, royal overlook, or farewell cutscene.

Style/medium: polished original 2D pixel-art fantasy with crisp silhouettes and painterly pixel clusters. Let Brass Meridian's precise construction dominate while the distant restored lands retain their established palettes. Use controlled amber warmth, narrow cyan current, blue-violet atmospheric depth, and no celebratory rainbow wash.

Keep the arriving path, horizon relay, outgoing trail, safe railing, and at least two distant regional cues legible around the covered area. Avoid: literal world map; four labelled quadrants; fifth-world portal; finish line; trophy; crown; graduation stage; throne; fireworks; giant flag; triumphal statue; cliff danger; central black portal; editor-shaped cavity; floating architecture.""",
    },
}


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
    region_name, region_style = REGION_STYLES[unit["worldId"]]
    return f"""Use case: stylized-concept
Asset type: responsive environmental backdrop for the live Vim Wilds exercise board
Primary request: Create a new original {region_name} location for one learning unit.
Scene/backdrop: {unit["location"]}.
Landmark vocabulary: {unit["landmark"]}. The landmark may lead or support the composition according to the candidate direction, but any visible object must be physically supported by the environment.
Conceptual feeling: {unit["meaning"]}.
Regional art bible: {region_style}
Style/medium: polished original 2D pixel-art fantasy, crisp silhouettes and painterly pixel clusters; match the attached Vim Wilds references in rendering language, material vocabulary and regional palette.
Composition/framing: 4:3 landscape. {direction}
UI occlusion reference: The attached red-hatched image records the area a real HTML editor can cover. It is measurement data only. Do not reproduce its colors, rectangle, hatching, shape or emptiness. The world must remain a coherent complete illustration when the editor is absent. Keep irreplaceable focal detail outside that covered area, but ordinary scenery may continue naturally behind it.
Constraints: coherent background, middle ground and foreground; grounded objects; consistent side-on or gently elevated game perspective; readable outer scenery when the editor is present; no characters.
Avoid: a generic black hole; an editor-shaped cavity; a compulsory central doorway; floating architecture; isolated prop-sheet objects; top-down map perspective; writing; letters; code; keyboard keys; signs; captions; UI; logos; pseudo-text; watermark; recognizable franchise imagery.
Output one 2K 4:3 image."""


def future_candidate_prompt(scene: dict[str, Any], direction: str, revision: int = 1) -> str:
    if revision == 2:
        reference_instructions = """Input images: Image 1 is a Vim Wilds rendering-language reference only: borrow its polished 2D pixel-art medium, palette restraint, grounded materials, and gently elevated side-on perspective, but do not reuse or adapt its composition, camera, landmark, terrain arrangement, or architecture. Image 2 is the compact editor-occlusion measurement only.

DISTINCT-PLACE REQUIREMENT
This board must read as a genuinely new destination, not as a continuation image, remix, alternate angle, or lightly changed regional board. Invent a new landmark silhouette, a new spatial arrangement, and a new route topology that suit this scene alone. The only continuity is the world’s shared materials and rendering language. Do not reuse another unit’s beacon pair, clock wheel, archive cabinet, Mode Lantern, Meridian Engine, prior horizon arrangement, or a recognizable framing of any existing board.

EDITOR-SPACE REQUIREMENT
Compose a real, calm, low-frequency environmental sweep through the central board area: contiguous floor, water, sky, ridge shadow, distant depth, or another scene-appropriate supported surface. It must provide readable dark values behind the live editor without becoming an empty editor-shaped rectangle. Place the protected landmark and high-frequency tactile details in the outer thirds, with clear entrance and exit cues around the editor zone. Continue natural scenery behind it; do not draw a panel, cavity, frame, or blank stage."""
    else:
        reference_instructions = """Input images: Image 1 and Image 2 are approved adjacent Vim Wilds board references in the fixed order recorded below. Match their rendering language and regional continuity without copying either composition. Image 3 is the compact editor-occlusion measurement only."""
    return f"""Use case: stylized-concept
Asset type: responsive environmental backdrop for the live Vim Wilds exercise board
{reference_instructions}
Primary request: {scene["prompt"]}

Composition/framing: one complete 2K 4:3 landscape. {direction}
The final measurement image is data only. Do not reproduce its rectangle, hatching, colours, shape, or emptiness. Let ordinary scenery continue naturally behind the covered area. The board must remain a coherent complete illustration when the HTML editor is absent; keep irreplaceable focal detail outside the covered area.

Constraints: coherent background, middle ground, and foreground; every lens, shelf, bridge, rail, conduit, platform, path, lamp, and light physically supported; polished original 2D pixel-art language; gently elevated side-on game perspective; crisp silhouettes; painterly pixel clusters; grounded objects; dark readable values; narrow cyan light; warm amber accents; restrained violet shadow; no characters.
Avoid: readable writing; letters; numbers; code; keyboard keys; icons; signs; captions; UI; logos; pseudo-text; watermark; unsupported floating architecture; generic prop-sheet staging; photorealism; smooth 3D rendering; neon cyberpunk clutter; recognizable franchise imagery.
Output one 2K 4:3 polished original 2D pixel-art PNG image."""


def reference_metadata(paths: tuple[Path, ...]) -> list[dict[str, str]]:
    return [
        {
            "path": str(path.relative_to(ROOT)),
            "sha256": sha256(path),
            "mimeType": "image/webp" if path.suffix == ".webp" else "image/png",
        }
        for path in paths
    ]


def build_manifest(unit_id: str, unit: dict[str, str], mask: Path) -> dict[str, Any]:
    return {
        "schemaVersion": 2,
        "unitId": unit_id,
        "sceneId": unit["sceneId"],
        "worldId": unit["worldId"],
        "model": MODEL,
        "createdAt": datetime.now(UTC).isoformat(),
        "approval": {"candidateId": None, "approvedAt": None, "notes": ""},
        "references": reference_metadata((*REFERENCE_PATHS, mask)),
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


def build_future_manifest(scene_id: str, scene: dict[str, Any], mask: Path) -> dict[str, Any]:
    references = (*scene["references"], mask)
    return {
        "schemaVersion": 3,
        "kind": "future-unit-board-candidates",
        "unitId": scene_id,
        "sceneId": scene["sceneId"],
        "worldId": scene["worldId"],
        "title": scene["title"],
        "model": MODEL,
        "createdAt": datetime.now(UTC).isoformat(),
        "approval": {"candidateId": None, "approvedAt": None, "notes": "Requires explicit human review."},
        "references": reference_metadata(references),
        "candidates": [
            {
                "id": f"candidate-{index:02d}",
                "directionId": direction_id,
                "direction": direction,
                "generationRound": 1,
                "prompt": future_candidate_prompt(scene, direction, 1),
                "path": f"candidate-{index:02d}.png",
                "approvalState": "pending",
                "estimatedCostUsd": None,
            }
            for index, (direction_id, direction) in enumerate(FUTURE_CANDIDATE_DIRECTIONS, 1)
        ],
    }


def ensure_future_revision_two(manifest: dict[str, Any], scene: dict[str, Any], mask: Path) -> None:
    """Append a non-destructive revised candidate set after explicit review."""
    candidates = manifest.setdefault("candidates", [])
    for candidate in candidates:
        if candidate.get("generationRound", 1) != 1:
            continue
        candidate["generationRound"] = 1
        candidate["approvalState"] = "rejected" if (ARTIFACT_ROOT / manifest["unitId"] / candidate["path"]).is_file() else "cancelled"
        candidate["reviewNotes"] = "Rejected before approval: adjacent-board references over-conditioned the composition and the center lacked calm editor-safe space."
    if any(candidate.get("generationRound") == 2 for candidate in candidates):
        return
    candidates.extend(
        {
            "id": f"candidate-r2-{index:02d}",
            "directionId": direction_id,
            "direction": direction,
            "generationRound": 2,
            "prompt": future_candidate_prompt(scene, direction, 2),
            "path": f"candidate-r2-{index:02d}.png",
            "approvalState": "pending",
            "estimatedCostUsd": None,
        }
        for index, (direction_id, direction) in enumerate(FUTURE_CANDIDATE_DIRECTIONS, 1)
    )
    manifest.setdefault("generationRounds", []).append({
        "round": 2,
        "createdAt": datetime.now(UTC).isoformat(),
        "references": reference_metadata((*FUTURE_REVISION_TWO_REFERENCES, mask)),
        "reason": "Owner rejected round one: use only a style reference, require a distinct place silhouette, and reserve naturally composed calm center/editor space.",
    })


def refresh_unsubmitted_future_manifest(
    manifest: dict[str, Any], scene_id: str, scene: dict[str, Any], mask: Path
) -> dict[str, Any]:
    """Refresh prompt metadata until a paid output exists; never rewrite a run."""
    if any((ARTIFACT_ROOT / scene_id / candidate["path"]).is_file() for candidate in manifest.get("candidates", [])):
        return manifest
    refreshed = build_future_manifest(scene_id, scene, mask)
    refreshed["createdAt"] = manifest.get("createdAt", refreshed["createdAt"])
    return refreshed


class NoImageOutput(RuntimeError):
    """Vertex accepted a request but declined to return an image payload."""


def extract_image(response: Any) -> bytes:
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data
    raise NoImageOutput(f"Gemini returned no image: {response}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--unit", choices=tuple(UNITS), help="generate one existing unit; defaults to all existing units")
    parser.add_argument("--future", choices=tuple(FUTURE_SCENES), help="generate one Session 23 semantic scene")
    parser.add_argument("--future-all", action="store_true", help="generate all five Session 23 semantic scenes")
    parser.add_argument("--revision", type=int, choices=(1, 2), default=1, help="future-scene prompt revision to generate")
    parser.add_argument("--candidate", type=int, choices=range(1, 6), help="generate one candidate number")
    parser.add_argument("--execute", action="store_true", help="submit paid Vertex requests")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    parser.add_argument("--location", default=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
    parser.add_argument("--min-request-interval", type=float, default=15.0)
    parser.add_argument("--quota-backoff-seconds", type=float, default=75.0)
    parser.add_argument("--max-quota-retries", type=int, default=2)
    args = parser.parse_args()
    if args.unit and (args.future or args.future_all):
        raise SystemExit("Choose either --unit or --future/--future-all")
    if args.future and args.future_all:
        raise SystemExit("Choose either --future or --future-all")
    if not MASK_METRICS.is_file():
        raise SystemExit("Run node scripts/world-art/capture_scene_masks.mjs first")
    if not args.project:
        raise SystemExit("Set GOOGLE_CLOUD_PROJECT or pass --project")
    selected_future = (
        {args.future: FUTURE_SCENES[args.future]} if args.future
        else FUTURE_SCENES if args.future_all
        else {}
    )
    required_references = (
        FUTURE_REVISION_TWO_REFERENCES if selected_future and args.revision == 2
        else tuple(path for scene in selected_future.values() for path in scene["references"])
        if selected_future else REFERENCE_PATHS
    )
    missing = [path for path in required_references if not path.is_file()]
    if missing:
        raise SystemExit(f"Missing reference images: {', '.join(map(str, missing))}")

    mask = create_compact_mask()
    selected_units = {args.unit: UNITS[args.unit]} if args.unit else ({} if selected_future else UNITS)
    jobs: list[tuple[Path, dict[str, Any], dict[str, Any], tuple[Path, ...]]] = []
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
                jobs.append((manifest_path, manifest, candidate, (*REFERENCE_PATHS, mask)))
    for scene_id, scene in selected_future.items():
        directory = ARTIFACT_ROOT / scene_id
        directory.mkdir(parents=True, exist_ok=True)
        manifest_path = directory / "manifest.json"
        manifest = (
            refresh_unsubmitted_future_manifest(json.loads(manifest_path.read_text()), scene_id, scene, mask)
            if manifest_path.exists()
            else build_future_manifest(scene_id, scene, mask)
        )
        if args.revision == 2:
            ensure_future_revision_two(manifest, scene, mask)
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        candidates = [candidate for candidate in manifest["candidates"] if candidate.get("generationRound", 1) == args.revision]
        if args.candidate:
            candidates = [candidates[args.candidate - 1]]
        for candidate in candidates:
            if not (directory / candidate["path"]).exists():
                references = (*FUTURE_REVISION_TWO_REFERENCES, mask) if args.revision == 2 else (*scene["references"], mask)
                jobs.append((manifest_path, manifest, candidate, references))

    print(f"Unit-scene backdrop plan: {len(jobs)} missing {MODEL} candidate(s)")
    if not args.execute:
        for _, manifest, candidate, _ in jobs:
            print(f'  {manifest["unitId"]}/{candidate["id"]}: {candidate["directionId"]}')
        print("Dry run only; add --execute to submit Vertex requests.")
        return 0

    from google import genai
    from google.genai import types

    client = genai.Client(vertexai=True, project=args.project, location=args.location)
    last_submission = 0.0
    for manifest_path, manifest, candidate, references in jobs:
        delay = args.min_request_interval - (time.monotonic() - last_submission)
        if delay > 0:
            time.sleep(delay)
        print(f'Submitting {manifest["unitId"]}/{candidate["id"]}…', flush=True)
        reference_parts = [
            types.Part.from_bytes(
                data=path.read_bytes(),
                mime_type="image/webp" if path.suffix == ".webp" else "image/png",
            )
            for path in references
        ]
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
                candidate["lastNoImageAt"] = datetime.now(UTC).isoformat()
                candidate["lastNoImageReason"] = str(error)
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
        destination = manifest_path.parent / candidate["path"]
        destination.write_bytes(image_bytes)
        candidate["sha256"] = sha256(destination)
        candidate["sourceDimensions"] = list(Image.open(destination).size)
        candidate["generatedAt"] = datetime.now(UTC).isoformat()
        candidate["model"] = MODEL
        candidate["requestReferences"] = [str(path.relative_to(ROOT)) for path in references]
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"Saved {destination.relative_to(ROOT)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
