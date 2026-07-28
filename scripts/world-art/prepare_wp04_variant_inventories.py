#!/usr/bin/env python3
"""Write the ten reviewed WP-04 complete-board variation inventories.

This is intentionally a planning-only step: it creates the exact site and
transformation descriptions consumed by ``review_wayfinder_patches.py`` but
does not call Vertex.
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DESTINATION = ROOT / "artifacts" / "world-generation" / "wp04-variant-inventories"

COMMON_AVOIDS = [
    "dragon eyes beneath water", "spirit fish or frogs", "whirlpools and star-water vortices",
    "carved animal-mouth fountains", "open treasure luggage or mimic chests", "leaf boats",
    "floating root islands", "crystal-sail boats", "waterfall shrines", "crystal hatchlings",
]

REGION_SITES = {
    "starwater-sanctuary": [
        ("upper-left-terrace", "upper-left stone terrace", "the small supported feature on the upper-left observatory terrace"),
        ("upper-right-parapet", "upper-right glass or stone parapet", "the small supported feature on the upper-right parapet"),
        ("left-water-bank", "left mirror-water bank", "the distinctive object or crystal at the left water edge"),
        ("right-water-bank", "right mirror-water bank", "the distinctive object or crystal at the right water edge"),
        ("left-bridge-rail", "left bridge or causeway rail", "the small landmark attached to the left bridge or causeway rail"),
        ("right-bridge-rail", "right bridge or causeway rail", "the small landmark attached to the right bridge or causeway rail"),
        ("lower-left-shore", "lower-left stone shore", "the small object on the lower-left shore"),
        ("lower-right-shore", "lower-right stone shore", "the small object on the lower-right shore"),
        ("distant-left-island", "distant left island or platform", "the small distant supported feature on the left island"),
        ("distant-right-island", "distant right island or platform", "the small distant supported feature on the right island"),
    ],
    "archive-of-echoes": [
        ("upper-left-niche", "upper-left stone archive niche", "the small illuminated object in the upper-left archive niche"),
        ("upper-right-niche", "upper-right stone archive niche", "the small illuminated object in the upper-right archive niche"),
        ("left-drawer-bank", "left bank of crystal drawers or shelves", "the small feature mounted on the left drawer bank"),
        ("right-drawer-bank", "right bank of crystal drawers or shelves", "the small feature mounted on the right drawer bank"),
        ("left-landing", "left stone landing", "the small supported object on the left landing"),
        ("right-landing", "right stone landing", "the small supported object on the right landing"),
        ("lower-left-ledge", "lower-left archive ledge", "the small object on the lower-left ledge"),
        ("lower-right-ledge", "lower-right archive ledge", "the small object on the lower-right ledge"),
        ("distant-left-shelf", "distant left shelf or arch", "the small feature on the distant left shelf or arch"),
        ("distant-right-shelf", "distant right shelf or arch", "the small feature on the distant right shelf or arch"),
    ],
    "brass-meridian": [
        ("upper-left-conduit", "upper-left copper conduit or brass rail", "the small supported mechanism at the upper-left conduit"),
        ("upper-right-lens", "upper-right lens housing or brass rail", "the small supported mechanism at the upper-right lens housing"),
        ("left-rail-junction", "left rail or conduit junction", "the small grounded feature at the left rail junction"),
        ("right-rail-junction", "right rail or conduit junction", "the small grounded feature at the right rail junction"),
        ("left-platform", "left brass platform", "the small supported object on the left brass platform"),
        ("right-platform", "right brass platform", "the small supported object on the right brass platform"),
        ("lower-left-walkway", "lower-left walkway", "the small mechanism beside the lower-left walkway"),
        ("lower-right-walkway", "lower-right walkway", "the small mechanism beside the lower-right walkway"),
        ("distant-left-structure", "distant left workshop structure", "the small feature on the distant left workshop structure"),
        ("distant-right-structure", "distant right workshop structure", "the small feature on the distant right workshop structure"),
    ],
}

SCENES = [
    ("precision-motions-search", "starneedle-observatory", "starwater-sanctuary", "Starneedle Observatory", "the observatory needle, floating lens, mirror-water, islands, bridges, and outer skyline", ["star compass", "moonlit sextant", "glass navigation buoy", "constellation bell", "prism sundial", "orbital water gauge", "star-map lantern without writing", "crystal tide marker", "silver viewing scope", "ringed sky dial"]),
    ("text-objects", "nested-garden", "starwater-sanctuary", "Nested Garden", "the nested arches, shallow terraces, water reflections, distant domes, and outer skyline", ["nested glass bell", "five-petal prism bloom", "small arch within an arch", "luminous boundary stones", "waterborne glass lantern", "crystal-inlaid basin", "stacked moon rings", "folded translucent screen", "terrace wind chime", "mirror-surface pebble garden"]),
    ("visual-selection", "prism-crossing", "starwater-sanctuary", "Prism Crossing", "the supported glass panes, bridge piers, water reflections, distant platforms, and outer skyline", ["three-pane prism mobile", "segmented glass beacon", "hinged crystal fan", "ribbon-like light bridge marker", "row of upright panes", "blocky prism cairn", "faceted lantern pod", "triangular reflection marker", "glass hinge sculpture", "shifting-color signal mast"]),
    ("registers-putting", "memory-archive", "archive-of-echoes", "Memory Archive", "the crystal drawer cabinet, stone chamber, shelves, bridges, and all outer architecture", ["memory vial carousel", "brass drawer keywheel", "teal bottle shrine", "suspended record cylinder", "crystal filing lantern", "amber index orb without writing", "tiny drawer-clock", "glass storage bell", "cabinet-bound prism relay", "violet memory slate without symbols"]),
    ("long-range-navigation", "far-beacons", "archive-of-echoes", "Far Beacons", "the two beacons, supported causeways, archive ravine, shelves, and all outer architecture", ["thread-light relay", "brass signal lantern", "distance marker obelisk", "teal message capsule", "bridge chime tower", "two-part beacon dial", "glowing route knot", "crystal semaphore without signs", "far-view lens", "paired amber signal cups"]),
    ("repeatable-editing", "echo-clock", "archive-of-echoes", "Echo Clock", "the clock wheel, related mechanisms, gallery, shelves, water channel, and all outer architecture", ["five-step gear flower", "looping pendulum lantern", "echoing chime stack", "small repeating wheel train", "brass metronome shrine", "clockwork blossom", "teal cadence vial rack", "turning drum beacon", "linked timing stones", "amber sequence globe"]),
    ("command-line-ranges-line-operations", "meridian-table", "brass-meridian", "Meridian Table", "the broad route table, endpoint markers, cyan current, rails, conduits, water channels, and outer workshop", ["paired endpoint lanterns", "brass route compass", "cyan current valve", "three-way rail indicator", "glass range marker", "copper measure wheel", "linked signal cups", "small alignment tower", "teal conduit flower", "precise balance arm"]),
    ("substitution-practical-regex", "mirror-loom", "brass-meridian", "Mirror Loom", "the loom, selected threads, lens housings, rails, copper supports, and all outer workshop architecture", ["five-lens mirror chain", "selective color shuttle", "glass thread spool", "copper pattern wheel", "teal filament lantern", "brass matcher gate", "prism bobbin rack", "hinged reflection fan", "thread-counting abacus without text", "violet change vial"]),
    ("macros", "echo-foundry", "brass-meridian", "Echo Foundry", "the recorder cylinders, replay mechanisms, tree-integrated architecture, platforms, conduits, and outer workshop", ["recorder cylinder lantern", "three-arm replay crank", "copper memory drum", "root-held brass bell", "cyan sequence capsule", "mechanical echo bird without text", "linked piston flower", "amber playback horn", "glass timing jar", "repeat-motion pendulum"]),
    ("global-normal-automation", "meridian-engine", "brass-meridian", "Meridian Engine", "the current junction, glass engine, rails, conduits, supporting platforms, and all outer workshop architecture", ["convergence prism", "four-route valve", "brass coordination globe", "cyan junction lantern", "linked compass petals", "glass current reservoir", "multi-arm relay wheel", "teal alignment beacon", "precision chime array", "amber control crystal without symbols"]),
]


def bounds(index: int) -> list[float]:
    positions = [
        (0.03, 0.08), (0.84, 0.08), (0.02, 0.35), (0.86, 0.35), (0.12, 0.52),
        (0.76, 0.52), (0.03, 0.72), (0.85, 0.72), (0.17, 0.20), (0.68, 0.20),
    ]
    x, y = positions[index]
    return [x, y, 0.12, 0.14]


UNIQUE_OBJECTS = [
    "suspended glass astrolabe", "three-tier moon-bell", "small copper rain organ", "violet seed reliquary", "folded prism fan",
    "brass tide clock", "living crystal fern stand", "amber listening horn", "nested mirror bowl", "tiny stone observatory",
    "luminous bead abacus", "rootless floating-light mobile on a visible bracket", "moss-bound sundial", "blueglass water gauge", "five-cup chime rack",
    "circular mosaic compass", "hinged lens flower", "miniature bridge beacon", "shelved bottle conservatory", "spiral shell lantern",
    "copper balance arm", "stacked cloud-glass terrarium", "three-stone memory cairn", "mechanical firefly carousel", "crystal weather vane",
    "low brass projector", "arched aquarium window", "pendulum lantern tower", "carved stone hand holding a gem", "hanging seed-pod chorus",
    "small wheel-and-ribbon kinetic sculpture", "porcelain moon jar", "four-pane prism screen", "bracketed star map globe without markings", "glass reed harp",
    "bronze pulse drum", "miniature waterless fountain", "teal filament loom", "clockwork lily platform", "caged aurora capsule",
    "three-arm signal spinner", "crystal-cored tea set", "faceted echo horn", "two-level glass aviary without birds", "weathered mechanism cabinet",
    "magnetic stone ring", "luminous paper-fold sculpture", "brass spiral staircase model", "small constellation lantern without symbols", "glowing mineral windcatcher",
]


def changes(concept: str, title: str, site_index: int) -> list[str]:
    objects = UNIQUE_OBJECTS[site_index * 5:(site_index + 1) * 5]
    verbs = ["Replace", "Build", "Reveal", "Create", "Install"]
    return [
        f"{verb} the target with a {object}, a wholly new readable silhouette for {title}. Let it subtly echo {concept}, but do not reuse any object, creature, vessel, lamp, bird, canister, or mechanism from another candidate in this batch. Keep it physically attached to the named support."
        for verb, object in zip(verbs, objects)
    ]


def main() -> int:
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for unit_id, scene_id, world_id, title, anchors, concepts in SCENES:
        sites = []
        for index, (site_id, surface, locator) in enumerate(REGION_SITES[world_id]):
            concept = concepts[index]
            sites.append({
                "id": site_id,
                "surface": surface,
                "bounds": bounds(index),
                "locator": locator,
                "appearance": f"a small existing supported detail in {title} at the marked location",
                "changes": changes(concept, title, index),
            })
        payload = {
            "workPackage": "WP-04P-A",
            "unitId": unit_id,
            "sceneId": scene_id,
            "sceneTitle": title,
            "compactBase": f"assets/worlds/{world_id}/scenes/{scene_id}/compact/base.png",
            "landmarkBounds": [0.35, 0.30, 0.30, 0.35],
            "preservationAnchors": anchors,
            "avoidRecurringMotifs": COMMON_AVOIDS,
            "sites": sites,
        }
        path = DESTINATION / f"{scene_id}.json"
        path.write_text(json.dumps(payload, indent=2) + "\n")
        print(path.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
