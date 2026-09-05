#!/usr/bin/env python3
"""Generate review-only WP-11 story candidates with Gemini Nano Banana Pro.

This batch intentionally does not promote anything into ``assets/``.  It
creates five new variants for Intro Panels 2 and 3 and five registered-camera
restoration candidates for each unit ending.  The selected Intro Panel 1
panorama (candidate 07) and every approved wide unit board are immutable
references.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[2]
PRESENTATION_PATH = ROOT / "content" / "presentation.json"
OUTPUT_ROOT = ROOT / "artifacts" / "world-generation" / "wp11" / "story-review-v2"
PHONE_OUTPUT_ROOT = OUTPUT_ROOT / "fullscreen-portrait-review"
MODEL = "gemini-3-pro-image"  # Gemini Nano Banana Pro
CONNECTED_PANORAMA = (
    ROOT / "artifacts" / "world-generation" / "wp11" / "intro-connected" / "candidate-07.png"
)
CONNECTED_BRIDGE_SOURCE = (
    OUTPUT_ROOT / "intro" / "connected-path-revision" / "candidate-04.png"
)
APPROVED_CONNECTED_MASTER = ROOT / "assets" / "worlds" / "story" / "intro" / "connected-wilds.png"
NEGLECT_CANDIDATE_03 = (
    OUTPUT_ROOT / "intro" / "interrupted-neglect-from-approved-04" / "candidate-03.png"
)
UNIT1_FULLSCREEN_PILOT = (
    OUTPUT_ROOT / "fullscreen-portrait-review" / "unit-endings" / "modal-model" / "candidate-05.png"
)
UNIT1_APPROVED_RESTORATION = (
    OUTPUT_ROOT / "unit-endings" / "modal-model-restoration-3x4" / "candidate-01.png"
)
NIX_IDLE = ROOT / "assets" / "characters" / "nix" / "idle.png"
MOONROOT_BASE = (
    ROOT / "assets" / "worlds" / "moonroot-ruins" / "scenes"
    / "mode-lantern-grounds" / "wide" / "base.webp"
)

INTRO_DIRECTIONS = {
    "finale-celebration-from-approved-04": (
        (
            "radiant-restored-morning",
            "A crystalline early morning after restoration: clear golden-cyan sunlight, sparkling water, fully renewed routes, abundant fresh blossoms, butterflies and delicate fireworks still visible in the bright sky.",
        ),
        (
            "wildflower-world-festival",
            "Let nature lead the celebration with especially abundant but tasteful wildflowers, flowering vines, butterflies and a few tiny happy birds throughout all four restored regions.",
        ),
        (
            "luminous-water-jubilee",
            "Make the renewed water the emotional heart: brilliant clean turquoise reflections and lily blooms carry the cyan and amber route light beneath a cheerful sky full of distant fireworks.",
        ),
        (
            "golden-route-homecoming",
            "Emphasize every repaired bridge, stair and ground path glowing continuously from Moonroot to Brass, with warm sunrise light, flowers at each handoff and tiny birds celebrating along the railings.",
        ),
        (
            "great-restoration-finale",
            "Balance the maximum joyful finale: exceptionally bright clear atmosphere, immaculate connected routes, radiant landmarks, sparkling water, profuse blooms, butterflies, tiny birds and elegant colourful fireworks.",
        ),
    ),
    "interrupted-deep-neglect-from-approved-04": (
        (
            "tenfold-decades-abandoned",
            "About 10× the prior neglect: decades unattended, with clearly failed routes, dust, tarnish, persistent damp, sparse weeds and most lights weak or dead.",
        ),
        (
            "twenty-fivefold-infrastructure-failure",
            "About 25× the prior neglect: bridge halves visibly separated, several stair flights partly collapsed, paving broken into uneven islands and supports heavily weathered.",
        ),
        (
            "fiftyfold-nature-reclaims",
            "About 50× the prior neglect: roots, moss, algae and trailing vines reclaim every failed route while preserving the recognizable architecture beneath them.",
        ),
        (
            "seventy-fivefold-network-dark",
            "About 75× the prior neglect: the route network is almost entirely dark, cold and disconnected, with only rare weak cyan or amber remnants revealing former paths.",
        ),
        (
            "hundredfold-forgotten-wilds",
            "The maximum 100× readable neglect: a once-beautiful connected system now profoundly abandoned, fractured, overgrown, oxidized and dormant, yet still unmistakably the same world rather than a war ruin.",
        ),
    ),
    "interrupted-neglect-from-approved-04": (
        (
            "suddenly-abandoned",
            "Show a precise system that failed suddenly and was then left alone: fresh structural splits softened by dust, dimming lamps and the first sparse signs of neglect.",
        ),
        (
            "long-quiet-neglect",
            "Emphasize quiet long neglect: weathered surfaces, slightly sagging routes, settled dust, tarnish, sparse weeds and weak illumination, with no evidence of violence.",
        ),
        (
            "entire-route-network-failed",
            "Prioritize complete route readability: every bridge, staircase, landing and ground path has at least one visible crack, gap, offset or failed handoff, yet remains recognizable.",
        ),
        (
            "dormant-wilds",
            "Emphasize the Wilds falling dormant: muted mushrooms, still darker water, quiet mechanisms, faint broken currents and subdued colour around visibly fractured routes.",
        ),
        (
            "clearest-abandonment-story",
            "Balance physical path failure, dimmed light, muted colour and restrained weathering for the clearest immediate feeling of abandonment and sudden systemic interruption at phone size.",
        ),
    ),
    "interrupted-bridges-from-approved-04": (
        (
            "fractured-decks",
            "Give every traversable bridge one or two unmistakable deck fractures: missing central stones or glass panels, split railings and separated halves that remain visibly aligned across the gap.",
        ),
        (
            "collapsed-landings",
            "Emphasize damaged stair and landing handoffs: cracked treads, sagging outer edges, broken supports and short disconnected endpoints, while retaining each complete route silhouette.",
        ),
        (
            "old-and-failing",
            "Make the bridges look long-neglected and structurally failing through age-darkened stone, tarnished brass, cracked glass, bent rails and restrained debris attached to the structures.",
        ),
        (
            "severed-currents",
            "Balance physical bridge fractures with the clearest interrupted cyan and amber-gold currents: both light paths break at the same gaps, with small sparks and fading torn ends.",
        ),
        (
            "clearest-interruption",
            "Prioritize the strongest immediate story read at phone size: every bridge is still recognizable and fully visible, yet no bridge is safely continuous and every route current is visibly severed.",
        ),
    ),
    "connected-bridge-from-path-04": (
        (
            "archive-stone-arch",
            "Complete the handoff with a supported blue-grey Archive stone arch bridge whose far landing becomes a short Brass stairway.",
        ),
        (
            "stepped-causeway",
            "Complete the handoff with a broad stepped stone causeway on visible piers, gradually changing from Archive masonry to Brass-edged steps.",
        ),
        (
            "twin-stair-landing",
            "Extend both exposed stair ends into a shared central landing, then climb toward the Brass terrace with railings and physically supported masonry.",
        ),
        (
            "bridge-and-brass-ramp",
            "Use a compact masonry bridge from the Archive stair, followed by a clearly joined brass-supported ramp into the fourth region.",
        ),
        (
            "clearest-continuous-route",
            "Prioritize the clearest phone-readable connection: one unmistakable traversable bridge-and-stair route, elegant but visually obvious before its light currents are noticed.",
        ),
    ),
    "connected-path-revision": (
        (
            "grounded-causeway",
            "Replace the vague connection with one unmistakable traversable route of stone paths, shallow terraces, small bridges and grounded causeways from Moonroot through all four regions.",
        ),
        (
            "water-and-bridge-route",
            "Make the route clearest at the Moonroot-to-Starwater handoff: a real forest path reaches a small bridge, crosses supported stepping terraces over water, then continues toward the Archive.",
        ),
        (
            "archive-rail-handoff",
            "Make the Starwater-to-Archive-to-Meridian continuity especially concrete: bridge decking becomes carved archive stairs and supported rails, which become Brass Meridian walkways and conduits.",
        ),
        (
            "regional-material-sequence",
            "Build one continuous route whose material changes tell the journey—root-and-stone path, glass-water bridge, carved archive rail, then brass walkway—without ever breaking physical continuity.",
        ),
        (
            "strongest-story-read",
            "Prioritize the clearest possible left-to-right physical journey at phone size: one visually dominant but elegant route, with bridges and paths readable before any decorative light current.",
        ),
    ),
    "interrupted-command": (
        (
            "unfinished-current",
            "Make the single most legible change an amber-cyan current that ends gently just before its destination, with its unfinished end clearly visible on real terrain.",
        ),
        (
            "shifted-paths",
            "Emphasize several safe but visibly displaced paths: aligned channels drift a little out of phase while the landscape itself remains intact.",
        ),
        (
            "scattered-memories",
            "Emphasize a restrained trail of a few displaced archive-light fragments, as though remembered order has scattered without an explosion or disaster.",
        ),
        (
            "silent-mechanisms",
            "Emphasize landmarks paused at incompatible phases: lenses off-axis, rings no longer nested and Meridian mechanisms quietly still.",
        ),
        (
            "whole-story-balance",
            "Balance the unfinished current, shifted paths, scattered memory lights and silent mechanisms so the entire narrative beat reads in one calm cinematic image.",
        ),
    ),
    "nix-at-the-threshold": (
        (
            "listening-threshold",
            "Nix pauses at the threshold and listens; the lantern is dim but one tiny answering light reveals that the Wilds are dormant rather than dead.",
        ),
        (
            "remembered-language",
            "A few precise route lights wake in sequence near Nix, suggesting a language being remembered without using glyphs, letters, code or symbols.",
        ),
        (
            "shared-invitation",
            "Give Nix an open, welcoming stance toward the path and landmark, communicating companionship and an invitation to learn rather than prophecy or rescue.",
        ),
        (
            "lantern-answer",
            "Let Nix's lantern and the dormant Mode Lantern answer each other with one restrained reflected thread across stone or water.",
        ),
        (
            "phone-story-frame",
            "Prioritize immediate story readability in a narrow phone crop: Nix, the dormant landmark and their tentative connection remain distinct near the central vertical band.",
        ),
    ),
}

UNIT_DIRECTIONS = (
    (
        "action-trace",
        "Emphasize the exact physical trace of the guide's action reaching the landmark; the cause and the restored result must be readable without the character being painted into the scene.",
    ),
    (
        "landmark-awakening",
        "Emphasize the landmark's own material transformation from dormant to restored with restrained light, alignment and motion implied through one clear final state.",
    ),
    (
        "environment-answers",
        "Let nearby water, stone, glass, roots, conduits or reflections answer the restored landmark in a quiet outward ripple while distant scenery remains calm.",
    ),
    (
        "precise-celebration",
        "Make the restored state feel rewarding and unmistakable but disciplined: warm focal light, exact geometry and no confetti, fireworks, spectacle or visual clutter.",
    ),
    (
        "phone-readable-ending",
        "Prioritize the landmark and restoration path in the central phone-safe band and preserve calmer lower-right space for the separate runtime guide animation.",
    ),
)

RESTORATION_3X4_DIRECTIONS = (
    (
        "repaired-landmark-and-route",
        "Prioritize unmistakable physical repair: complete the landmark, replace missing structure, align every nearby stair or mechanism, and make one safe onward route visually continuous.",
    ),
    (
        "living-world-awakens",
        "Let recovery spread through living nature and atmosphere: fresh world-appropriate flowers and greenery, cleaner water or glass, brighter dawn, and renewed reflections support the restored landmark without hiding it.",
    ),
    (
        "luminous-forward-handoff",
        "Make continuity the strongest read: one elegant but obvious grounded current enters the restored landmark and continues through a real bridge, stair, channel or conduit toward the next destination.",
    ),
    (
        "narrative-action-made-visible",
        "Translate the unit's exact completion action into a bold physical result: the landmark geometry, materials and connected systems must visibly demonstrate what changed even before the story text is read.",
    ),
    (
        "whole-scene-recovery",
        "Show the broadest recovery while preserving the same place: repaired foreground and distance, awakened secondary lights, healthy natural details and a clear morning atmosphere all lead the eye forward.",
    ),
)

LANDMARK_DESCRIPTIONS = {
    "mode-lantern": "four materially distinct nested glass rings settling into four precise colours around one warm lantern core",
    "wayfinder": "a grounded central compass whose four real paths align north, south, east and west",
    "scribes-spring": "a repaired split stone channel through which luminous ink-water begins to flow",
    "grammar-gate": "two grounded halves of a range-and-action mechanism joining so the gate can open",
    "starneedle": "a slim stone observatory needle whose floating glass lens focuses distant points and exact reflections",
    "nested-garden": "three materially nested translucent stone-and-glass arches blooming from the outside inward",
    "prism-crossing": "three supported glass panes aligned as visibly distinct ribbon, row and rectangular paths",
    "memory-archive": "a built-in crystal drawer cabinet where one captured memory lights several related drawers",
    "far-beacons": "two distant grounded brass-and-teal beacons reconnected by one thin supported thread of light",
    "echo-clock": "one large controlled clock wheel whose motion propagates through three smaller matching wheels",
    "meridian-table": "a broad brass route table where two grounded endpoints define one exact narrow cyan current",
    "mirror-loom": "a supported lens-and-loom mechanism where only the matching threads transform colour",
    "echo-foundry": "a recorder cylinder connected by real conduits to three mechanisms replaying one coordinated movement",
    "meridian-engine": "a monumental welcoming brass-and-glass junction carrying coordinated currents that echo all four worlds",
    "beacon-glass": "a rail-mounted brass observation lens whose large round glass clears to reveal a sharp far view, with its vertical lift and side aperture aligned",
    "menders-bench": "a connected confluence workshop where distinct glass, brass, stone and living-root repair benches feed one dependable cyan test circuit",
    "keepers-relay": "a circular brass-and-glass route relay whose loop tracks return to one central distributor, then divide cleanly among several supported outward routes",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def mime_type(path: Path) -> str:
    return "image/png" if path.suffix.lower() == ".png" else "image/webp"


def extract_image(response: Any) -> bytes:
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data
    raise RuntimeError(f"Nano Banana returned no image: {response}")


def intro_prompt(panel_id: str, direction: str) -> str:
    if panel_id == "finale-celebration-from-approved-04":
        return f"""Use case: precise-object-edit
