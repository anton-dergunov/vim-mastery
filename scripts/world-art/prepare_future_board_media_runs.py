#!/usr/bin/env python3
"""Stage the selected Session 23 boards for full-board edits and Veo loops.

This is deliberately a preparation tool.  It creates the same 10-sites-by-5
full-board Nano Banana work packages used by the live scenes, but never spends
quota itself.  Video plans are also recorded here, intentionally blocked until
their source still-board variation has received human approval.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
PATCH_SCRIPT = ROOT / "scripts/world-art/review_wayfinder_patches.py"
PLAN = "docs/implementation/23-future-unit-boards-and-animation-seeds.md"
STAGING_ROOT = ROOT / "artifacts/world-generation/future-board-media-runs"

# These sites were placed only after inspecting the five explicitly selected
# compact source boards.  Bounds are normalized 4:3 source coordinates and are
# used for the compact full-board edit only; responsive profiles are reauthored
# after a selected compact edit has passed review.
SCENES: tuple[dict[str, Any], ...] = (
    {
        "unitId": "viewport-control",
        "sceneId": "beacon-glass-gallery",
        "sceneTitle": "Beacon Glass Gallery",
        "source": "artifacts/world-generation/unit-scenes/viewport-control/candidate-r2-01.png",
        "protectedLandmarkName": "the large teal viewing lens and its brass carriage",
        "landmarkBounds": (0.17, 0.30, 0.23, 0.43),
        "preservationAnchors": "the large teal viewing lens and its brass carriage, gallery floor, drawer wall, floor rails, right wheel mechanism, stone chamber, all outer edges, and the naturally open central editor area",
        "sites": (
            ("upper-side-lens", "small upper brass mounting rail", (0.40, 0.09, 0.09, 0.12), "the small lavender crystal lens in the upper brass rail above the drawer wall", "a single pale lavender faceted lens hanging securely in a small brass fork", "A small side lens folds from a vertical resting angle to a horizontal inspection angle, with its brass hinge and support unchanged."),
            ("upper-glass-pane", "upper stone wall recess", (0.33, 0.10, 0.15, 0.15), "the upper teal glass pane showing shelves and a far amber light", "a teal-glass viewing pane set into a thick dark-stone recess", "Condensation retreats from one peripheral glass pane in branching rivulets, revealing a sharper miniature view of the far shore."),
            ("right-wheel-counterweight", "right-hand vertical wheel mechanism", (0.85, 0.42, 0.12, 0.24), "the exposed brass wheel and dark vertical rail at middle-right", "a large supported brass rim wheel connected to a vertical mechanical guide", "A counterweight rises while the connected lens carriage settles lower on the same visible rail."),
            ("left-wall-beacon", "left stone gallery wall", (0.08, 0.31, 0.08, 0.13), "the small warm amber beacon mounted on the left stone wall beside the main viewing carriage", "a compact amber gallery lamp fixed in a brass wall cradle", "A distant beacon sends one restrained amber pulse that returns as a narrow teal reflection on the gallery floor."),
            ("drawer-wall-prism", "top brass rail above the drawers", (0.62, 0.10, 0.10, 0.12), "the lavender crystal suspended in the brass rail above the chest of drawers", "a single lavender prism held by a visible brass bracket", "A suspended prism fan opens into three distinct glass planes and closes without changing its mounting bracket."),
            ("crystal-drawer-bank", "right-side drawer cabinet", (0.62, 0.18, 0.13, 0.20), "the neat bank of small dark drawers immediately below the suspended prism", "a tall, orderly brass-trimmed chest with many small closed drawers", "A bank of tiny crystal drawers illuminates from bottom to top, then rests dark again; no labels or glyphs appear."),
            ("right-aperture", "far-right rail aperture", (0.88, 0.25, 0.10, 0.14), "the small dark opening and brass rail at the far-right wall above the wheel", "a compact secondary aperture mounted in a brass-and-stone rail", "A brass iris on a secondary aperture narrows, widens, and returns to its original diameter."),
            ("shelf-vial", "right cabinet shelf", (0.76, 0.20, 0.11, 0.11), "the small group of amber bottles on the upper-right shelf", "three small supported amber vessels in a brass-framed shelf", "One shelf-mounted fog collector fills a supported vial with pale violet mist while neighbouring vessels remain unchanged."),
            ("corridor-pendulum", "upper-right brass frame", (0.78, 0.08, 0.09, 0.11), "the small round brass mechanism recessed in the upper-right rail frame", "a compact round dark-brass mechanism resting on a supported horizontal rail", "A distant pendulum at the corridor edge makes one quiet swing, subtly foreshadowing the Echo Clock without becoming a second landmark."),
            ("floor-inlays", "central gallery floor", (0.48, 0.56, 0.18, 0.14), "the three faint brass-and-stone floor inlays just right of the main lens", "three shallow fixed floor details in the otherwise quiet central stone paving", "A narrow reflected highlight travels across three floor inlays at different apparent depths, emphasizing framing rather than travel."),
        ),
    },
    {
        "unitId": "real-code-workflow-capstones",
        "sceneId": "menders-confluence",
        "sceneTitle": "Menders' Confluence",
        "source": "artifacts/world-generation/unit-scenes/real-code-workflow-capstones/candidate-r2-02.png",
        "protectedLandmarkName": "the central glass confluence column and water basin",
        "landmarkBounds": (0.58, 0.20, 0.16, 0.35),
        "preservationAnchors": "the central glass confluence column and water basin, stairways, workshop bays, pipe network, gate, floor grid, all outer edges, and the naturally open central editor area",
        "sites": (
            ("left-turntable", "upper-left stone workbench", (0.08, 0.32, 0.13, 0.14), "the small circular brass turntable at the front edge of the upper-left stone workbench", "a low round brass inspection disk supported on a moss-edged stone bench", "A low brass turntable rotates one irregular component into a new supported inspection angle and returns."),
            ("brass-bench-clamps", "upper-middle brass workbench", (0.36, 0.23, 0.15, 0.15), "the three compact fixtures on the upper-middle brass workbench", "a row of small brass clamps and irregular parts on a grounded workbench", "Three bench clamps close in a deliberate uneven sequence around three differently shaped materials, then release."),
            ("glass-basin-feed", "left side of the central water system", (0.45, 0.34, 0.11, 0.14), "the narrow cyan glass feed tube entering the central confluence column from the left", "a short teal-glass conduit fixed between the workshop and the central basin", "A Starwater glass basin transfers a narrow ribbon of light into an Archive vial without spilling or floating."),
            ("root-seam", "upper-left root-covered wall joint", (0.03, 0.16, 0.11, 0.19), "the cracked mossy stone seam with roots along the far-left workshop wall", "a stable dark-stone joint crossed by grounded brown roots", "A Moonroot cutting takes root across one cracked but stable stone seam, adding a small patch of fresh moss."),
            ("teal-drawer", "upper-left teal drawer bank", (0.19, 0.20, 0.14, 0.20), "one small teal drawer in the orderly upper-left drawer cabinet", "a closed square teal-and-brass workshop drawer in a fixed grid", "A drawer opens to reveal a completely different repair fixture—folded prism, nested spring, or small balance arm—while every other drawer stays fixed."),
            ("ceiling-hoist", "upper-right overhead pipe rail", (0.76, 0.05, 0.16, 0.16), "the overhead brass pipe and rail above the upper-right walkway", "a supported horizontal brass service rail beside large fixed pipes", "A ceiling hoist moves one harmless component between two real rails, with a visible chain or cable carrying the weight."),
            ("inspection-lens-row", "left upper workbench", (0.13, 0.24, 0.13, 0.10), "the row of round inspection lenses and small parts on the upper-left white workbench", "several small round glass lenses and irregular components supported on a pale workbench", "An inspection lens travels across an irregular row of parts and lights only the one whose shape differs."),
            ("test-conduits", "lower-left brass conduits", (0.23, 0.53, 0.12, 0.14), "the three vertical brass conduits at the lower-left edge of the central floor", "three grounded brass test conduits standing together beside a low shelf", "A cyan test current chooses one of three conduits, reaches its grounded endpoint, and drains back before the loop resets."),
            ("recorder-and-jigs", "lower-left service bench", (0.20, 0.73, 0.16, 0.14), "the small recorder cylinder and paired green bench jigs on the lower-left platform", "a compact brass recorder beside two visibly different grounded repair jigs", "A small recorder cylinder turns once while two bench jigs replay different phases of the same mechanical action."),
            ("hanging-swatches", "upper-left workshop rail", (0.31, 0.10, 0.08, 0.11), "the three hanging narrow materials under the upper-left arch", "small root fibre, glass strip, brass ribbon, and crystal-thread swatches hanging from a real rail", "A set of hanging material swatches—root fibre, glass strip, brass ribbon, crystal thread—moves gently at different amplitudes in workshop airflow."),
        ),
    },
    {
        "unitId": "mastery-loops",
        "sceneId": "keepers-relay",
        "sceneTitle": "Keeper's Relay",
        "source": "artifacts/world-generation/unit-scenes/mastery-loops/candidate-r2-01.png",
        "protectedLandmarkName": "the large brass-and-teal relay mechanism on the right platform",
        "landmarkBounds": (0.80, 0.30, 0.15, 0.32),
        "preservationAnchors": "the large brass-and-teal relay mechanism, all supported rail loops, cliffs, workshop cabinets, water horizon, distant lights, all outer edges, and the central ravine",
        "sites": (
            ("upper-loop-trolley", "upper supported rail", (0.31, 0.09, 0.13, 0.10), "the short empty run of the upper curved brass-and-glass rail above the left cliff", "a continuous supported elevated rail with brass uprights and teal glass panels", "A maintenance trolley completes one short loop on a supported rail and docks exactly where it began."),
            ("route-lamps", "upper left rail parapet", (0.13, 0.20, 0.15, 0.09), "the small warm lamps along the upper-left rail parapet", "several tiny amber route lamps fixed to the dark stone-and-brass rail", "Four route lamps pulse at distinct intervals before settling into a quiet shared rhythm."),
            ("central-distributor", "middle rail crossing", (0.52, 0.46, 0.13, 0.11), "the narrow brass distributor bridge connecting the middle rail toward the right platform", "a small supported brass junction beneath the central crossing rail", "A sealed message capsule enters one distributor and leaves through three different conduits in succession, never duplicating in mid-air."),
            ("lower-switch-bridge", "lower central rail loop", (0.45, 0.65, 0.15, 0.13), "the tight lower brass rail loop emerging from the ravine near the bottom centre", "a compact supported loop of brass rail with a visible switching joint", "A relay bridge switches between two physically plausible track alignments using a visible brass pivot."),
            ("field-note-case", "left glass display cabinet", (0.03, 0.55, 0.18, 0.16), "the glass-fronted cabinet on the left terrace", "a low brass-and-glass cabinet with drawers and blank pale papers behind its panes", "A blank glass field-note slip slides from a drawer into a protected viewing cradle, catches cyan light, and returns unreadable."),
            ("material-chime", "upper central workbench", (0.43, 0.24, 0.13, 0.12), "the hanging hand tools on the small upper-central workbench", "a compact wall-mounted tool rack and workbench supported on the cliff platform", "A wind-driven chime uses four different supported materials and produces four visibly different motions without musical symbols."),
            ("starwater-reflection", "distant water horizon", (0.61, 0.10, 0.17, 0.12), "the calm dark-water horizon beyond the upper central rail", "the distant Starwater surface and a faint reflected light beyond the open relay", "A distant Starwater reflection brightens when the corresponding relay lens turns toward it, then fades as the lens returns."),
            ("capsule-carousel", "right relay side cabinet", (0.67, 0.47, 0.12, 0.18), "the small dark service cabinet immediately left of the large relay mechanism", "a narrow grounded brass service cabinet with small mechanical compartments", "A small Archive capsule carousel indexes one position at a time, with no labels or glyphs."),
            ("moonroot-support", "left cliff parapet", (0.08, 0.43, 0.12, 0.13), "the mossy stone support below the left glass cabinet", "a dark stone wall with restrained Moonroot moss along the left terrace edge", "Moss at a Moonroot-stone support briefly releases restrained violet spores that remain local and drift out of view."),
            ("outward-signal", "far-right outward rail", (0.96, 0.39, 0.04, 0.11), "the short brass rail leaving the main relay mechanism toward the far-right edge", "a grounded outward-facing brass-and-teal signal conduit attached to the right relay platform", "One outward signal travels beyond the frame while the return loops remain calm, making continued practice feel open rather than compulsory."),
        ),
    },
    {
        "unitId": "mosslight-landing",
        "sceneId": "mosslight-landing",
        "sceneTitle": "Mosslight Landing",
        "source": "artifacts/world-generation/unit-scenes/mosslight-landing/candidate-r2-05.png",
        "protectedLandmarkName": "the nested luminous stone cups beneath the great root",
        "landmarkBounds": (0.19, 0.38, 0.06, 0.15),
        "preservationAnchors": "the nested luminous stone cups beneath the great root, water channel, stone bridge, root arch, distant path light, all outer edges, and the open landing paving",
        "sites": (
            ("trail-chime-bracket", "left root bracket", (0.12, 0.18, 0.10, 0.13), "the small cyan mushrooms and root nook on the upper-left side of the great tree", "a cluster of tiny luminous mushrooms and a visible rooted wooden bracket", "Three trail-chime pieces sway at different speeds from one visible root bracket and settle without touching."),
            ("water-drop-ripple", "foreground channel", (0.39, 0.76, 0.17, 0.13), "the small circular ripple in the foreground water below the bridge", "calm dark teal water with a single faint round ripple and nearby lily pads", "A ring of water expands from one falling droplet, nudges nearby lily pads, and disappears at the stone bank."),
            ("paired-mushrooms", "upper-left mossy root", (0.28, 0.21, 0.11, 0.10), "the cyan and violet mushroom clusters on the mossy root above the stone cups", "small neighbouring cyan and violet mushroom caps growing from a grounded root", "One cyan mushroom opens while a neighbouring violet cap folds closed, then both return to rest."),
            ("stepping-stone-seam", "middle-left stone landing", (0.26, 0.55, 0.14, 0.10), "the damp stepping stones between the stone cups and the bridge", "two low moss-edged stepping stones on the stable landing paving", "A turquoise mineral seam brightens beneath one stepping stone and passes its light to the next two stones."),
            ("bridge-vine", "centre bridge rail", (0.47, 0.49, 0.15, 0.12), "the small root bridge and its stone rail at the middle of the water channel", "a short supported stone-and-root bridge across the channel", "A tiny root bridge lowers a handrail-like vine into a secure resting notch and raises it again."),
            ("travel-niche", "left tree hollow", (0.09, 0.43, 0.09, 0.12), "the dark oval travel niche inside the great tree trunk", "a small empty tree hollow in the thick left trunk, naturally supported by the wood", "A travel niche reveals a folded blank cloth, seed pod, or glass flask in different candidates without becoming an open treasure chest."),
            ("damp-fern", "middle-left masonry joint", (0.36, 0.43, 0.11, 0.13), "the damp mossy masonry joint above the left side of the bridge", "a low cracked stone joint partly held by roots and moss", "A fern slowly uncurls from a damp masonry joint and casts a small reflection."),
            ("moss-spore-patch", "lower-left root moss", (0.18, 0.64, 0.11, 0.13), "the dense moss patch on the lower-left roots beside the water", "a grounded green moss patch wrapped around thick roots at the water edge", "Restrained violet spores rise from one moss patch, circle the scenic anchor, and fade locally."),
            ("distant-path-glow", "far-right path", (0.79, 0.30, 0.12, 0.16), "the warm lamp and winding path visible through the right root arch", "a distant amber path light along a supported stone route beyond the arch", "A warm distant path glow briefly reflects across the water toward the landing, pointing onward without an arrow."),
            ("cup-channel", "nested cup spillway", (0.27, 0.39, 0.14, 0.15), "the narrow cyan spillway joining the three nested stone cups", "a physically connected luminous water channel between the stacked stone cups", "Two nested stone cups fill and tip in sequence, passing luminous water along a physically connected channel."),
        ),
    },
    {
        "unitId": "open-trail-overlook",
        "sceneId": "open-trail-overlook",
        "sceneTitle": "Open Trail Overlook",
        "source": "artifacts/world-generation/unit-scenes/open-trail-overlook/candidate-r2-03.png",
        "protectedLandmarkName": "the brass horizon telescope and its stone plinth",
        "landmarkBounds": (0.56, 0.33, 0.17, 0.20),
        "preservationAnchors": "the brass horizon telescope and its stone plinth, terrace paving, glass railings, cyan route conduits, distant lake and mountains, upper path, all outer edges, and the open central overlook",
        "sites": (
            ("horizon-lens", "upper-left terrace rail", (0.17, 0.24, 0.09, 0.10), "the small brass inspection lens mounted at the upper-left terrace railing", "a small circular teal lens supported in a low brass fork on the terrace rail", "A low horizon lens rotates on a visible fork and briefly brings one distant regional light into sharper colour before returning."),
            ("terrace-routes", "upper-left terrace conduit", (0.09, 0.17, 0.22, 0.11), "the four cyan and amber route lines leaving the upper-left terrace toward the distant hills", "several thin grounded luminous conduits and rails leading away from the terrace", "The already-lit routes behind the terrace pulse one at a time from the four directions and settle together without creating a rainbow."),
            ("wind-vane", "left rail corner", (0.21, 0.25, 0.10, 0.12), "the small warm lamp and short brass fixture on the upper-left railing", "a compact brass-and-stone rail fixture securely mounted at the terrace edge", "A small brass wind vane changes bearing while its stone base and counterweight remain fixed."),
            ("starwater-clouds", "distant lake reflection", (0.48, 0.20, 0.18, 0.10), "the pale distant lake directly behind the telescope", "a quiet pale Starwater reflection between the warm mountain ridges", "Clouds reveal and then softly veil the Starwater reflection far below, changing only atmospheric light."),
            ("courier-conduit", "left foreground cyan conduit", (0.02, 0.60, 0.15, 0.17), "the bright cyan conduit climbing the far-left wall and turning into the foreground railing", "a grounded cyan route conduit embedded in dark stone and brass framing", "A supported courier capsule arrives from Keeper's Relay, docks, and departs along the ordinary open trail conduit."),
            ("moss-maintenance-seam", "right rock-side brass seam", (0.79, 0.47, 0.14, 0.14), "the brass seam and small maintenance panel beside the right foreground rocks", "a narrow brass service seam with a grounded dark stone joint beside it", "Moonroot moss grows over one near brass seam while a tiny maintenance brush mechanism clears a neighbouring joint."),
            ("railing-prisms", "middle glass railing", (0.37, 0.43, 0.17, 0.10), "the teal glass prism panels in the central railing below the telescope", "a row of fixed teal glass railing panels in brass frames", "Archive-glass prisms in the railing catch amber lights in a travelling but localized reflection."),
            ("terrace-lift", "lower-right service opening", (0.88, 0.82, 0.11, 0.15), "the cyan-lit lower service passage at the bottom-right edge", "a vertical terrace service opening with a narrow cyan-lit conduit", "A terrace lift rises from a lower service level carrying a harmless blank crate, pauses, and returns."),
            ("distant-bridge", "far-left horizon route", (0.13, 0.13, 0.15, 0.10), "the distant route bridge and lights beyond the upper-left terrace", "a very distant supported bridge with small warm light points in the mountain view", "One distant bridge illuminates from near end to far end, making continued travel tangible without drawing an arrow."),
            ("horizon-light-band", "upper far horizon", (0.53, 0.04, 0.28, 0.13), "the broad evening sky band above the lake and mountains", "the distant orange-to-violet horizon while all terrace foreground lighting remains stable", "An evening-to-dawn band of light moves only across the far horizon while the terrace exposure and foreground remain stable enough for the editor."),
        ),
    },
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n")


def still_changes(seed: str) -> list[str]:
    """Turn one motion seed into five distinct full-board still-edit directions."""
    return [
        f"Depict this local change at its clearest fully activated, supported state: {seed}",
        f"Depict a visibly different alternate configuration of this exact local change, with a new readable silhouette or material response while retaining its named support: {seed}",
        f"Depict the local change at a contrasting return-phase state, showing its physical mechanism or contact detail clearly rather than using a tint or loose particles: {seed}",
        f"Depict a materially distinct but still physically plausible version of this local change, preserving every neighbouring object and the named support: {seed}",
        f"Depict the local change at its strongest legible moment with a different local reflection, glow, or supported arrangement from the other candidates: {seed}",
    ]


def video_prompt(scene: dict[str, Any], site: dict[str, Any]) -> str:
    return f"""Use the approved complete {scene['sceneTitle']} board as the exact first frame and visual reference. Create one seamless 6 second environmental loop with a completely locked camera. Animate only {site['motionSeed']} Preserve {scene['preservationAnchors']}. The motion must remain subtle behind a live code editor, have no cut or camera move, and settle exactly back into the opening state. No character, text, symbol, code, UI, new object, disappearing object, geometry drift, morphing architecture, zoom, pan, tilt, rack focus, particles crossing the whole board, logo, or watermark."""


def build_config(scene: dict[str, Any]) -> dict[str, Any]:
    return {
        "unitId": scene["unitId"],
        "sceneId": scene["sceneId"],
        "sceneTitle": scene["sceneTitle"],
        "compactBase": scene["source"],
        "protectedLandmarkName": scene["protectedLandmarkName"],
        "landmarkBounds": list(scene["landmarkBounds"]),
        "preservationAnchors": scene["preservationAnchors"],
        "workPackage": f"S23-{scene['sceneId']}-A",
        "sites": [
            {
                "id": site_id,
                "surface": surface,
                "bounds": list(bounds),
                "locator": locator,
                "appearance": appearance,
                "changes": still_changes(seed),
            }
            for site_id, surface, bounds, locator, appearance, seed in scene["sites"]
        ],
    }


def stage(scene: dict[str, Any], round_number: int) -> None:
    config_path = STAGING_ROOT / scene["sceneId"] / "scene-config.json"
    write_json(config_path, build_config(scene))
    subprocess.run(
        [sys.executable, str(PATCH_SCRIPT), "--scene-config", str(config_path), "--round", str(round_number), "stage"],
        cwd=ROOT,
        check=True,
    )


def video_plan(scene: dict[str, Any], round_number: int) -> dict[str, Any]:
    root = ROOT / "artifacts/world-generation/patch-reviews" / scene["sceneId"] / f"round-{round_number:02d}"
    manifest_path = root / "approval-manifest.json"
    inventory_path = root / "object-inventory.json"
    if not manifest_path.is_file() or not inventory_path.is_file():
        raise RuntimeError(f"Stage the still-board batch first: {scene['sceneId']}")
    manifest = json.loads(manifest_path.read_text())
    inventory = json.loads(inventory_path.read_text())
    by_id = {site[0]: site for site in scene["sites"]}
    runs = []
    for site in inventory["sites"]:
        seed = by_id[site["id"]][5]
        runs.append({
            "id": f"{scene['sceneId']}-{site['id']}-loop",
            "sceneId": scene["sceneId"],
            "siteId": site["id"],
            "provider": "Google Vertex AI Veo",
            "durationSeconds": 6,
            "inputRequirement": "one human-approved matching complete-board still variation from the paired Nano Banana work package",
            "approvalState": "blocked-until-still-board-approved",
            "prompt": video_prompt(scene, {"motionSeed": seed}),
        })
    return {
        "schemaVersion": 1,
        "purpose": "optional locked-camera environmental loops; do not submit until a matching board edit is explicitly approved",
        "sourcePlan": PLAN,
        "createdAt": datetime.now(UTC).isoformat(),
        "sceneId": scene["sceneId"],
        "pairedStillManifest": str(manifest_path.relative_to(ROOT)),
        "pairedStillCandidateCount": len(manifest["candidates"]),
        "sourceBoard": inventory["fullBoard"],
        "runCount": len(runs),
        "runs": runs,
    }


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--round", type=int, default=1)
    parser.add_argument("--scene", action="append", choices=[scene["sceneId"] for scene in SCENES])
    parser.add_argument("--stage", action="store_true", help="stage reusable Nano Banana full-board edit manifests")
    parser.add_argument("--video-plans", action="store_true", help="write blocked-until-approved locked-camera Veo plans")
    args = parser.parse_args()
    if not args.stage and not args.video_plans:
        parser.error("select --stage, --video-plans, or both")
    selected = tuple(scene for scene in SCENES if not args.scene or scene["sceneId"] in args.scene)
    if args.stage:
        for scene in selected:
            stage(scene, args.round)
    if args.video_plans:
        combined = []
        for scene in selected:
            plan = video_plan(scene, args.round)
            destination = STAGING_ROOT / scene["sceneId"] / "video-run-plan.json"
            write_json(destination, plan)
            combined.append({
                "sceneId": scene["sceneId"],
                "stillCandidates": plan["pairedStillCandidateCount"],
                "videoRuns": plan["runCount"],
                "path": str(destination.relative_to(ROOT)),
            })
        write_json(STAGING_ROOT / "run-summary.json", {
            "schemaVersion": 1,
            "sourcePlan": PLAN,
            "stillCandidateTotal": sum(item["stillCandidates"] for item in combined),
            "videoRunTotal": sum(item["videoRuns"] for item in combined),
            "scenes": combined,
        })
    print(f"Prepared {len(selected)} scene(s); no paid requests were submitted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