Asset type: final game-ending celebration panorama
Input image: Image 1 is the exact user-approved connected-world panorama and immutable registration target. Create the joyful fully restored ending from this same image, not a new composition.
Primary request: Move the entire world in the exact emotional opposite direction from abandonment: everything is repaired, alive, clear, cheerful, bright and flourishing. This is the final visual reward after all four worlds recover.
Complete restoration requirement: preserve every bridge, staircase, landing, causeway, walkway and ground path in its exact location, but make each one fully repaired, clean, safe and visibly continuous. Restore missing masonry, align stair treads, polish railings and supports, and carry strong elegant cyan-blue and amber-gold currents without interruption across the complete route from Moonroot through Starwater and the Archive into Brass. All landmarks and mechanisms are awake and warmly illuminated.
Light, water and sky: transform the subdued night into an exceptionally clear luminous morning or bright celebratory daylight. Let clean turquoise water sparkle with bright reflections and visible depth. Add tasteful colourful fireworks high and distant in the open sky—multiple graceful bursts, clearly celebratory but never smoky, dangerous or visually dominant. Fireworks must not form letters, symbols or logos.
Living nature: add abundant blooming flowers, flowering vines, water lilies and fresh greenery integrated naturally into each region without covering paths or landmarks. Include a few small organic happy creatures only: tiny natural butterflies and small birds, dispersed as secondary details. They must remain small enough for the existing game characters to be overlaid later.
Direction for this candidate: {direction}
Character exclusion: do not paint Nix or any existing Vim Wilds character. No humanoid, mascot, large animal, fantasy pet or central creature. Only tiny ordinary birds and butterflies are allowed.
Registration contract: preserve Image 1's exact 2752×1536 canvas, camera, crop, horizon, terrain silhouettes, root and island positions, waterline, architecture, Archive shelves and cabinet, Brass route-table shape, landmark positions, pixel density and spatial composition. Brighten, repair and enrich the same scene without moving or redesigning major objects. It should support a recognizable transformation from the opening panorama.
Style/medium: preserve the exact polished 2D fantasy pixel-art language, crisp readable silhouettes and painterly pixel clusters of Image 1, with higher clarity and a joyful luminous palette.
Avoid: existing game character, humanoid, large creature, foreground mascot, crowd, covered path, hidden landmark, changed camera, new composition, moved world region, destroyed structure, dark gloomy lighting, war, fire damage, smoke cloud, visual clutter, photorealism, text, letters, code, runes, signage, UI, logo or watermark.
Output one 2K 16:9 image."""

    if panel_id == "interrupted-deep-neglect-from-approved-04":
        return f"""Use case: precise-object-edit
Asset type: intensely neglected Intro Panel 2 panorama for a mobile-game story
Input images: Image 1 is the exact user-approved connected-world master and immutable camera/composition target. Image 2 is the user's acceptable prior interrupted candidate and a minimum decay reference only. Keep Image 1's identity and registration, but make abandonment dramatically more obvious than Image 2.
Primary request: Show a precise fantasy world whose route network broke suddenly and then remained abandoned for decades. Amplify quiet neglect by an order of magnitude or more. The result should immediately read as profound disuse, decay, stillness and forgotten infrastructure—never war or deliberate destruction.
Every-route requirement: visibly fail every bridge, staircase, stepped landing, causeway, walkway and ground path across all four regions. Separate bridge decks into still-visible halves; collapse or sag selected spans while retaining supports and recognizable silhouettes; remove groups of stair treads; offset landings; bend or lose rail sections; split paving into uneven disconnected islands; let roots heave paths and silt cover unused approaches. There must be no pristine continuous route, but every former route must remain clearly traceable and visible.
Deep-neglect requirement: add heavy but believable age-darkening, tarnish, oxidation, settled dust, water stains, cracked masonry, stagnant darker water, algae, moss, roots, sparse weeds, trailing vines and occasional cobweb-like fine strands. Let nature reclaim route structures and mechanisms, but do not cover or erase the important world landmarks. Mushrooms should be sparse, faded and mostly non-luminous.
Light and colour requirement: extinguish most lanterns and mechanism lights. Make remaining cyan-blue and amber-gold currents extremely faint, short, intermittent and visibly severed at every physical break; only rare weak residual points may glow. Reduce saturation and contrast substantially toward cold blue-grey, weathered green, dusty violet and tarnished brown while keeping enough visibility to inspect all damage.
Direction and intensity for this candidate: {direction}
Registration contract: preserve Image 1's exact 2752×1536 canvas, camera, crop, horizon, terrain silhouettes, roots, waterline, island positions, building shapes, Archive shelves and cabinet, Brass route-table identity, landmark positions, pixel density and atmospheric depth. Age and dim these elements without moving or redesigning them. A crossfade must still show the same world falling into decay, not a different illustration.
Style/medium: preserve the exact polished 2D fantasy pixel-art language, crisp readable silhouettes and painterly pixel clusters of Image 1.
Avoid absolutely: war, battle, soldiers, weapons, blast damage, bomb crater, explosion, active fire, smoke plume, burning building, bodies, horror, apocalypse, earthquake-scale landscape change, total building collapse, giant rubble mound, missing world region, black obscured image, new composition, camera shift, text, letters, code, runes, signage, UI, logo or watermark.
Output one 2K 16:9 image."""

    if panel_id == "interrupted-neglect-from-approved-04":
        return f"""Use case: precise-object-edit
Asset type: Intro Panel 2 interrupted-and-neglected panorama for a mobile-game story
Input image: Image 1 is the exact user-approved connected-world master and immutable registration target. The output must remain unmistakably the same image and support a near-perfect crossfade from Image 1.
Primary request: Show that a precise connected world suffered a sudden systemic break and then fell into quiet abandonment and neglect. It is worn down, old, dormant and disconnected—not attacked, bombed or devastated by war.
Complete route-network requirement: modify every existing bridge, staircase, stepped landing, causeway and visible ground path across all four regions. Each route structure must show at least one readable problem: cracked or missing slabs, a short deck gap, separated halves, an offset landing, uneven or broken stair treads, sagging supports, bent rails, root-heaved paving, split edges, settled debris or a failed physical handoff. Keep every bridge and stair fully visible in its original location and preserve its overall silhouette, so viewers can clearly recognize what used to connect. No safe route should remain perfectly continuous.
Light-path requirement: retain the original cyan-blue and amber-gold currents in their exact route positions, but make them substantially dimmer, intermittent and weaker. Break them at physical cracks with faint torn ends and only a few tiny residual sparks. Dim lanterns, mechanisms and reflections without extinguishing every point of light; the scene must stay readable.
Quiet-neglect art direction: reduce overall saturation and warmth moderately; mute the purple/cyan mushrooms and make their glow sparse and weak; make water darker and stiller; add restrained age-darkening, dust, tarnish, moss or a few small weeds only where physically plausible. Convey stillness, disuse and the sadness of a once-working place. Do not make the image monochrome, pitch-black or fog-obscured.
Direction for this candidate: {direction}
Registration contract: preserve the exact 2752×1536 canvas, camera, crop, horizon, terrain silhouettes, roots, waterline, islands, architecture, Archive shelves and cabinet, Brass route-table shape, landmark shapes, object positions, pixel density and atmospheric depth from Image 1. Apart from route damage, restrained local aging and the requested dimming/colour grade, do not redesign, move, add or remove major objects.
Style/medium: preserve the exact polished 2D fantasy pixel-art style, crisp silhouettes and painterly pixel clusters of Image 1.
Avoid absolutely: war, battle, weapon damage, bomb crater, explosion, fire, smoke, burning building, bodies, danger scene, apocalypse, earthquake-scale terrain collapse, giant rubble piles, total destruction, missing bridge, hidden bridge, completely black scene, horror, new composition, camera shift, new landmark, text, letters, code, runes, signage, UI, logo or watermark.
Output one 2K 16:9 image."""

    if panel_id == "interrupted-bridges-from-approved-04":
        return f"""Use case: precise-object-edit
Asset type: Intro Panel 2 interrupted-state panorama for a mobile-game story
Input image: Image 1 is the exact user-approved connected-world master and immutable edit target. This output must be visibly 100% derived from Image 1 and suitable for a registered crossfade from it.
Primary request: Change only the existing physical bridges, stair routes, causeways, their immediate landings and the cyan-blue and amber-gold currents attached to them. Make the paths old, battered, shattered, visibly torn, partly collapsed and disconnected after an unfinished command interrupted the Wilds.
Bridge visibility contract: every bridge and stair route from Image 1 must remain in the same position with the same overall silhouette and both endpoints still visible. Never erase a bridge, hide it in darkness or replace it with empty space. Instead, split decks into still-recognizable halves, remove a few central stones or glass panels, crack and offset stair treads, bend rails, fracture supports, or let a short section sag. The damage must be structurally obvious but localized enough that the original bridge remains unmistakable.
Route-current contract: retain both cyan-blue and amber-gold path currents along their original routes. Break each current at the same physical fractures: torn luminous ends, small restrained sparks, fading interruptions and short disconnected segments. Light never floats where the physical path no longer exists.
Direction for this candidate: {direction}
Immutable registration contract: preserve the exact 2752×1536 canvas, camera, crop, horizon, terrain, roots, water, islands, Archive shelves and cabinet, Brass workshop and route table, every landmark, palette, lighting, pixel density, atmospheric depth and all non-route scenery from Image 1. Do not repaint or reinterpret any world region. Modify only bridges, stairs, paths, landings, rails, supports, their small attached debris, and their route currents.
Style/medium: preserve the exact polished 2D fantasy pixel-art style, crisp silhouettes and painterly pixel clusters of Image 1.
Mood: interrupted, old and unsafe to cross, but quiet and abandoned rather than explosive or apocalyptic.
Avoid: new composition, camera shift, changed landmark, changed water or sky, destroyed buildings, earthquake across terrain, fire, smoke, explosion, disaster spectacle, completely missing bridge, obscured bridge, giant rubble pile, new route, map, arrows, text, letters, code, runes, signage, UI, logo or watermark.
Output one 2K 16:9 image."""

    if panel_id == "connected-bridge-from-path-04":
        return f"""Use case: precise-object-edit
Asset type: revised Intro Panel 1 panorama for a mobile-game story
Input image: Image 1 is the user's chosen connected-world panorama and exact edit target.
Primary request: Connect only the third Archive-like underground region to the fourth warm Brass machinery region with one real, continuous walking route.
Exact local target: in the lower-right portion of Image 1, the purple Archive scene has crystal shelves, a glass-front cabinet, arched stone architecture and a visibly broken descending staircase at its bottom-right edge. Immediately above and to the right, the Brass workshop contains copper machinery, a raised route table and stairways. Extend the Archive's broken lower-right staircase into a believable supported bridge, stair landing, stepped causeway or short ramp that physically joins a real Brass landing. The result must let a walking person move from the Archive floor into the Brass workshop without a jump, hidden endpoint or gap.
Direction for this candidate: {direction}
Route-light requirement: preserve the existing cyan-blue and amber-gold route language. Carry both luminous currents continuously along and across the new bridge/stair connection, through the third scene and onward into the fourth scene. Make the two paths clearer and easier to trace, but keep them narrow, elegant and attached to real walkable surfaces.
Edit contract: preserve the exact 16:9 canvas, camera, crop, horizon, four-region composition, silhouettes, water, architecture, landmarks, palette, lighting, pixel density and atmosphere of Image 1. Limit structural edits to the lower-right Archive-to-Brass handoff and the minimum adjacent stone, support or landing required to connect it. Preserve the Mode Lantern, all Starwater bridges, all other paths and the Brass route table exactly.
Style/medium: polished original 2D fantasy pixel art with crisp silhouettes and painterly pixel clusters, exactly matching Image 1.
Constraints: the bridge must be fully visible, physically supported, walkable and unmistakably connected at both ends; one continuous world; no characters.
Avoid: repainting the panorama, moving regions, changing the camera, floating bridge, light floating over empty space, hidden endpoints, map overlay, arrows, labels, text, letters, code, runes, signage, UI, logo or watermark.
Output one 2K 16:9 image."""

    if panel_id == "connected-path-revision":
        return f"""Use case: precise-object-edit
Asset type: revised Intro Panel 1 panorama for a mobile-game story
Input image: Image 1 is the user's selected, approved harmony panorama and exact edit target.
Primary request: Make the continuity of the four worlds visually unmistakable by replacing only the vague abstract connecting path with one real, physically traversable route.
Edit contract: preserve the exact canvas, camera, crop, horizon, region positions, terrain silhouettes, architecture, waterline, landmarks, palette, lighting, pixel density, atmospheric depth, lower-third copy space and every beautiful characteristic of Image 1. Do not repaint, rearrange or reinterpret the panorama. Change only the connective route and the minimum adjacent terrain needed to support it.
Route logic: begin with a grounded Moonroot forest path; use real stairs, terraces, small bridges, stepping causeways or supported boardwalks across Starwater; descend through believable Archive thresholds, stairs or rails; arrive through Brass Meridian walkways and conduits. Every handoff must be physically supported and clearly continuous. A person should be able to point at the route and trace it from the far left to the far right without guessing.
Direction for this candidate: {direction}
Light logic: thin amber-cyan currents may quietly follow the physical route, but light must never substitute for the route itself.
Style/medium: preserve the exact polished original 2D fantasy pixel-art style, crisp silhouettes and painterly pixel clusters of Image 1.
Composition: retain the panoramic left-to-right camera journey and calm real environmental lower-third space. Keep the route readable during a slow phone camera track without turning it into a thick stripe or map overlay.
Constraints: one continuous landscape; safe traversable route; physically supported structures; unchanged landmarks; no characters.
Avoid: a new composition, changed camera, separate biome panels, floating bridge, impossible stairs, glowing cable as the only connection, map, diagram, arrows, labels, road signs, text, letters, code, runes, UI, logo or watermark.
Output one 2K 16:9 image."""

    if panel_id == "interrupted-command":
        return f"""Use case: precise-object-edit
Asset type: Intro Panel 2 of a three-panel mobile-game story
Input image: Image 1 is the exact approved connected-world panorama and immutable edit target.
Primary request: Illustrate this story beat: an unfinished command crossed the Wilds; paths shifted, memories scattered, and the great mechanisms fell silent.
Edit contract: preserve the exact canvas, camera, crop, horizon, terrain, architecture, waterline, landmark positions, palette, pixel density, atmospheric depth and lower-third copy space. A crossfade from Image 1 must read as a change of world state, never a different painting. Change only currents, small route lights, a few physically plausible fragments, lens/ring alignment and mechanism illumination.
Direction for this candidate: {direction}
Style/medium: polished original 2D fantasy pixel art with crisp silhouettes and painterly pixel clusters, exactly matching Image 1.
Mood: interruption and quiet mystery, not catastrophe; every route remains safe and traversable.
Composition: retain the very-wide journey that supports a slow left-to-right camera track; keep the story readable throughout the track and maintain calm real environmental copy space in the lower third.
Constraints: one continuous world; physically supported structures; small distant landmarks; no characters.
Avoid: a new composition, shifted camera, four separate panels, explosion, lightning strike, destruction, danger, horror, villain, glitch UI, text, letters, code, runes, labels, signage, symbols, logo or watermark.
Output one 2K 16:9 image."""

    return f"""Use case: illustration-story
Asset type: Intro Panel 3 of a three-panel mobile-game story
Input images: Image 1 is Nix's immutable character-design reference. Image 2 is the approved Moonroot environment and material reference.
Primary request: Illustrate this story beat: Nix recognizes that the precise language of the Wilds was not lost, only forgotten, and warmly invites the learner to remember it together.
Scene: a safe moonlit threshold in Moonroot Ruins, with enormous roots, mossed dark stone, still water, small amber lanterns, violet spores and restrained turquoise mineral veins. A dormant Mode Lantern of four misaligned nested glass rings stands on a real terrace ahead.
Subject: one small full-body Nix, preserving the exact species, face, clothing, proportions, lantern staff, pixel-art silhouette and colours from Image 1. Nix is a capable companion, not a giant hero.
Direction for this candidate: {direction}
Style/medium: polished original 2D fantasy pixel art with crisp silhouettes and painterly pixel clusters, matching both references.
Composition: cinematic 16:9 story frame; Nix and the landmark remain legible in a narrow central phone crop; calm dark environmental space across much of the lower third supports separate HTML copy.
Mood: recognition, companionship, curiosity and a hopeful first response; no rescue fantasy, prophecy, danger or triumph.
Constraints: exactly one Nix; every object physically supported; lantern staff remains attached and unchanged; no baked-in story copy.
Avoid: duplicate character, extra limbs, missing staff, changed costume, giant close-up, battle pose, floating architecture, text, letters, code, runes, dialogue, caption, UI, logo or watermark.
Output one 2K 16:9 image."""


def unit_prompt(unit_id: str, unit: dict[str, Any], direction: str) -> str:
    completion = unit["completion"]
    landmark_id = unit["landmark"]["id"]
    return f"""Use case: precise-object-edit
Asset type: restored-state illustration for the {unit_id} unit-ending story
Input image: Image 1 is the exact approved 16:9 board scene and immutable camera-registration target.
Primary request: Transform the attached scene into the final restored state after this off-screen guide action: {completion['action']}.
Landmark result: {LANDMARK_DESCRIPTIONS[landmark_id]}.
Narrative meaning: {completion['copy']}
Edit contract: preserve the exact canvas, camera, crop, horizon, perspective, terrain, architecture, waterline, landmark position, pixel density and all unrelated scenery. Change only the landmark's physical alignment/illumination, its supported connection path and restrained nearby environmental response. A crossfade from the dormant board must feel registered and must never jump.
Direction for this candidate: {direction}
Style/medium: polished original 2D fantasy pixel art, crisp silhouettes and painterly pixel clusters, exactly matching Image 1.
Composition: keep the restoration legible at phone size; preserve calmer lower-right visual space for a separate runtime character animation; keep lower-third details restrained beneath HTML copy.
Mood: supportive, precise and quietly celebratory. The scene must still be fully understandable when animation is blocked.
Constraints: no character painted into the image; grounded objects; one coherent landmark; physically plausible light paths; unchanged background identity.
Avoid: changed camera, redesigned scene, floating prop sheet, duplicated landmark, excessive glow, giant magic beam, confetti, fireworks, disaster, text, letters, code, runes, signage, UI, caption, logo or watermark.
Output one 2K 16:9 image."""


def unit1_restoration_pilot_prompt() -> str:
    return """Use case: precise-object-edit
Asset type: full-screen portrait illustration for the Unit 1 ending story
Input images: Image 1 is the approved first 9:16 Unit 1 ending pilot and the primary scene/design target. Image 2 is the approved tall Unit 1 board backdrop and world-material reference.
Primary request: Recompose the approved ending as a less elongated 3:4 portrait story image and make the recovery of Moonroot Ruins unmistakably broader than the already-bright Mode Lantern.
Story result: The Mode Lantern wakes. One key can hold more than one meaning—and now the Wilds remember how to listen. The restored route forward becomes welcoming and physically usable.
Preserve: the exact Mode Lantern design from Image 1, its four distinct nested cyan, yellow, magenta and warm-white rings, the water-ruin setting, pixel-art language, architectural identity, palette continuity and quiet sense of wonder.
Environmental restoration: keep the lantern strongly lit, then visibly spread recovery outward. Repair cracked and missing masonry around the central arch, terrace edges and staircase; make stair treads complete, aligned, clean and safe; subtly restore railings or supports where appropriate. Let warm path light climb the right staircase and continue deeper into the ruins. Add tasteful fresh moss, small blooming flowers, young ferns and renewed greenery rooted naturally between stones. Shift the scene from deep night toward very early morning: a gentle cool dawn enters through the upper arches while the lantern and route remain the warm focal lights. The world should feel newly awake, fresh and hopeful—not rebuilt into a different place.
Composition: genuine 3:4 portrait, not a cropped or letterboxed landscape. Put the restored lantern and repaired forward staircase in the middle band. Reserve roughly the upper 30% as calmer, darker dawn sky and restrained ruin silhouettes for a separate HTML narrative overlay at the top; retain subtle real-world texture there, never a blank panel. Keep important details away from the extreme top safe area.
Edit discipline: preserve unrelated scene identity and do not add a character. Changes must read as restoration of the same location, not a new level or a pristine palace.
Avoid: text, letters, numbers, code, runes, caption, UI, logo, watermark, blank text box, poster border, horizontal letterbox, duplicated lantern, extra landmark, overgrown jungle, daytime glare, fantasy explosion, giant beam, confetti or fireworks.
Output one 2K 3:4 image."""


def unit_restoration_3x4_prompt(unit_id: str, unit: dict[str, Any], direction: str) -> str:
    completion = unit["completion"]
    landmark_id = unit["landmark"]["id"]
    return f"""Use case: precise-object-edit
Asset type: full-screen 3:4 portrait illustration for the {unit_id} unit-ending story
Input images: Image 1 is this unit's exact approved tall board scene and the immutable world, architecture, landmark and material reference. Image 2 is the user-approved Unit 1 restoration ending and is a reference only for the degree, clarity and outward spread of recovery; do not copy its Moonroot architecture or landmark into Image 1.
Primary request: Recompose and restore Image 1 as the unmistakable ending of this unit after the off-screen guide action: {completion['action']}.
Landmark result: {LANDMARK_DESCRIPTIONS[landmark_id]}.
Narrative meaning: {completion['copy']}
Candidate direction: {direction}
Obvious before-and-after requirement: the whole image must visibly move forward from dormant, damaged or incomplete to recovered, connected and hopeful. Do not merely increase saturation or add a small glow. Make the landmark's completed physical state immediately readable, repair nearby masonry, stairs, bridges, rails, channels, conduits or mechanisms as appropriate, and show one continuous illuminated route leading onward beyond the restored landmark. The route must be grounded, traversable and physically supported rather than a floating beam.
Environmental recovery: spread the change outward into the same location through cleaner water or glass, renewed reflections, repaired surfaces, aligned mechanisms, fresh moss, young ferns, restrained flowering plants or other world-appropriate living details. Introduce brighter early-morning or newly awakened light while preserving the original palette and atmosphere. The result must look like this exact place recovering, not a different pristine palace.
Continuity and forward motion: make the restored landmark a clear handoff to what comes next. Carry a restrained cyan, amber or world-appropriate current from the foreground, through the completed landmark, and visibly onward along a real path, stair, channel, bridge or conduit into the depth of the scene. For the final unit, let that route resolve into a welcoming junction that visually reconnects the wider Wilds.
Style/medium: preserve the exact polished 2D fantasy pixel-art language, crisp silhouettes, painterly pixel clusters, scale, material vocabulary and world identity of Image 1.
Composition: genuine 3:4 portrait, not a cropped, stretched or letterboxed landscape. Keep the restored landmark and its strongest physical change in the middle band at phone-readable scale. Reserve roughly the upper 28% as calmer real environment with sufficient contrast for separate HTML narrative text at the top; it must remain naturally textured scenery, never a blank panel. Keep important details away from the extreme top safe area and bottom control area.
Constraints: no character painted into the image; exactly one coherent landmark; grounded objects; readable repaired route; same location and architectural identity as Image 1; no baked-in story copy.
Avoid: subtle-only change, unchanged dormant scene, generic glow as the only restoration, copied Moonroot architecture, new world, changed character, horizontal composition, border, letterbox, duplicated landmark, floating prop sheet, unsupported beam, excessive bloom, daytime glare, explosion, confetti, fireworks, text, letters, numbers, code, runes, caption, UI, logo or watermark.
Output one 2K 3:4 image."""


def phone_nix_prompt(direction: str) -> str:
    return f"""Use case: precise-object-edit
Asset type: full-screen portrait profile of Intro Panel 3 for a mobile-game story
Input image: Image 1 is the approved wide Nix-at-the-threshold story composition and immutable design reference.
Primary request: Recompose the same scene as a polished 9:16 portrait illustration that fills a vertically held phone or tablet story screen.
Preserve: the exact Nix design, expression, costume, lantern staff, dormant landmark design, tentative connecting light, Moonroot materials, palette, mood, pixel density and narrative relationship from Image 1.
Responsive composition: retain one full-body Nix and the entire dormant landmark at useful readable scale; create genuine vertical environment above and below rather than cropping or letterboxing; keep a clear visual path between them. Reserve the lower 38% as calmer, darker real scenery with enough contrast for separate HTML narrative copy, while remaining a natural part of the painting rather than an empty panel.
Original candidate direction to preserve: {direction}
Style/medium: polished original 2D fantasy pixel art with crisp silhouettes and painterly pixel clusters, exactly matching Image 1.
Mood: recognition, companionship, curiosity and hopeful invitation; no prophecy, rescue fantasy or triumph.
Constraints: exactly one Nix; all props and architecture physically supported; no baked-in story copy.
Avoid: a horizontal image pasted inside a portrait canvas, borders, letterboxing, duplicate character, missing staff, extra limbs, giant close-up, floating architecture, text, letters, code, runes, caption, UI, logo or watermark.
Output one 2K 9:16 image."""


def phone_unit_prompt(
    unit_id: str,
    unit: dict[str, Any],
    direction: str,
    *,
    has_design_reference: bool,
) -> str:
    completion = unit["completion"]
    landmark_id = unit["landmark"]["id"]
    design_reference = (
        " Image 2 is the corresponding approved wide restored-state concept; transfer its restoration idea and material details into Image 1 without copying its camera."
        if has_design_reference else ""
    )
    return f"""Use case: precise-object-edit
Asset type: full-screen portrait story illustration for the {unit_id} unit ending
Input images: Image 1 is the approved tall board scene and immutable world/material reference.{design_reference}
Primary request: Recompose Image 1 as a genuine 9:16 portrait scene showing the final restored state after this off-screen guide action: {completion['action']}.
Landmark result: {LANDMARK_DESCRIPTIONS[landmark_id]}.
Narrative meaning: {completion['copy']}
World contract: preserve Image 1's terrain, architecture, water, landmark identity, palette, lighting logic, pixel density and material language. Extend and recompose the environment vertically into a seamless portrait painting; do not stretch, crop, frame or paste the source. Show the landmark's physical alignment and illumination, its supported connection path and a restrained nearby environmental response.
Direction for this candidate: {direction}
Style/medium: polished original 2D fantasy pixel art with crisp silhouettes and painterly pixel clusters, exactly matching the references.
Portrait composition: this single image fills the entire unit-ending screen on an iPhone or iPad. Place the restored landmark and its visual payoff in the upper half to middle of the frame at a useful readable scale. Reserve the lower 38% as calmer, darker real scenery with gentle texture and strong text contrast for a separate runtime HTML narrative overlay; it must look like a natural continuation of the world, never a blank text box. Keep essential story details outside the bottom safe-area and button zone. Do not turn the scene into a close-up prop card.
Mood: supportive, precise and quietly celebratory; understandable when all animation is blocked.
Constraints: exactly one coherent landmark; grounded objects; physically plausible supported light paths; no character painted into the image; no baked-in narrative or interface.
Avoid: horizontal letterbox, borders, split layout, poster frame, empty lower rectangle, duplicated landmark, excessive glow, giant magic beam, confetti, fireworks, text, letters, numbers, code, runes, signage, UI, caption, logo or watermark.
Output one 2K 9:16 image."""


def manifest_for(
    *,
    group_id: str,
    kind: str,
    references: list[Path],
    prompts: list[tuple[str, str]],
    unit_id: str | None = None,
    aspect_ratio: str = "16:9",
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "kind": kind,
        "groupId": group_id,
        "unitId": unit_id,
        "model": MODEL,
        "modelFamily": "Gemini Nano Banana",
        "aspectRatio": aspect_ratio,
        "createdAt": datetime.now(UTC).isoformat(),
        "approval": {
            "candidateId": None,
            "approvedAt": None,
            "notes": "Review-only. Choose one or more candidates before production promotion.",
        },
        "references": [
            {"path": str(path.relative_to(ROOT)), "sha256": sha256(path)}
            for path in references
        ],
        "candidates": [
            {
                "id": f"candidate-{index:02d}",
                "directionId": direction_id,
                "path": f"candidate-{index:02d}.png",
                "approvalState": "pending",
                "prompt": prompt,
            }
            for index, (direction_id, prompt) in enumerate(prompts, 1)
        ],
    }


def build_groups(presentation: dict[str, Any]) -> list[tuple[Path, dict[str, Any], list[Path]]]:
    groups: list[tuple[Path, dict[str, Any], list[Path]]] = []
    for panel_id in ("finale-celebration-from-approved-04", "interrupted-deep-neglect-from-approved-04", "interrupted-neglect-from-approved-04", "interrupted-bridges-from-approved-04", "connected-bridge-from-path-04", "connected-path-revision", "interrupted-command", "nix-at-the-threshold"):
        references = (
            [APPROVED_CONNECTED_MASTER]
            if panel_id == "finale-celebration-from-approved-04"
            else [APPROVED_CONNECTED_MASTER, NEGLECT_CANDIDATE_03]
            if panel_id == "interrupted-deep-neglect-from-approved-04"
            else [APPROVED_CONNECTED_MASTER]
            if panel_id in {"interrupted-neglect-from-approved-04", "interrupted-bridges-from-approved-04"}
            else [CONNECTED_BRIDGE_SOURCE]
            if panel_id == "connected-bridge-from-path-04"
            else [CONNECTED_PANORAMA]
            if panel_id in {"connected-path-revision", "interrupted-command"}
            else [NIX_IDLE, MOONROOT_BASE]
        )
        prompts = [
            (direction_id, intro_prompt(panel_id, direction))
            for direction_id, direction in INTRO_DIRECTIONS[panel_id]
        ]
        directory = OUTPUT_ROOT / "intro" / panel_id
        groups.append((directory, manifest_for(
            group_id=panel_id,
            kind="wp11-intro-story-review-candidates-v2",
            references=references,
            prompts=prompts,
        ), references))

    modal_tall_base = ROOT / presentation["units"]["modal-model"]["scenes"]["mode-lantern-grounds"]["profiles"]["tall"]["base"]
    modal_references = [UNIT1_FULLSCREEN_PILOT, modal_tall_base]
    groups.append((
        OUTPUT_ROOT / "unit-endings" / "modal-model-restoration-3x4",
        manifest_for(
            group_id="unit-ending-modal-model-restoration-3x4",
            kind="wp11-unit-ending-restoration-pilot",
            references=modal_references,
            prompts=[("restored-dawn", unit1_restoration_pilot_prompt())],
            unit_id="modal-model-restoration-3x4",
            aspect_ratio="3:4",
        ),
        modal_references,
    ))

    for unit_id, unit in presentation["units"].items():
        scene_id = unit["sceneId"]
        profile = unit["scenes"][scene_id]["profiles"]["wide"]
        source = ROOT / profile["base"]
        prompts = [
            (direction_id, unit_prompt(unit_id, unit, direction))
            for direction_id, direction in UNIT_DIRECTIONS
        ]
        directory = OUTPUT_ROOT / "unit-endings" / unit_id
        groups.append((directory, manifest_for(
            group_id=f"unit-ending-{unit_id}",
            kind="wp11-unit-ending-story-review-candidates",
            references=[source],
            prompts=prompts,
            unit_id=unit_id,
        ), [source]))
    return groups


def build_restoration_3x4_groups(
    presentation: dict[str, Any],
) -> list[tuple[Path, dict[str, Any], list[Path]]]:
    groups: list[tuple[Path, dict[str, Any], list[Path]]] = []
    for unit_id, unit in presentation["units"].items():
        scene_id = unit["sceneId"]
        tall_base = ROOT / unit["scenes"][scene_id]["profiles"]["tall"]["base"]
        references = [tall_base, UNIT1_APPROVED_RESTORATION]
        prompts = [
            (
                direction_id,
                unit_restoration_3x4_prompt(unit_id, unit, direction),
            )
            for direction_id, direction in RESTORATION_3X4_DIRECTIONS
        ]
        planned = manifest_for(
            group_id=f"unit-ending-{unit_id}-restoration-3x4",
            kind="wp11-unit-ending-restoration-3x4",
            references=references,
            prompts=prompts,
            unit_id=unit_id,
            aspect_ratio="3:4",
        )
        for candidate in planned["candidates"]:
            candidate["references"] = [str(path.relative_to(ROOT)) for path in references]
        groups.append((
            OUTPUT_ROOT / "unit-endings" / f"{unit_id}-restoration-3x4",
            planned,
            references,
        ))
    return groups


def phone_manifest(
    *,
    group_id: str,
    kind: str,
    candidates: list[tuple[str, str, list[Path]]],
    unit_id: str | None = None,
) -> tuple[dict[str, Any], list[Path]]:
    references = list(dict.fromkeys(path for _, _, paths in candidates for path in paths))
    manifest = {
        "schemaVersion": 1,
        "kind": kind,
        "groupId": group_id,
        "unitId": unit_id,
        "model": MODEL,
        "modelFamily": "Gemini Nano Banana",
        "aspectRatio": "9:16",
        "createdAt": datetime.now(UTC).isoformat(),
        "approval": {
            "candidateId": None,
            "approvedAt": None,
            "notes": "Full-screen portrait review only. Choose before production promotion.",
        },
        "references": [
            {"path": str(path.relative_to(ROOT)), "sha256": sha256(path)}
            for path in references
        ],
        "candidates": [
            {
                "id": f"candidate-{index:02d}",
                "directionId": direction_id,
                "path": f"candidate-{index:02d}.png",
                "approvalState": "pending",
                "prompt": prompt,
                "references": [str(path.relative_to(ROOT)) for path in paths],
            }
            for index, (direction_id, prompt, paths) in enumerate(candidates, 1)
        ],
    }
    return manifest, references


def build_phone_groups(
    presentation: dict[str, Any],
) -> list[tuple[Path, dict[str, Any], list[Path]]]:
    groups: list[tuple[Path, dict[str, Any], list[Path]]] = []
    nix_wide_root = OUTPUT_ROOT / "intro" / "nix-at-the-threshold"
    nix_candidates = []
    for index, (direction_id, direction) in enumerate(INTRO_DIRECTIONS["nix-at-the-threshold"], 1):
        source = nix_wide_root / f"candidate-{index:02d}.png"
        nix_candidates.append((direction_id, phone_nix_prompt(direction), [source]))
    manifest, references = phone_manifest(
        group_id="nix-at-the-threshold-phone",
        kind="wp11-intro-phone-story-review-candidates",
        candidates=nix_candidates,
    )
    groups.append((PHONE_OUTPUT_ROOT / "intro" / "nix-at-the-threshold", manifest, references))

    for unit_id, unit in presentation["units"].items():
        scene_id = unit["sceneId"]
        tall_base = ROOT / unit["scenes"][scene_id]["profiles"]["tall"]["base"]
        candidates = []
        for index, (direction_id, direction) in enumerate(UNIT_DIRECTIONS, 1):
            wide_concept = OUTPUT_ROOT / "unit-endings" / unit_id / f"candidate-{index:02d}.png"
            has_design_reference = wide_concept.is_file()
            references_for_candidate = [tall_base]
            if has_design_reference:
                references_for_candidate.append(wide_concept)
            candidates.append((
                direction_id,
                phone_unit_prompt(
                    unit_id,
                    unit,
                    direction,
                    has_design_reference=has_design_reference,
                ),
                references_for_candidate,
            ))
        manifest, references = phone_manifest(
            group_id=f"unit-ending-{unit_id}-phone",
            kind="wp11-unit-ending-phone-story-review-candidates",
            candidates=candidates,
            unit_id=unit_id,
        )
        groups.append((PHONE_OUTPUT_ROOT / "unit-endings" / unit_id, manifest, references))
    return groups


def write_contact_sheet(directory: Path, manifest: dict[str, Any]) -> None:
    candidates = [directory / item["path"] for item in manifest["candidates"]]
    if not all(path.is_file() for path in candidates):
        return
    portrait = manifest.get("aspectRatio") in {"3:4", "9:16"}
    tile = (300, 400) if portrait else (480, 268)
    columns = 3 if portrait else 2
    rows = (len(candidates) + columns - 1) // columns
    sheet = Image.new("RGB", (tile[0] * columns, (tile[1] + 34) * rows + 46), "#091511")
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 12), manifest["groupId"], fill="#85e8bb")
    for index, (candidate, data) in enumerate(zip(candidates, manifest["candidates"])):
        with Image.open(candidate) as image:
            preview = ImageOps.fit(image.convert("RGB"), tile, Image.Resampling.LANCZOS)
        left = (index % columns) * tile[0]
        top = 46 + (index // columns) * (tile[1] + 34)
        sheet.paste(preview, (left, top))
        draw.text((left + 8, top + tile[1] + 8), f"{index + 1} · {data['directionId']}", fill="#f0d787")
    sheet.save(directory / "contact-sheet.jpg", quality=90, optimize=True)


def write_restoration_3x4_overview(presentation: dict[str, Any]) -> None:
    tile = (216, 288)
    label_height = 32
    columns = 5
    rows = len(presentation["units"])
    sheet = Image.new("RGB", (tile[0] * columns, 50 + (tile[1] + label_height) * rows), "#07110f")
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 14), "WP-11 · 3:4 unit-ending restoration candidates", fill="#85e8bb")
    for row, (unit_id, unit) in enumerate(presentation["units"].items()):
        directory = OUTPUT_ROOT / "unit-endings" / f"{unit_id}-restoration-3x4"
        for column in range(columns):
            source = directory / f"candidate-{column + 1:02d}.png"
            if not source.is_file():
                continue
            with Image.open(source) as image:
                preview = ImageOps.fit(image.convert("RGB"), tile, Image.Resampling.LANCZOS)
            left = column * tile[0]
            top = 50 + row * (tile[1] + label_height)
            sheet.paste(preview, (left, top))
            label = f"U{row + 1} {unit_id} · {column + 1}" if column == 0 else f"candidate {column + 1}"
            draw.text((left + 6, top + tile[1] + 8), label, fill="#f0d787")
    destination = OUTPUT_ROOT / "unit-endings" / "restoration-3x4-contact-sheet.jpg"
    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, quality=90, optimize=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", help="one group id (panel id or unit id); defaults to every current story group")
    parser.add_argument(
        "--phone-review",
        action="store_true",
        help="Generate 9:16 full-screen portrait review profiles for Intro Panel 3 and every unit ending.",
    )
    parser.add_argument(
        "--restoration-3x4",
        action="store_true",
        help="Generate five clear 3:4 restoration endings for the selected unit group.",
    )
    parser.add_argument("--candidate", type=int, choices=range(1, 6))
    parser.add_argument("--execute", action="store_true", help="submit paid Vertex requests")
    parser.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", ""))
    parser.add_argument("--location", default=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
    parser.add_argument(
        "--gcloud-auth",
        action="store_true",
        help="use a short-lived token from the active gcloud account instead of Application Default Credentials",
    )
    parser.add_argument("--min-request-interval", type=float, default=15.0)
    parser.add_argument("--quota-backoff-seconds", type=float, default=75.0)
    parser.add_argument("--max-quota-retries", type=int, default=3)
    args = parser.parse_args()

    presentation = json.loads(PRESENTATION_PATH.read_text())
    if args.phone_review and args.restoration_3x4:
        raise SystemExit("Choose either --phone-review or --restoration-3x4, not both")
    groups = (
        build_phone_groups(presentation)
        if args.phone_review
        else build_restoration_3x4_groups(presentation)
        if args.restoration_3x4
        else build_groups(presentation)
    )
    if args.group:
        groups = [
            group for group in groups
            if group[1]["groupId"] == args.group or group[1].get("unitId") == args.group
        ]
        if not groups:
            raise SystemExit(f"Unknown story group: {args.group}")

    jobs: list[tuple[Path, Path, dict[str, Any], dict[str, Any], list[Path]]] = []
    for directory, planned_manifest, references in groups:
        missing = [path for path in references if not path.is_file()]
        if missing:
            raise SystemExit(f"Missing immutable reference(s): {', '.join(map(str, missing))}")
        directory.mkdir(parents=True, exist_ok=True)
        manifest_path = directory / "manifest.json"
        manifest = json.loads(manifest_path.read_text()) if manifest_path.is_file() else planned_manifest
        existing_candidate_ids = {candidate["id"] for candidate in manifest["candidates"]}
        manifest["candidates"].extend(
            candidate for candidate in planned_manifest["candidates"]
            if candidate["id"] not in existing_candidate_ids
        )
        planned_candidates = {candidate["id"]: candidate for candidate in planned_manifest["candidates"]}
        for candidate in manifest["candidates"]:
            planned_candidate = planned_candidates.get(candidate["id"])
            if not planned_candidate or candidate["id"] == "candidate-01":
                continue
            for key in ("directionId", "prompt", "references"):
                candidate[key] = planned_candidate[key]
        candidates = manifest["candidates"]
        if args.candidate:
            candidates = [candidates[args.candidate - 1]]
        for candidate in candidates:
            if not (directory / candidate["path"]).is_file():
                candidate_references = [
                    ROOT / path for path in candidate.get("references", [])
                ] or references
                jobs.append((directory, manifest_path, manifest, candidate, candidate_references))
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        write_contact_sheet(directory, manifest)

    print(f"WP-11 story review plan: {len(jobs)} missing {MODEL} image(s) across {len(groups)} group(s)")
    for directory, _, manifest, candidate, _ in jobs:
        print(f"  {manifest['groupId']}/{candidate['id']}: {candidate['directionId']}")
    if not args.execute:
        print("Dry run only; add --execute to submit Gemini Nano Banana Pro requests.")
        return 0
    if not args.project:
        raise SystemExit("Set GOOGLE_CLOUD_PROJECT or pass --project")

    from google import genai
    from google.genai import errors, types
    from google.oauth2.credentials import Credentials

    credentials = None
    if args.gcloud_auth:
        access_token = subprocess.run(
            ["gcloud", "auth", "print-access-token"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        if not access_token:
            raise SystemExit("The active gcloud account returned an empty access token")
        credentials = Credentials(access_token)
    client = genai.Client(
        vertexai=True,
        project=args.project,
        location=args.location,
        credentials=credentials,
    )
    last_submission = 0.0
    for directory, manifest_path, manifest, candidate, references in jobs:
        delay = args.min_request_interval - (time.monotonic() - last_submission)
        if delay > 0:
            time.sleep(delay)
        print(f"Submitting {manifest['groupId']}/{candidate['id']}…", flush=True)
        parts = [
            types.Part.from_text(text=candidate["prompt"]),
            *[
                types.Part.from_bytes(data=path.read_bytes(), mime_type=mime_type(path))
                for path in references
            ],
        ]
        for attempt in range(args.max_quota_retries + 1):
            try:
                response = client.models.generate_content(
                    model=MODEL,
                    contents=parts,
                    config=types.GenerateContentConfig(
                        response_modalities=["IMAGE"],
                        image_config=types.ImageConfig(
                            aspect_ratio=manifest.get("aspectRatio", "16:9"),
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
        destination = directory / candidate["path"]
        destination.write_bytes(extract_image(response))
        with Image.open(destination) as image:
            dimensions = list(image.size)
        candidate.update({
            "sha256": sha256(destination),
            "sourceDimensions": dimensions,
            "generatedAt": datetime.now(UTC).isoformat(),
            "model": MODEL,
            "modelFamily": "Gemini Nano Banana",
        })
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        write_contact_sheet(directory, manifest)
        print(f"Saved {destination.relative_to(ROOT)}", flush=True)
    if args.restoration_3x4:
        write_restoration_3x4_overview(presentation)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
