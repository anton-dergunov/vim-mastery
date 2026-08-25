#!/usr/bin/env python3
"""Catalogue, generate, approve, and convert the Vim Wilds character cast.

All paid subcommands are dry-run by default.  ``--execute`` is required for a
Vertex call, and execution is gated by catalogue/static approvals plus a
shared append-only cost ledger.  Raw generations live under the ignored
``artifacts/character-generation`` directory; approved runtime assets and
their provenance metadata live under ``assets/characters``.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np
from PIL import Image, ImageDraw

import animate_character
import convert_veo_animation as converter


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
CATALOGUE_PATH = SCRIPT_DIR / "character_catalogue.json"
CATALOGUE_MD_PATH = SCRIPT_DIR / "character_catalogue.md"
APPROVALS_PATH = SCRIPT_DIR / "character_approvals.json"
VIDEO_REVIEW_PATH = SCRIPT_DIR / "character_video_review.json"
ASSET_ROOT = ROOT / "assets" / "characters"
DEFAULT_ARTIFACT_ROOT = ROOT / "artifacts" / "character-generation"
LEDGER_NAME = "ledger.jsonl"
OPERATIONS_NAME = "operations.json"
BACKGROUND = (26, 32, 30, 255)
DEFAULT_BUDGET = 100.0
RUNTIME_QUALITY = 88
REACTION_IDS = ("attentive", "puzzled", "encouraging")
SELECTED_REACTIONS_ROOT = DEFAULT_ARTIFACT_ROOT / "__selected"
SELECTED_REACTION_REPAIRS = SCRIPT_DIR / "selected_reaction_repairs.json"


class PipelineError(RuntimeError):
    """Raised when a generation gate or asset invariant is violated."""


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise PipelineError(f"Could not read {path}: {error}") from error


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, indent=2, sort_keys=False) + "\n"
    if not path.exists() or path.read_text() != text:
        path.write_text(text)


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_catalogue(path: Path = CATALOGUE_PATH) -> dict[str, Any]:
    catalogue = read_json(path)
    validate_catalogue(catalogue)
    return catalogue


def validate_catalogue(catalogue: dict[str, Any]) -> None:
    if catalogue.get("schema_version") != 1:
        raise PipelineError("Catalogue schema_version must be 1")
    characters = catalogue.get("characters", [])
    actions = catalogue.get("actions", [])
    if len(characters) != 15:
        raise PipelineError(f"Catalogue must contain 15 characters, found {len(characters)}")
    if len(actions) != 13:
        raise PipelineError(f"Catalogue must contain 13 actions, found {len(actions)}")
    character_ids = [item.get("id") for item in characters]
    action_ids = [item.get("id") for item in actions]
    reaction_variant_three = catalogue.get("reaction_variant_three", {})
    for reaction in ("attentive", "puzzled", "encouraging"):
        directions = reaction_variant_three.get(reaction, [])
        if len(directions) != 5 or not all(
            isinstance(item, str) and item.strip() for item in directions
        ):
            raise PipelineError(
                f"reaction_variant_three.{reaction} must contain five non-empty directions"
            )
    overrides = catalogue.get("reaction_variant_three_overrides", {})
    if not isinstance(overrides, dict):
        raise PipelineError("reaction_variant_three_overrides must be an object")
    for character_id, reaction_overrides in overrides.items():
        if not isinstance(reaction_overrides, dict):
            raise PipelineError(
                f"reaction_variant_three_overrides.{character_id} must be an object"
            )
        for reaction, direction in reaction_overrides.items():
            if reaction not in {"attentive", "puzzled", "encouraging"}:
                raise PipelineError(f"Unknown reaction variant override: {character_id}/{reaction}")
            if not isinstance(direction, str) or not direction.strip():
                raise PipelineError(f"Empty reaction variant override: {character_id}/{reaction}")
    variant_four = catalogue.get("reaction_variant_four", {})
    if set(variant_four) != set(character_ids):
        raise PipelineError("reaction_variant_four must contain every character exactly once")
    for character_id, reactions in variant_four.items():
        if not isinstance(reactions, dict) or set(reactions) != {
            "attentive", "puzzled", "encouraging"
        }:
            raise PipelineError(
                f"reaction_variant_four.{character_id} must contain attentive, puzzled and encouraging"
            )
        if not all(isinstance(value, str) and value.strip() for value in reactions.values()):
            raise PipelineError(f"reaction_variant_four.{character_id} contains an empty description")
    if len(set(character_ids)) != len(character_ids) or not all(character_ids):
        raise PipelineError("Character IDs must be present and unique")
    if len(set(action_ids)) != len(action_ids) or not all(action_ids):
        raise PipelineError("Action IDs must be present and unique")
    required = {
        "name", "species", "role", "description", "invariants", "motion",
        "prop_motion", "magic", "project", "prop_trick", "illusion", "signature",
        "attentive", "puzzled", "encouraging",
    }
    for character in characters:
        missing = sorted(required - character.keys())
        if missing:
            raise PipelineError(f"{character.get('id', '<unknown>')} is missing {', '.join(missing)}")
        for action in actions:
            try:
                action["template"].format(**character)
            except (KeyError, ValueError) as error:
                raise PipelineError(f"Cannot expand {character['id']}/{action['id']}: {error}") from error
    if character_ids[0] != "nix":
        raise PipelineError("Nix must remain the first canonical character")


def character_by_id(catalogue: dict[str, Any], character_id: str) -> dict[str, Any]:
    for character in catalogue["characters"]:
        if character["id"] == character_id:
            return character
    raise PipelineError(f"Unknown character: {character_id}")


def action_by_id(catalogue: dict[str, Any], action_id: str) -> dict[str, Any]:
    for action in catalogue["actions"]:
        if action["id"] == action_id:
            return action
    raise PipelineError(f"Unknown animation: {action_id}")


def action_description(character: dict[str, Any], action: dict[str, Any]) -> str:
    return action["template"].format(**character)


def still_seed(catalogue: dict[str, Any], character: dict[str, Any], candidate: int) -> int:
    return 1000 + catalogue["characters"].index(character) * 100 + candidate


def video_seed(
    catalogue: dict[str, Any],
    character: dict[str, Any],
    action: dict[str, Any],
    variant_index: int = 1,
) -> int:
    if variant_index < 1:
        raise PipelineError("Video variant_index must be at least 1")
    return (
        2000
        + catalogue["characters"].index(character) * 100
        + catalogue["actions"].index(action)
        + (variant_index - 1) * 10_000
    )


def still_prompt(catalogue: dict[str, Any], character: dict[str, Any]) -> str:
    world = catalogue["world"]
    invariants = "\n".join(f"- {item}" for item in character["invariants"])
    rules = "\n".join(f"- {item}" for item in world["rendering_rules"])
    return f"""Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create {character['name']}, an original {character['species']} and {character['role']} for The Vim Wilds.
Subject: {character['description']}
Style/medium: {world['style']}
Composition/framing: {world['composition']}
Color palette: {world['palette']}
Permanent character invariants:
{invariants}
Shared production rules:
{rules}
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern."""


def reaction_variant_direction(
    catalogue: dict[str, Any],
    character: dict[str, Any],
    action: dict[str, Any],
    variant_index: int,
) -> str:
    """Return deterministic alternate choreography for the third reaction take."""
    if variant_index != 3 or action["id"] not in {"attentive", "puzzled", "encouraging"}:
        return ""
    directions = catalogue.get("reaction_variant_three", {}).get(action["id"], [])
    if len(directions) != 5 or not all(isinstance(item, str) and item.strip() for item in directions):
        raise PipelineError(
            f"reaction_variant_three.{action['id']} must contain five non-empty directions"
        )
    character_index = catalogue["characters"].index(character)
    action_offset = {"attentive": 0, "puzzled": 2, "encouraging": 4}[action["id"]]
    direction = (
        catalogue.get("reaction_variant_three_overrides", {})
        .get(character["id"], {})
        .get(action["id"])
        or directions[(character_index + action_offset) % len(directions)]
    )
    return (
        " VARIANT THREE CHOREOGRAPHY: Keep the authored emotion and character-specific identity, but make this "
        f"take visibly different in timing, silhouette and intensity. {direction} "
        "This alternate staging changes only the gesture choreography; all permanent design, prop-continuity, "
        "framing, no-text, no-salute and exact-final-pose constraints remain mandatory."
    )


def reaction_variant_four_description(
    catalogue: dict[str, Any],
    character: dict[str, Any],
    action: dict[str, Any],
    variant_index: int,
) -> str | None:
    if variant_index not in {4, 5} or action["id"] not in {"attentive", "puzzled", "encouraging"}:
        return None
    try:
        return catalogue["reaction_variant_four"][character["id"]][action["id"]]
    except KeyError as error:
        raise PipelineError(
            f"Missing reaction variant four description: {character['id']}/{action['id']}"
        ) from error


def video_prompt(
    catalogue: dict[str, Any],
    character: dict[str, Any],
    action: dict[str, Any],
    variant_index: int = 1,
) -> str:
    invariants = "; ".join(character["invariants"])
    description = action_description(character, action)
    variant_four_description = reaction_variant_four_description(
        catalogue, character, action, variant_index
    )
    if variant_four_description:
        description = variant_four_description
    replacement_descriptions = {
        ("cairn", "signature-finale"): (
            "Cairn warmly floats three small, separate stone tiles at chest height, each with one clear uppercase V, I or M "
            "on its front; they orbit once and return to Cairn's low hands before the exact neutral pose."
        ),
        ("prism", "signature-finale"): (
            "Prism lets three separate small keycaps marked uppercase V, I and M hover at chest height, then sends a short "
            "individual glow through each one before they fade and Prism returns to the exact neutral pose."
        ),
    }
    description = replacement_descriptions.get((character["id"], action["id"]), description)
    action_specific_constraint = ""
    if character["id"] == "tatter" and action["id"] == "high-jump":
        action_specific_constraint = (
            " Tatter makes a strictly vertical in-place hop only: no turn, spin, back view or occlusion. "
            "Keep the hood, cream face and both amber eyes visible in every frame. "
            "The final three-quarters of a second holds the exact approved front three-quarter neutral pose, "
            "with all four arms, two walking legs, needle and spool visible and attached."
        )
    special_constraints = {
        ("cairn", "signature-finale"): (
            " No gate, path, floor, ground object, raised platform, rune or joined symbol. Cairn stays in the approved "
            "neutral position and playfully juggles exactly three small separate floating stone bricks at chest height. "
            "Their front faces clearly show one uppercase letter each: V, I and M, in that order; the bricks never touch "
            "the ground and settle into Cairn's hands before the neutral end pose."
        ),
        ("cinder", "magic-flourish"): (
            " Cinder's rune wand sends one small turquoise block-cursor-shaped light past three separate amber motes. "
            "The motes never join into a glyph, diagram, letter, icon or geometric symbol."
        ),
        ("mello", "project-reveal"): (
            " Keep Mello's cap-and-stem silhouette and full body unchanged and visible throughout: no human anatomy, "
            "no chest features, no hiding, collapsing or shrinking. Mello proudly strums the leaf lute; four tiny "
            "separate amber motes rise and fade."
        ),
        ("orin", "project-reveal"): (
            " Orin's torso, feathers and silhouette stay rigidly unchanged: no swelling, balloon, bubble or growth from "
            "the body. Orin opens the scroll and reveals three small, flat page-tab lights beside it, then closes it."
        ),
        ("prism", "project-reveal"): (
            " No rocks, pebbles, floor objects or ground effects. Prism projects three small floating rectangular selection "
            "tiles that align beside the chest prism, then fold into its glow without forming text or a symbol."
        ),
        ("prism", "signature-finale"): (
            " No rainbow, spectrum arc, emblem or unrelated text. Prism's chest gem sends three separate short cyan, amber "
            "and violet beams through three clearly separated small keycaps held at chest height, never near the floor. "
            "Their labels are exactly uppercase V, I and M, one letter per keycap in that order; they remain separate and fade."
        ),
    }
    action_specific_constraint += special_constraints.get((character["id"], action["id"]), "")
    if action["id"] in {"attentive", "puzzled", "encouraging"}:
        action_specific_constraint += reaction_variant_direction(
            catalogue, character, action, variant_index
        )
        if variant_index in {4, 5}:
            variant_word = {4: "FOUR", 5: "FIVE"}[variant_index]
            action_specific_constraint += (
                f" VARIANT {variant_word} ADDITIVE CANDIDATE: This is a new review candidate, not a replacement for earlier "
                "takes. Perform only the newly authored character-specific choreography above. Give the clip one "
                "dominant readable acting idea, a clean silhouette and clear negative space. Do not fall back to "
                "generic head scratching, broad arm waving or any gesture from an earlier take."
            )
        action_specific_constraint += (
            " REACTION TIMING: 0.00-0.35 seconds, hold the supplied neutral pose fully visible. "
            "0.35-2.45 seconds, perform exactly the described emotional gesture in place. "
            "2.45-3.25 seconds, smoothly settle back into the exact supplied neutral pose. "
            "3.25-4.00 seconds, hold that exact neutral pose completely still, fully opaque and fully visible. "
            "The character's feet remain anchored to the same pixels for the entire clip. "
            "Every permanent prop, costume piece, limb and facial feature from the supplied image remains attached, "
            "unobscured and visible in every frame. The final held pose must reproduce the supplied image—including "
            "every prop and its placement—not a newly invented generic idle. "
            "Preserve the supplied costume and body coverage exactly: all armour, cloth, plating, feathers, fur and "
            "other coverings remain closed, opaque and in their original positions. Never expose, invent or emphasize "
            "breasts, nipples, genitals, buttocks, underwear, cleavage or bare human-like anatomy, and never arrange "
            "paired round props, lights or effects over the chest in a way that resembles breasts. "
            "At the end of the video the character must not drop, hide, remove, exchange or transform any prop, "
            "and must not fade away or disappear; the character simply stays normally visible and still in that "
            "approved neutral pose through the final frame. "
            "Do not display text anywhere in any frame: no character name, words, dialogue, captions, subtitles, "
            "labels, signs, interface text, written encouragement, watermark, title or end-card message. Express "
            "the reaction only through the character's face, pose, props and motion. "
            "Never form a salute-like pose: no single rigid straight arm or wing may extend diagonally above "
            "shoulder height. Any raised arm or wing must remain visibly bent or curved and must clearly perform "
            "the specific listening, thinking or offering action described. "
            "The character must never hit, tap, knock, bump, poke or slap their own head or face, and must never "
            "perform a facepalm, forehead slap, temple tap, mocking pantomime, taunt or gesture that could imply "
            "the learner is stupid. Keep the acting kind, respectful and non-offensive in every frame. "
            "Never add a puddle, spilled liquid, wet patch, stain, bodily fluid, urine-like mark or floor mark "
            "beneath or beside the character. "
            "No walking, stepping, running, hopping, pacing, dancing, sliding, turning away, camera motion, "
            "fade-out, dissolve, disappearance, shrinking, scene transition or end card."
        )
    return f"""Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character {character['name']}, {character['description']}
Action over exactly four seconds: {description}
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: {invariants}.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose.{action_specific_constraint} Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described."""


def negative_video_prompt(character: dict[str, Any], action: dict[str, Any] | None = None) -> str:
    text_negative = "text, captions, watermark, writing, letters, glyph,"
    if action and action["id"] == "signature-finale" and character["id"] in {"cairn", "prism"}:
        text_negative = (
            "unrelated text, captions, watermark, writing, letters or glyphs other than the three explicit V, I and M labels,"
        )
    elif (
        action
        and action["id"] == "puzzled"
        and "question-mark-shaped" in character["puzzled"]
    ):
        text_negative = (
            "text, captions, watermark, writing, letters, numbers, glyphs or symbols other than the one "
            "explicit question-mark-shaped thought wisp,"
        )
    reaction_negative = ""
    if action and action["id"] in {"attentive", "puzzled", "encouraging"}:
        reaction_negative = (
            "walking, stepping, running, hopping, jumping, pacing, dancing, locomotion, foot movement, "
            "victory celebration, cheering, confetti, fade-out, fading character, dissolve, disappearance, "
            "invisibility, shrinking, end card, salute, military salute, fascist salute, Nazi salute, "
            "single rigid raised arm, single straight raised wing, "
            "self-hit, head hit, head tap, head bump, forehead knock, forehead slap, facepalm, temple tap, "
            "mocking gesture, insulting gesture, taunt, derision, contempt, "
        )
    return (
        "camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, "
        "new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, "
        "new props, missing props, mutated anatomy, detached head, missing head, headless body, hidden face, "
        "back-facing turn, back view, "
        "changed costume, opened costume, removed clothing, missing armour, opened armour, transparent clothing, "
        "nudity, exposed breasts, nipples, cleavage, genitals, buttocks, underwear, sexualized anatomy, "
        "paired round chest effects, changed face, changed species, "
        "puddle, spilled liquid, wet patch, stain, bodily fluid, urine, floor mark, "
        f"{text_negative} emblem, logo, swastika, cross, "
        f"{reaction_negative}"
        "religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, "
        f"anything inconsistent with {character['name']}"
    )


def render_catalogue_markdown(catalogue: dict[str, Any]) -> str:
    models = catalogue["models"]
    still_cost = 14 * 3 * float(models["image_cost_usd"])
    video_unit_cost = float(models["video_cost_per_second_usd"]) * int(models["duration_seconds"])
    video_count = len(catalogue["characters"]) * len(catalogue["actions"]) - 1
    video_cost = video_count * video_unit_cost
    minimum_cost = still_cost + video_cost
    remaining_budget = DEFAULT_BUDGET - minimum_cost
    lines = [
        "# The Vim Wilds Character Catalogue",
        "",
        "> Generated from `character_catalogue.json`. Edit the JSON and rerun the `catalogue` command.",
        "",
        "## Art bible",
        "",
        catalogue["world"]["premise"],
        "",
        f"- Rendering: {catalogue['world']['style']}",
        f"- Composition: {catalogue['world']['composition']}",
        f"- Palette: {catalogue['world']['palette']}",
        f"- Image model: `{models['image']}`",
        f"- Video model: `{models['video']}`; {models['duration_seconds']} seconds; silent; {models['video_fps']} fps source / {models['runtime_fps']} fps runtime",
        f"- Minimum generation plan: 42 stills × ${models['image_cost_usd']:.3f} + {video_count} videos × ${video_unit_cost:.2f} = ${minimum_cost:.2f}",
        f"- Hard cap: ${DEFAULT_BUDGET:.2f}; minimum plan leaves ${remaining_budget:.2f}, enough for {int(remaining_budget // video_unit_cost)} additional Veo Lite attempts",
        "",
        "Shared rules:",
        "",
        *[f"- {rule}" for rule in catalogue["world"]["rendering_rules"]],
        "",
        "## Staged workflow",
        "",
        "All paid commands are dry runs unless `--execute` is present. The append-only ledger and raw generations live under the ignored `artifacts/character-generation/` directory.",
        "",
        "```bash",
        "python scripts/generate_character_assets.py catalogue --check",
        "python scripts/generate_character_assets.py approve --catalogue",
        "python scripts/generate_character_assets.py stills --candidates 3 --execute --budget-usd 25",
        "python scripts/generate_character_assets.py approve --character vela --candidate 2",
        "python scripts/generate_character_assets.py videos --execute --resume --budget-usd 25 --max-concurrency 2",
        "python scripts/generate_character_assets.py convert --resume",
        "python scripts/generate_character_assets.py approve --character vela --animation joyful-hop --attempt 1",
        "```",
        "",
        "Approving the catalogue records its SHA-256, so editing the machine-readable source closes the paid-generation gate again. Exactly one static candidate per character must be approved before any Veo request can be submitted. Converted videos remain local review candidates until their individual animation approval command copies them into `assets/characters/`.",
        "",
        "## Cast and production prompts",
        "",
    ]
    for index, character in enumerate(catalogue["characters"], 1):
        lines.extend([
            f"### {index}. {character['name']} (`{character['id']}`)",
            "",
            f"**Role:** {character['role']}",
            "",
            f"**Species:** {character['species']}",
            "",
            f"**Canonical description:** {character['description']}",
            "",
            "Permanent invariants:",
            "",
            *[f"- {item}" for item in character["invariants"]],
            "",
            "<details><summary>Canonical idle prompt</summary>",
            "",
            "```text",
            still_prompt(catalogue, character),
            "```",
            "</details>",
            "",
            "Animations:",
            "",
        ])
        for action in catalogue["actions"]:
            lines.extend([
                f"#### `{action['id']}`",
                "",
                action_description(character, action),
                "",
                "<details><summary>Full Veo prompt</summary>",
                "",
                "```text",
                video_prompt(catalogue, character, action),
                "",
                "Negative prompt:",
                negative_video_prompt(character, action),
                "```",
                "</details>",
                "",
            ])
            if action["id"] in {"attentive", "puzzled", "encouraging"}:
                lines.extend([
                    "<details><summary>Variant 3 alternate-choreography Veo prompt</summary>",
                    "",
                    "```text",
                    video_prompt(catalogue, character, action, variant_index=3),
                    "",
                    "Negative prompt:",
                    negative_video_prompt(character, action),
                    "```",
                    "</details>",
                    "",
                    "<details><summary>Variant 4 additive character-specific Veo prompt</summary>",
                    "",
                    "```text",
                    video_prompt(catalogue, character, action, variant_index=4),
                    "",
                    "Negative prompt:",
                    negative_video_prompt(character, action),
                    "```",
                    "</details>",
                    "",
                    "<details><summary>Variant 5 additive current-description Veo prompt</summary>",
                    "",
                    "```text",
                    video_prompt(catalogue, character, action, variant_index=5),
                    "",
                    "Negative prompt:",
                    negative_video_prompt(character, action),
                    "```",
                    "</details>",
                    "",
                ])
    return "\n".join(lines).rstrip() + "\n"


def command_catalogue(args: argparse.Namespace) -> int:
    catalogue = load_catalogue(args.catalogue)
    rendered = render_catalogue_markdown(catalogue)
    if args.check:
        if not args.output.exists() or args.output.read_text() != rendered:
            raise PipelineError(f"{args.output} is not up to date")
        print(f"Catalogue is valid and current: {args.output}")
        return 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered)
    print(f"Wrote {args.output}: 15 characters, 195 animation descriptions and prompts")
    return 0


def load_approvals() -> dict[str, Any]:
    approvals = read_json(APPROVALS_PATH)
    if approvals.get("schema_version") != 1:
        raise PipelineError("Approval schema_version must be 1")
    return approvals


def require_catalogue_approval(catalogue_path: Path = CATALOGUE_PATH) -> dict[str, Any]:
    approvals = load_approvals()
    approved_hash = approvals.get("catalogue_sha256")
    current_hash = sha256_path(catalogue_path)
    if not approvals.get("catalogue_approved") or approved_hash != current_hash:
        raise PipelineError(
            "Catalogue is not approved at its current revision. Review scripts/character_catalogue.md, then run "
            "`python scripts/generate_character_assets.py approve --catalogue`."
        )
    return approvals


def approved_idle_path(character: dict[str, Any], approvals: dict[str, Any]) -> Path:
    record = approvals.get("stills", {}).get(character["id"])
    if not record or not record.get("approved"):
        raise PipelineError(f"No approved idle sprite for {character['id']}")
    path = ROOT / record["path"]
    if not path.is_file():
        raise PipelineError(f"Approved idle sprite is missing: {path}")
    return path


def validate_idle_sprite(path: Path) -> dict[str, Any]:
    with Image.open(path) as source:
        image = source.convert("RGBA")
    if image.width != image.height or image.width < 92:
        raise PipelineError(f"Idle sprite must be square and at least 92px: {path}")
    alpha = np.asarray(image.getchannel("A"))
    if alpha.max() == 0 or alpha.min() != 0:
        raise PipelineError(f"Idle sprite must contain foreground and transparency: {path}")
    if any(alpha[y, x] for x, y in ((0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1))):
        raise PipelineError(f"Idle sprite corners must be transparent: {path}")
    bounds = image.getchannel("A").getbbox()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    if width < image.width * 0.3 or height < image.height * 0.4:
        raise PipelineError(f"Idle sprite is too small to remain readable at 92px: {path}")
    return {
        "size": image.width,
        "visible_bounds": list(bounds),
        "baseline": bounds[3],
        "coverage": round(float(np.count_nonzero(alpha)) / alpha.size, 4),
    }


def read_ledger(root: Path) -> list[dict[str, Any]]:
    path = root / LEDGER_NAME
    if not path.exists():
        return []
    events = []
    for line_number, line in enumerate(path.read_text().splitlines(), 1):
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError as error:
            raise PipelineError(f"Invalid ledger line {line_number}: {error}") from error
    return events


def ledger_spend(root: Path) -> float:
    submitted = sum(
        float(event.get("estimated_cost_usd", 0))
        for event in read_ledger(root)
        if event.get("event") == "submitted"
    )
    voided = sum(
        float(event.get("estimated_cost_usd", 0))
        for event in read_ledger(root)
        if event.get("event") == "voided_submission"
    )
    return submitted - voided


def append_ledger(root: Path, event: dict[str, Any]) -> None:
    root.mkdir(parents=True, exist_ok=True)
    event = {"timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **event}
    with (root / LEDGER_NAME).open("a") as destination:
        destination.write(json.dumps(event, sort_keys=True) + "\n")
        destination.flush()


def enforce_budget(root: Path, budget: float, next_cost: float) -> None:
    spent = ledger_spend(root)
    if spent + next_cost > budget + 1e-9:
        raise PipelineError(f"Budget cap would be exceeded: ${spent:.2f} + ${next_cost:.2f} > ${budget:.2f}")


def command_void_submissions(args: argparse.Namespace) -> int:
    """Append accounting reversals for requests Vertex rejected before accepting."""
    events = read_ledger(args.artifact_root)
    candidates = [
        event for event in events
        if event.get("event") == "submitted"
        and event.get("kind") == args.kind
        and event.get("character") == args.character
        and event.get("candidate") == args.candidate
    ]
    already_voided = sum(
        1 for event in events
        if event.get("event") == "voided_submission"
        and event.get("kind") == args.kind
        and event.get("character") == args.character
        and event.get("candidate") == args.candidate
    )
    remaining = candidates[already_voided:]
    if not remaining:
        raise PipelineError("No unmatched submitted ledger entries found to void")
    for index, event in enumerate(remaining, already_voided + 1):
        append_ledger(args.artifact_root, {
            "event": "voided_submission", "kind": args.kind, "character": args.character,
            "candidate": args.candidate, "estimated_cost_usd": event.get("estimated_cost_usd", 0),
            "reason": args.reason, "voids_submission_number": index,
        })
    print(f"Voided {len(remaining)} rejected {args.kind} submission ledger entries.")
    return 0


def create_vertex_client(project: str, location: str):
    if not project or project == "YOUR_PROJECT_ID":
        raise PipelineError("Set GOOGLE_CLOUD_PROJECT or pass --project")
    from google import genai

    return genai.Client(vertexai=True, project=project, location=location)


def extract_response_image(response: Any) -> bytes:
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data
    raise PipelineError(f"Nano Banana returned no image: {response}")


def normalize_idle(raw_path: Path, output: Path, device: str) -> None:
    source_bytes = raw_path.read_bytes()
    image = Image.open(raw_path)
    background, variation = converter.estimate_background([image])
    rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
    brightness = rgb.mean(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    # Nano Banana can bake opaque transparency checkers from white down to a
    # dark grey.  Only treat this broad range as removable when every border
    # pixel is near-neutral; that distinguishes a checkerboard from a scene.
    neutral_light = (brightness >= 80) & (chroma <= 12)
    border = max(4, min(image.width, image.height) // 40)
    border_mask = np.concatenate((
        neutral_light[:border, :].ravel(), neutral_light[-border:, :].ravel(),
        neutral_light[border:-border, :border].ravel(), neutral_light[border:-border, -border:].ravel(),
    ))
    if variation <= 7:
        cleaned = converter.matte_frames([image], background, 7, 16, "background", device)[0]
    elif float(border_mask.mean()) >= 0.98:
        alpha = Image.fromarray(np.where(neutral_light, 0, 255).astype(np.uint8), mode="L")
        cleaned = converter.decontaminate_edges(
            image, converter.keep_character_and_effects(alpha)
        )
    else:
        cleaned = animate_character.prepare_foreground_cached(
            image, source_bytes, animate_character.default_cache_dir(), animate_character.choose_device(device)
        )
    normalized, _ = animate_character.normalize_image(cleaned, 512)
    output.parent.mkdir(parents=True, exist_ok=True)
    normalized.save(output, optimize=True)
    normalized.resize((92, 92), Image.Resampling.LANCZOS).save(
        output.with_name(f"{output.stem}-92px.png"), optimize=True
    )


def make_contact_sheet(paths: Sequence[Path], output: Path, label: str) -> None:
    tiles: list[Image.Image] = []
    for path in paths:
        with Image.open(path) as source:
            tile = Image.new("RGBA", (256, 288), (15, 26, 23, 255))
            preview = source.convert("RGBA").resize((256, 256), Image.Resampling.LANCZOS)
            tile.alpha_composite(preview)
            ImageDraw.Draw(tile).text((8, 264), path.stem, fill=(240, 215, 135, 255))
            tiles.append(tile)
    if not tiles:
        return
    sheet = Image.new("RGBA", (256 * len(tiles), 320), (8, 19, 16, 255))
    ImageDraw.Draw(sheet).text((8, 4), label, fill=(119, 224, 163, 255))
    for index, tile in enumerate(tiles):
        sheet.alpha_composite(tile, (index * 256, 32))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)


def make_cast_contact_sheet(catalogue: dict[str, Any], artifact_root: Path) -> Path:
    """Make one compact review image containing all 42 still candidates."""
    tile_width, tile_height = 176, 208
    columns, rows = 6, 7  # two characters (three candidates each) per row
    sheet = Image.new("RGBA", (tile_width * columns, tile_height * rows + 28), (8, 19, 16, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 6), "The Vim Wilds — static candidate review", fill=(119, 224, 163, 255))
    for character_index, character in enumerate(catalogue["characters"][1:]):
        row = character_index // 2
        character_column = (character_index % 2) * 3
        for candidate in range(1, 4):
            source = artifact_root / "stills" / character["id"] / f"candidate-{candidate:02d}.png"
            if not source.exists():
                continue
            with Image.open(source) as image:
                preview = image.convert("RGBA").resize((tile_width, tile_width), Image.Resampling.LANCZOS)
            x = (character_column + candidate - 1) * tile_width
            y = 28 + row * tile_height
            sheet.alpha_composite(preview, (x, y))
            draw.text((x + 5, y + tile_width + 5), f"{character['id']} #{candidate}", fill=(240, 215, 135, 255))
    output = artifact_root / "stills" / "all-candidates.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)
    return output


def selected_characters(catalogue: dict[str, Any], requested: Sequence[str] | None, include_nix: bool = True) -> list[dict[str, Any]]:
    characters = catalogue["characters"]
    if requested:
        selected = [character_by_id(catalogue, item) for item in requested]
    else:
        selected = list(characters)
    return selected if include_nix else [item for item in selected if item["id"] != "nix"]


def command_stills(args: argparse.Namespace) -> int:
    catalogue = load_catalogue(args.catalogue)
    if args.candidates < 1:
        raise PipelineError("--candidates must be at least 1")
    if args.min_request_interval < 0:
        raise PipelineError("--min-request-interval cannot be negative")
    characters = selected_characters(catalogue, args.character, include_nix=False)
    jobs = [(character, candidate) for character in characters for candidate in range(1, args.candidates + 1)]
    cost = len(jobs) * float(catalogue["models"]["image_cost_usd"])
    print(f"Static plan: {len(jobs)} calls for {len(characters)} characters; estimated output cost ${cost:.2f}")
    for character, candidate in jobs:
        print(f"  {character['id']}/candidate-{candidate:02d}")
    if not args.execute:
        print("Dry run only; no Vertex requests submitted. Add --execute after catalogue approval.")
        return 0
    require_catalogue_approval(args.catalogue)
    from google.genai import types

    client = create_vertex_client(args.project, args.location)
    reference = (ROOT / "assets" / "nix.png").read_bytes()
    last_request_at = 0.0
    for character, candidate in jobs:
        directory = args.artifact_root / "stills" / character["id"]
        raw = directory / f"candidate-{candidate:02d}-raw.png"
        normalized = directory / f"candidate-{candidate:02d}.png"
        if normalized.exists():
            preview = normalized.with_name(f"{normalized.stem}-92px.png")
            if not preview.exists():
                with Image.open(normalized) as image:
                    image.convert("RGBA").resize((92, 92), Image.Resampling.LANCZOS).save(preview, optimize=True)
            print(f"Using existing {normalized}")
            continue
        if raw.exists():
            normalize_idle(raw, normalized, args.device)
            append_ledger(args.artifact_root, {
                "event": "completed", "kind": "image", "character": character["id"],
                "candidate": candidate, "path": str(normalized.relative_to(ROOT)),
                "sha256": sha256_path(normalized), "resumed_from_raw": True,
            })
            print(f"Recovered {normalized} from existing raw response")
            continue
        unit_cost = float(catalogue["models"]["image_cost_usd"])
        enforce_budget(args.artifact_root, args.budget_usd, unit_cost)
        wait_seconds = args.min_request_interval - (time.monotonic() - last_request_at)
        if wait_seconds > 0:
            print(f"Waiting {wait_seconds:.0f}s before the next Nano Banana request to stay within quota...")
            time.sleep(wait_seconds)
        try:
            response = client.models.generate_content(
                model=catalogue["models"]["image"],
                contents=[
                    types.Part.from_text(text=still_prompt(catalogue, character)),
                    types.Part.from_bytes(data=reference, mime_type="image/png"),
                ],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    seed=still_seed(catalogue, character, candidate),
                    image_config=types.ImageConfig(aspect_ratio="1:1", image_size="1K", output_mime_type="image/png"),
                ),
            )
        except Exception as error:
            append_ledger(args.artifact_root, {
                "event": "request_rejected", "kind": "image", "character": character["id"],
                "candidate": candidate, "model": catalogue["models"]["image"], "reason": str(error),
            })
            raise PipelineError(f"Vertex rejected {character['id']}/candidate-{candidate:02d}: {error}") from error
        last_request_at = time.monotonic()
        append_ledger(args.artifact_root, {
            "event": "submitted", "kind": "image", "character": character["id"],
            "candidate": candidate, "model": catalogue["models"]["image"], "estimated_cost_usd": unit_cost,
        })
        directory.mkdir(parents=True, exist_ok=True)
        raw.write_bytes(extract_response_image(response))
        normalize_idle(raw, normalized, args.device)
        append_ledger(args.artifact_root, {
            "event": "completed", "kind": "image", "character": character["id"],
            "candidate": candidate, "path": str(normalized.relative_to(ROOT)), "sha256": sha256_path(normalized),
        })
        print(f"Saved {normalized}")
    for character in characters:
        directory = args.artifact_root / "stills" / character["id"]
        paths = [directory / f"candidate-{candidate:02d}.png" for candidate in range(1, args.candidates + 1)]
        make_contact_sheet([path for path in paths if path.exists()], directory / "contact-sheet.png", character["name"])
    if not args.character and args.candidates == 3:
        review = make_cast_contact_sheet(catalogue, args.artifact_root)
        print(f"Wrote cast review sheet: {review}")
    return 0


def promote_animation_candidate(
    catalogue: dict[str, Any],
    approvals: dict[str, Any],
    artifact_root: Path,
    character: dict[str, Any],
    action: dict[str, Any],
    attempt: int,
    *,
    replace_approved: bool = False,
    reaction_slot: int | None = None,
) -> Path:
    """Promote one reviewed candidate, replacing an approved asset only on request."""
    source = artifact_root / "runtime-candidates" / character["id"] / f"{action['id']}-attempt-{attempt:02d}.webp"
    source_metadata = source.with_suffix(".json")
    if not source.is_file() or not source_metadata.is_file():
        raise PipelineError(f"Animation candidate or metadata does not exist: {source}")
    is_reaction = action["id"] in {"attentive", "puzzled", "encouraging"}
    if reaction_slot is not None:
        if not is_reaction:
            raise PipelineError("--reaction-slot is only valid for reaction animations")
        if reaction_slot < 1:
            raise PipelineError("--reaction-slot must be at least 1")
    destination_name = (
        f"{action['id']}-variant-{reaction_slot:02d}.webp"
        if reaction_slot is not None
        else f"{action['id']}.webp"
    )
    destination = ASSET_ROOT / character["id"] / "animations" / destination_name
    destination_metadata = destination.with_suffix(".json")
    if reaction_slot is not None:
        existing = (
            approvals.get("reaction_variants", {})
            .get(character["id"], {})
            .get(action["id"], {})
            .get(str(reaction_slot))
        )
    else:
        existing = approvals.get("animations", {}).get(character["id"], {}).get(action["id"])
    if existing and existing.get("approved") and not replace_approved:
        raise PipelineError(f"Approved animation already exists: {destination}")
    if (destination.exists() or destination_metadata.exists()) and not replace_approved:
        raise PipelineError(f"Refusing to overwrite repository animation: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    metadata = read_json(source_metadata)
    metadata.update({
        "approved": True,
        "approval_state": "approved",
        "approved_attempt": attempt,
        "reaction_slot": reaction_slot,
    })
    write_json(destination_metadata, metadata)
    approval_record = {
        "attempt": attempt,
        "path": str(destination.relative_to(ROOT)),
        "sha256": sha256_path(destination),
        "approved": True,
    }
    if reaction_slot is not None:
        (
            approvals.setdefault("reaction_variants", {})
            .setdefault(character["id"], {})
            .setdefault(action["id"], {})
        )[str(reaction_slot)] = approval_record
    else:
        approvals.setdefault("animations", {}).setdefault(character["id"], {})[action["id"]] = (
            approval_record
        )
    return destination


def selected_reaction_jobs(
    catalogue: dict[str, Any], selected_root: Path,
) -> list[dict[str, Any]]:
    """Resolve the human-curated reaction folder into deterministic slots.

    Slot numbering is deliberately derived from round then attempt.  No exact
    variant count is required: a character/reaction pair may contain any
    positive number of approved files.
    """
    known_characters = {character["id"] for character in catalogue["characters"]}
    pattern = re.compile(
        r"^reactions-round-(\d+)/runtime-candidates/([^/]+)/"
        r"(attentive|puzzled|encouraging)-attempt-(\d+)\.webp$"
    )
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    paths = sorted(selected_root.glob("reactions-round-*/runtime-candidates/*/*-attempt-*.webp"))
    if not paths:
        raise PipelineError(f"No curated reaction WebPs found under {selected_root}")
    for source in paths:
        relative = source.relative_to(selected_root).as_posix()
        match = pattern.fullmatch(relative)
        if not match:
            raise PipelineError(f"Unexpected selected reaction path: {relative}")
        round_number, character_id, reaction_id, attempt = match.groups()
        if character_id not in known_characters:
            raise PipelineError(f"Unknown selected reaction character: {character_id}")
        metadata_path = source.with_suffix(".json")
        if not metadata_path.is_file():
            raise PipelineError(f"Selected reaction metadata is missing: {metadata_path}")
        metadata = read_json(metadata_path)
        if metadata.get("character") != character_id or metadata.get("animation") != reaction_id:
            raise PipelineError(f"Selected reaction metadata disagrees with its path: {relative}")
        try:
            with Image.open(source) as image:
                if not getattr(image, "is_animated", False) or image.n_frames < 2:
                    raise PipelineError(f"Selected reaction is not animated: {relative}")
        except OSError as error:
            raise PipelineError(f"Selected reaction cannot be decoded: {relative}: {error}") from error
        grouped.setdefault((character_id, reaction_id), []).append({
            "source": source,
            "metadata": metadata_path,
            "selected_path": relative,
            "round": int(round_number),
            "attempt": int(attempt),
        })

    jobs: list[dict[str, Any]] = []
    for (character_id, reaction_id), candidates in sorted(grouped.items()):
        candidates.sort(key=lambda item: (item["round"], item["attempt"], item["selected_path"]))
        for slot, candidate in enumerate(candidates, 1):
            jobs.append({
                **candidate,
                "character": character_id,
                "reaction": reaction_id,
                "slot": slot,
            })
    return jobs


def command_repair_selected_reactions(args: argparse.Namespace) -> int:
    catalogue = load_catalogue(args.catalogue)
    approvals = require_catalogue_approval(args.catalogue)
    repairs = read_json(args.repair_file).get("repairs", [])
    if not repairs:
        raise PipelineError(f"No repairs configured in {args.repair_file}")
    print(f"Selected reaction repair plan: {len(repairs)} reviewed repair(s)")
    for repair in repairs:
        print(f"  {repair['relative_path']}: {repair['reason']}")
    if not args.execute:
        print("Dry run only; add --execute to rebuild the reviewed selected files.")
        return 0

    for repair in repairs:
        runtime = args.selected_root / repair["relative_path"]
        metadata_path = runtime.with_suffix(".json")
        if not runtime.is_file() or not metadata_path.is_file():
            raise PipelineError(f"Selected repair target is missing: {runtime}")
        metadata = read_json(metadata_path)
        character = character_by_id(catalogue, metadata.get("character"))
        raw_video = ROOT / metadata.get("source", "")
        if not raw_video.is_file():
            raise PipelineError(f"Selected repair source video is missing: {raw_video}")
        idle = approved_idle_path(character, approvals)
        debug = (
            args.selected_root / "_repair-debug" / character["id"]
            / f"{metadata['animation']}-round-{metadata.get('variant_index', 'unknown')}"
        )
        with tempfile.TemporaryDirectory(prefix="vim-wilds-selected-repair-") as directory:
            temporary = Path(directory)
            master = temporary / "master.webp"
            rebuilt = temporary / "runtime.webp"
            conversion = convert_video_asset(
                raw_video,
                idle,
                master,
                rebuilt,
                debug,
                duration_seconds=int(metadata.get("duration_seconds", 4)),
                cover_rectangles=repair.get("cover_rectangles", []),
                canvas_mode=metadata.get("canvas_mode", "anchor"),
            )
            shutil.copy2(rebuilt, runtime)
        metadata.update(conversion)
        metadata["selected_repair"] = {
            "reason": repair["reason"],
            "cover_rectangles": repair.get("cover_rectangles", []),
            "source_sha256": sha256_path(raw_video),
            "result_sha256": sha256_path(runtime),
        }
        write_json(metadata_path, metadata)
        print(f"Repaired {runtime.relative_to(ROOT)}")
    return 0


def command_import_selected_reactions(args: argparse.Namespace) -> int:
    catalogue = load_catalogue(args.catalogue)
    approvals = require_catalogue_approval(args.catalogue)
    jobs = selected_reaction_jobs(catalogue, args.selected_root)
    counts: dict[tuple[str, str], int] = {}
    for job in jobs:
        key = (job["character"], job["reaction"])
        counts[key] = counts.get(key, 0) + 1
    print(
        f"Selected reaction import plan: {len(jobs)} clip(s), "
        f"{len(counts)} character/reaction pair(s), "
        f"{min(counts.values())}-{max(counts.values())} variants per pair"
    )
    for (character_id, reaction_id), count in sorted(counts.items()):
        print(f"  {character_id}/{reaction_id}: {count}")
    if not args.execute:
        print("Dry run only; add --execute to promote every remaining curated clip.")
        return 0

    destinations = []
    for job in jobs:
        destination = (
            ASSET_ROOT / job["character"] / "animations"
            / f"{job['reaction']}-variant-{job['slot']:02d}.webp"
        )
        destinations.append((job, destination, destination.with_suffix(".json")))
    occupied = [
        destination for _, destination, metadata in destinations
        if destination.exists() or metadata.exists()
    ]
    existing_approvals = approvals.get("reaction_variants", {})
    if (occupied or existing_approvals) and not args.replace_approved:
        raise PipelineError(
            "Approved reaction variants already exist; use --replace-approved to resynchronise "
            "them from the curated folder"
        )

    new_approvals: dict[str, Any] = {}
    for job, destination, destination_metadata in destinations:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(job["source"], destination)
        metadata = read_json(job["metadata"])
        metadata.update({
            "approved": True,
            "approval_state": "approved",
            "approved_attempt": job["attempt"],
            "reaction_slot": job["slot"],
            "selected_source": job["selected_path"],
            "selected_round": job["round"],
        })
        write_json(destination_metadata, metadata)
        record = {
            "attempt": job["attempt"],
            "round": job["round"],
            "selected_source": job["selected_path"],
            "path": str(destination.relative_to(ROOT)),
            "sha256": sha256_path(destination),
            "approved": True,
        }
        (
            new_approvals.setdefault(job["character"], {})
            .setdefault(job["reaction"], {})
        )[str(job["slot"])] = record
    approvals["reaction_variants"] = new_approvals
    write_json(APPROVALS_PATH, approvals)
    write_manifest(catalogue, approvals)
    print(f"Imported {len(jobs)} approved reaction variants from {args.selected_root}")
    return 0


def command_approve(args: argparse.Namespace) -> int:
    catalogue = load_catalogue(args.catalogue)
    approvals = load_approvals()
    if args.catalogue_approval:
        approvals["catalogue_approved"] = True
        approvals["catalogue_sha256"] = sha256_path(args.catalogue)
        write_json(APPROVALS_PATH, approvals)
        print("Catalogue approved. Paid still generation is now unlocked.")
        return 0
    approvals = require_catalogue_approval(args.catalogue)
    if not args.character_id:
        raise PipelineError("approve requires --catalogue or --character")
    character = character_by_id(catalogue, args.character_id)
    if args.animation:
        if args.attempt is None:
            raise PipelineError("animation approval requires --animation and --attempt")
        action = action_by_id(catalogue, args.animation)
        destination = promote_animation_candidate(
            catalogue,
            approvals,
            args.artifact_root,
            character,
            action,
            args.attempt,
            reaction_slot=getattr(args, "reaction_slot", None),
        )
        write_json(APPROVALS_PATH, approvals)
        write_manifest(catalogue, approvals)
        print(f"Approved {character['name']} {action['id']} attempt {args.attempt}: {destination}")
        return 0
    if args.candidate is None:
        raise PipelineError("static approval requires --character and --candidate")
    if character["id"] == "nix":
        raise PipelineError("Nix already uses the approved assets/nix.png reference")
    source = args.artifact_root / "stills" / character["id"] / f"candidate-{args.candidate:02d}.png"
    if not source.is_file():
        raise PipelineError(f"Candidate does not exist: {source}")
    validation = validate_idle_sprite(source)
    destination = ASSET_ROOT / character["id"] / "idle.png"
    existing = approvals.get("stills", {}).get(character["id"])
    if existing and existing.get("approved"):
        raise PipelineError(f"Approved idle sprite already exists: {destination}")
    if destination.exists():
        raise PipelineError(f"Refusing to overwrite repository idle sprite: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    approvals.setdefault("stills", {})[character["id"]] = {
        "candidate": args.candidate,
        "path": str(destination.relative_to(ROOT)),
        "sha256": sha256_path(destination),
        "model": catalogue["models"]["image"],
        "seed": still_seed(catalogue, character, args.candidate),
        "approved": True,
        "validation": validation,
    }
    write_json(APPROVALS_PATH, approvals)
    print(f"Approved {character['name']} candidate {args.candidate}: {destination}")
    return 0


def prepare_veo_input(source_path: Path, destination: Path) -> Path:
    source = Image.open(source_path).convert("RGBA")
    alpha_box = source.getchannel("A").getbbox()
    if alpha_box is None:
        raise PipelineError(f"Approved idle sprite is transparent: {source_path}")
    crop = source.crop(alpha_box)
    scale = min(620 / crop.width, 900 / crop.height)
    character = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (720, 1280), BACKGROUND)
    canvas.alpha_composite(character, ((720 - character.width) // 2, (1280 - character.height) // 2))
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(destination, optimize=True)
    return destination


def video_jobs(
    catalogue: dict[str, Any],
    approvals: dict[str, Any],
    requested_characters: Sequence[str] | None,
    requested_actions: Sequence[str] | None,
    *,
    require_approved: bool = True,
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    characters = selected_characters(catalogue, requested_characters)
    actions = [action_by_id(catalogue, item) for item in requested_actions] if requested_actions else catalogue["actions"]
    jobs = []
    for character in characters:
        if require_approved:
            approved_idle_path(character, approvals)
        for action in actions:
            if character["id"] == "nix" and action["id"] == "joyful-hop":
                continue
            jobs.append((character, action))
    return jobs


def load_operations(root: Path) -> dict[str, Any]:
    path = root / OPERATIONS_NAME
    return read_json(path) if path.exists() else {"schema_version": 1, "jobs": {}}


def save_operations(root: Path, state: dict[str, Any]) -> None:
    write_json(root / OPERATIONS_NAME, state)


def save_generated_video(operation: Any, output: Path) -> None:
    response = operation.result or operation.response
    if response is None or not response.generated_videos:
        reasons = getattr(response, "rai_media_filtered_reasons", None) if response else None
        raise PipelineError(f"Veo returned no video. Filter reasons: {reasons}")
    video = response.generated_videos[0].video
    if video is None or not video.video_bytes:
        raise PipelineError(f"Veo returned no inline video bytes (URI: {getattr(video, 'uri', None)})")
    output.parent.mkdir(parents=True, exist_ok=True)
    video.save(str(output))


def audit_generated_reaction(raw_video: Path, idle: Path) -> dict[str, Any]:
    """Run the Stage A gate on a new reaction before accepting the paid output."""
    with tempfile.TemporaryDirectory(prefix="vim-wilds-anchor-gate-") as directory:
        source = converter.extract_frames(raw_video, 12, Path(directory))[:48]
        if len(source) < 48:
            raise PipelineError(f"Generated reaction contains only {len(source)} sampled frames")
        background, _ = converter.estimate_background(source)
        cleaned = converter.matte_frames(source, background, 7, 16, "background", "auto")
        idle_image = Image.open(idle).convert("RGBA")
        placement = converter.fit_placement(cleaned, idle_image, 256, 6, "width")
        aligned = converter.render_aligned_frames(cleaned, placement, 256)
    metrics = anchor_frame_audit(aligned, idle_image)
    return {**metrics, "automatic_review_flags": anchor_review_flags(metrics)}


def command_videos(args: argparse.Namespace) -> int:
    catalogue = load_catalogue(args.catalogue)
    approvals = require_catalogue_approval(args.catalogue) if args.execute else load_approvals()
    jobs = video_jobs(catalogue, approvals, args.character, args.animation, require_approved=args.execute)
    unit_cost = float(catalogue["models"]["video_cost_per_second_usd"]) * int(catalogue["models"]["duration_seconds"])
    print(
        f"Video plan: {len(jobs)} new four-second clips for variant {args.variant_index}; "
        f"estimated output cost ${len(jobs) * unit_cost:.2f}"
    )
    if not args.execute:
        print("Dry run only; no Vertex requests submitted. Execution requires all 15 approved idle sprites.")
        return 0
    if args.retry and (not args.character or not args.animation or not args.rejection_reason):
        raise PipelineError(
            "--retry requires an explicit --character, --animation, and --rejection-reason"
        )
    if args.max_concurrency < 1 or args.max_concurrency > 2:
        raise PipelineError("--max-concurrency must be 1 or 2")
    if args.quota_backoff_seconds < 1:
        raise PipelineError("--quota-backoff-seconds must be at least 1")
    from google.genai import types

    client = create_vertex_client(args.project, args.location)
    operations = load_operations(args.artifact_root)
    queue = list(jobs)
    pending: dict[str, tuple[Any, dict[str, Any], dict[str, Any], Path]] = {}
    retry_after = 0.0
    anchor_gate_failures: list[str] = []

    while queue or pending:
        while queue and len(pending) < args.max_concurrency:
            if time.monotonic() < retry_after:
                break
            character, action = queue.pop(0)
            key = f"{character['id']}/{action['id']}"
            record = operations["jobs"].get(key)
            if record and record.get("status") == "completed" and not args.retry:
                print(f"Using completed {record['path']}")
                continue
            if record and record.get("operation_name") and record.get("status") == "submitted":
                operation = types.GenerateVideosOperation(name=record["operation_name"])
                raw_video = ROOT / record["path"]
                pending[key] = (operation, character, action, raw_video)
                print(f"Resuming {key}: {operation.name}")
                continue
            attempt = int(record.get("attempt", 0)) + 1 if record else 1
            raw_video = args.artifact_root / "videos" / character["id"] / f"{action['id']}-attempt-{attempt:02d}.mp4"
            idle = approved_idle_path(character, approvals)
            prepared = prepare_veo_input(idle, args.artifact_root / "prepared" / f"{character['id']}.png")
            enforce_budget(args.artifact_root, args.budget_usd, unit_cost)
            prompt = video_prompt(catalogue, character, action, args.variant_index)
            negative_prompt = negative_video_prompt(character, action)
            seed = video_seed(catalogue, character, action, args.variant_index) + (attempt - 1) * 1_000_000
            try:
                video_config: dict[str, Any] = {
                    "number_of_videos": 1,
                    "duration_seconds": 4,
                    "fps": 24,
                    "seed": seed,
                    "aspect_ratio": "9:16",
                    "resolution": "720p",
                    "negative_prompt": negative_prompt,
                    "generate_audio": False,
                    "resize_mode": types.ImageResizeMode.PAD,
                }
                if action["id"] in {"attentive", "puzzled", "encouraging"}:
                    video_config["last_frame"] = types.Image(
                        image_bytes=prepared.read_bytes(),
                        mime_type="image/png",
                    )
                operation = client.models.generate_videos(
                    model=catalogue["models"]["video"],
                    prompt=prompt,
                    image=types.Image(image_bytes=prepared.read_bytes(), mime_type="image/png"),
                    config=types.GenerateVideosConfig(**video_config),
                )
            except Exception as error:
                append_ledger(args.artifact_root, {
                    "event": "request_rejected", "kind": "video", "character": character["id"],
                    "animation": action["id"], "model": catalogue["models"]["video"],
                    "reason": str(error),
                })
                if "429" in str(error) or "RESOURCE_EXHAUSTED" in str(error):
                    queue.insert(0, (character, action))
                    retry_after = time.monotonic() + args.quota_backoff_seconds
                    print(
                        f"Vertex quota temporarily exhausted for {key}; retrying in "
                        f"{args.quota_backoff_seconds:.0f}s.",
                        file=sys.stderr,
                    )
                    break
                raise PipelineError(f"Vertex rejected {key}: {error}") from error
            if record and record.get("status") == "completed" and args.retry:
                append_ledger(args.artifact_root, {
                    "event": "rejected", "kind": "video", "character": character["id"],
                    "animation": action["id"], "attempt": record.get("attempt", 1),
                    "path": record.get("path"), "reason": args.rejection_reason,
                })
            append_ledger(args.artifact_root, {
                "event": "submitted", "kind": "video", "character": character["id"],
                "animation": action["id"], "variant_index": args.variant_index,
                "model": catalogue["models"]["video"],
                "operation_name": operation.name, "estimated_cost_usd": unit_cost,
                "prompt": prompt, "negative_prompt": negative_prompt, "seed": seed,
            })
            operations["jobs"][key] = {
                "status": "submitted", "operation_name": operation.name, "attempt": attempt,
                "variant_index": args.variant_index,
                "path": str(raw_video.relative_to(ROOT)),
                "prompt": prompt, "negative_prompt": negative_prompt, "seed": seed,
            }
            save_operations(args.artifact_root, operations)
            pending[key] = (operation, character, action, raw_video)
            print(f"Started {key}: {operation.name}")

        if not pending:
            if retry_after > time.monotonic():
                time.sleep(min(15, retry_after - time.monotonic()))
            continue
        time.sleep(15)
        for key in list(pending):
            operation, character, action, raw_video = pending[key]
            operation = client.operations.get(operation)
            if not operation.done:
                pending[key] = (operation, character, action, raw_video)
                continue
            if operation.error:
                prior = operations["jobs"][key]
                operations["jobs"][key] = {**prior, "status": "failed", "error": str(operation.error)}
                save_operations(args.artifact_root, operations)
                del pending[key]
                print(f"Failed {key}: {operation.error}", file=sys.stderr)
                continue
            try:
                save_generated_video(operation, raw_video)
            except PipelineError as error:
                prior = operations["jobs"][key]
                operations["jobs"][key] = {**prior, "status": "failed", "error": str(error)}
                save_operations(args.artifact_root, operations)
                append_ledger(args.artifact_root, {
                    "event": "failed", "kind": "video", "character": character["id"],
                    "animation": action["id"], "attempt": prior.get("attempt", 1), "reason": str(error),
                })
                del pending[key]
                print(f"Failed {key}: {error}", file=sys.stderr)
                continue
            prior = operations["jobs"][key]
            anchor_audit = None
            if action["id"] in REACTION_ACTIONS:
                anchor_audit = audit_generated_reaction(
                    raw_video, approved_idle_path(character, approvals)
                )
                if anchor_audit["automatic_review_flags"]:
                    attempt = int(prior.get("attempt", 1))
                    append_ledger(args.artifact_root, {
                        "event": "rejected", "kind": "video", "character": character["id"],
                        "animation": action["id"], "attempt": attempt,
                        "path": str(raw_video.relative_to(ROOT)),
                        "reason": "anchor endpoint acceptance gate",
                        "anchor_audit": anchor_audit,
                    })
                    if attempt <= args.anchor_retries:
                        operations["jobs"][key] = {
                            **prior,
                            "status": "anchor-rejected",
                            "anchor_audit": anchor_audit,
                        }
                        queue.append((character, action))
                        print(
                            f"Rejected {key} attempt {attempt} at the anchor gate; "
                            "queued an automatic retry.",
                            file=sys.stderr,
                        )
                    else:
                        operations["jobs"][key] = {
                            **prior,
                            "status": "failed",
                            "error": "anchor endpoint acceptance gate exhausted retries",
                            "anchor_audit": anchor_audit,
                        }
                        anchor_gate_failures.append(key)
                        print(
                            f"Failed {key}: anchor gate still failed after {attempt} attempt(s).",
                            file=sys.stderr,
                        )
                    save_operations(args.artifact_root, operations)
                    del pending[key]
                    continue
            operations["jobs"][key] = {
                **prior,
                "status": "completed",
                "path": str(raw_video.relative_to(ROOT)),
                "anchor_audit": anchor_audit,
            }
            save_operations(args.artifact_root, operations)
            append_ledger(args.artifact_root, {"event": "completed", "kind": "video", "character": character["id"], "animation": action["id"], "path": str(raw_video.relative_to(ROOT)), "sha256": sha256_path(raw_video), "anchor_audit": anchor_audit})
            print(f"Saved {raw_video}")
            del pending[key]
    if anchor_gate_failures:
        raise PipelineError(
            "Anchor endpoint acceptance gate exhausted retries for: "
            + ", ".join(sorted(anchor_gate_failures))
        )
    return 0


def decode_webp_frames(path: Path) -> list[Image.Image]:
    frames = []
    with Image.open(path) as source:
        for index in range(source.n_frames):
            source.seek(index)
            frames.append(source.convert("RGBA").copy())
    return frames


def cover_source_rectangles(
    frames: Sequence[Image.Image], background: np.ndarray, rectangles: Sequence[Sequence[float]],
) -> list[Image.Image]:
    """Paint review-approved label/artifact regions with the learned plain backdrop.

    Rectangles use normalized ``left, top, width, height`` coordinates.  This
    is intentionally limited to explicitly reviewed areas that contain no
    character pixels; it is not a general-purpose content editor.
    """
    if not rectangles:
        return list(frames)
    colour = tuple(np.rint(background).clip(0, 255).astype(np.uint8).tolist())
    covered: list[Image.Image] = []
    for frame in frames:
        result = frame.convert("RGB").copy()
        draw = ImageDraw.Draw(result)
        for rectangle in rectangles:
            if len(rectangle) != 4:
                raise PipelineError("Each review cover rectangle must have four normalized values")
            left, top, width, height = (float(value) for value in rectangle)
            if min(left, top, width, height) < 0 or left + width > 1 or top + height > 1:
                raise PipelineError(f"Invalid normalized review cover rectangle: {rectangle}")
            x0 = round(left * result.width)
            y0 = round(top * result.height)
            x1 = round((left + width) * result.width)
            y1 = round((top + height) * result.height)
            draw.rectangle((x0, y0, x1, y1), fill=colour)
        covered.append(result)
    return covered


def write_all_frame_contact_sheet(frames: Sequence[Image.Image], output: Path, label: str) -> None:
    """Write a compact all-frame review sheet for motion and clipping checks."""
    columns = 8
    tile = 128
    rows = int(np.ceil(len(frames) / columns))
    sheet = Image.new("RGBA", (columns * tile, rows * (tile + 18) + 26), (8, 19, 16, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 5), label, fill=(119, 224, 163, 255))
    for index, frame in enumerate(frames):
        x = (index % columns) * tile
        y = 26 + (index // columns) * (tile + 18)
        preview = frame.copy()
        preview.thumbnail((tile, tile), Image.Resampling.LANCZOS)
        sheet.alpha_composite(preview, (x + (tile - preview.width) // 2, y + (tile - preview.height) // 2))
        draw.text((x + 4, y + tile), f"{index:02d}", fill=(240, 215, 135, 255))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)


ANCHOR_IOU_THRESHOLD = 0.96
ANCHOR_FOOT_DELTA_THRESHOLD_PX = 2
ANCHOR_AREA_RATIO_RANGE = (0.97, 1.03)
REACTION_ACTIONS = {"attentive", "puzzled", "encouraging"}
REACTION_SEAM_PIPELINE_VERSION = 2


def _anchor_endpoint_metrics(
    anchor: Image.Image, frame: Image.Image, endpoint: str,
) -> dict[str, float | int]:
    if frame.size != anchor.size:
        raise PipelineError("Anchor audit requires matching frame canvases")
    anchor_rgba = np.asarray(anchor.convert("RGBA"), dtype=np.uint8)
    frame_rgba = np.asarray(frame.convert("RGBA"), dtype=np.uint8)
    anchor_mask = anchor_rgba[..., 3] > 0
    frame_mask = frame_rgba[..., 3] > 0
    intersection = anchor_mask & frame_mask
    union = anchor_mask | frame_mask
    iou = float(np.count_nonzero(intersection) / max(1, np.count_nonzero(union)))
    area_ratio = float(
        np.sqrt(np.count_nonzero(frame_mask) / max(1, np.count_nonzero(anchor_mask)))
    )
    anchor_body = converter.largest_component_bbox(anchor.getchannel("A"))
    frame_body = converter.largest_component_bbox(frame.getchannel("A"))
    rgb_mae = (
        float(
            np.abs(
                frame_rgba[..., :3][intersection].astype(np.int16)
                - anchor_rgba[..., :3][intersection].astype(np.int16)
            ).mean()
        )
        if intersection.any()
        else 255.0
    )
    return {
        f"anchor_{endpoint}_frame_iou": round(iou, 5),
        f"anchor_{endpoint}_frame_area_ratio": round(area_ratio, 5),
        f"anchor_{endpoint}_body_width_ratio": round(
            (frame_body[2] - frame_body[0]) / (anchor_body[2] - anchor_body[0]), 5
        ),
        f"anchor_{endpoint}_body_height_ratio": round(
            (frame_body[3] - frame_body[1]) / (anchor_body[3] - anchor_body[1]), 5
        ),
        f"anchor_{endpoint}_foot_delta_px": frame_body[3] - anchor_body[3],
        f"anchor_{endpoint}_rgb_mean_absolute_error": round(rgb_mae, 3),
    }


def anchor_frame_audit(
    frames: Sequence[Image.Image], idle: Image.Image, base_size: int = 256,
) -> dict[str, float | int]:
    """Compare both clip endpoints with idle in the clip coordinate frame."""
    if not frames:
        raise PipelineError("Anchor audit requires at least one animation frame")
    if len({frame.size for frame in frames}) != 1 or frames[0].width != frames[0].height:
        raise PipelineError("Anchor audit requires one consistent square clip canvas")
    anchor = converter.render_anchor_frame(idle, base_size, frames[0].width)
    metrics = {
        **_anchor_endpoint_metrics(anchor, frames[0], "first"),
        **_anchor_endpoint_metrics(anchor, frames[-1], "last"),
    }
    metrics["anchor_foot_delta_px"] = max(
        abs(int(metrics["anchor_first_foot_delta_px"])),
        abs(int(metrics["anchor_last_foot_delta_px"])),
    )
    return metrics


def anchor_review_flags(metrics: dict[str, Any]) -> list[str]:
    flags = []
    minimum_area, maximum_area = ANCHOR_AREA_RATIO_RANGE
    for endpoint in ("first", "last"):
        if float(metrics[f"anchor_{endpoint}_frame_iou"]) < ANCHOR_IOU_THRESHOLD:
            flags.append(f"anchor-{endpoint}-frame-iou-below-threshold")
        if abs(int(metrics[f"anchor_{endpoint}_foot_delta_px"])) > ANCHOR_FOOT_DELTA_THRESHOLD_PX:
            flags.append(f"anchor-{endpoint}-frame-foot-drift")
        area_ratio = float(metrics[f"anchor_{endpoint}_frame_area_ratio"])
        if not minimum_area <= area_ratio <= maximum_area:
            flags.append(f"anchor-{endpoint}-frame-area-ratio-outside-threshold")
    return flags


def convert_video_asset(
    raw_video: Path,
    idle: Path,
    master: Path,
    runtime: Path,
    debug: Path,
    *,
    duration_seconds: int = 4,
    cover_rectangles: Sequence[Sequence[float]] = (),
    canvas_mode: str = "anchor",
    write_master: bool = True,
) -> dict[str, Any]:
    if duration_seconds < 1 or duration_seconds > 4:
        raise PipelineError("Review conversion duration must be between one and four seconds")
    if canvas_mode not in {"native", "anchor"}:
        raise PipelineError("Review conversion canvas_mode must be native or anchor")
    source_frame_count = duration_seconds * 12
    with tempfile.TemporaryDirectory(prefix="vim-wilds-cast-convert-") as directory:
        source = converter.extract_frames(raw_video, 12, Path(directory))
        if len(source) < source_frame_count:
            raise PipelineError(
                f"Expected at least {source_frame_count} decoded frames for a {duration_seconds}-second clip, found {len(source)}"
            )
        source = source[:source_frame_count]
        background, variation = converter.estimate_background(source)
        source = cover_source_rectangles(source, background, cover_rectangles)
        # The batch contract locks Veo to one dark backdrop. Border variation
        # can still rise when a stray generated effect reaches an edge; the
        # component filter removes it. Keep this pipeline deterministic and
        # local rather than loading BiRefNet for dozens of 720p video frames.
        mode = "background"
        cleaned = converter.matte_frames(source, background, 7, 16, mode, "auto")
        if canvas_mode == "native":
            # Preserve Veo's entire 9:16 frame. It deliberately includes room
            # above and below the neutral pose for jumps, sparkles and props;
            # the now-transparent backdrop compresses well in WebP.
            frames = [frame.copy() for frame in cleaned]
            placement = None
            durations = None
        else:
            idle_image = Image.open(idle).convert("RGBA")
            placement = converter.fit_placement(cleaned, idle_image, 256, 6, "width")
            aligned = converter.render_aligned_frames(cleaned, placement, 256)
            anchor = converter.render_anchor_frame(idle_image, 256, placement.canvas_size)
            frames = converter.add_idle_morph_ramp(aligned, anchor)
            durations = converter.morph_ramp_durations(len(aligned), 12)
        if write_master:
            converter.save_webp(frames, master, 12, 1, lossless=True, durations_ms=durations)
        converter.save_webp(
            frames, runtime, 12, 1, lossless=False, quality=RUNTIME_QUALITY, durations_ms=durations
        )
        converter.write_debug(debug, source, cleaned, frames, background, variation, placement)
        write_all_frame_contact_sheet(frames, debug / "all-frames-contact-sheet.png", raw_video.stem)
        review_frames = [debug / f"frame-{index:02d}.png" for index in (0, len(frames) // 2, len(frames) - 1)]
        make_contact_sheet(review_frames, debug / "contact-sheet.png", raw_video.stem)
    animation_info = converter.inspect_webp_animation(runtime)
    expected_info = {"frames": len(frames), "duration_ms": duration_seconds * 1000, "loop": 1}
    if animation_info != expected_info:
        raise PipelineError(f"Runtime WebP metadata is invalid: {animation_info}")
    if canvas_mode == "anchor":
        with Image.open(runtime) as encoded:
            for index in range(encoded.n_frames):
                encoded.seek(index)
                alpha = np.asarray(encoded.convert("RGBA").getchannel("A"))
                if alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any():
                    raise PipelineError(f"Runtime WebP clips foreground pixels in frame {index}")
    content_bounds = [converter.alpha_bbox(frame) for frame in frames]
    edge_clearance = min(
        min(left, top, frame.width - right, frame.height - bottom)
        for frame, (left, top, right, bottom) in zip(frames, content_bounds)
    )
    runtime_bytes = runtime.stat().st_size
    first_last_mae = float(np.abs(np.asarray(frames[0], dtype=np.int16) - np.asarray(frames[-1], dtype=np.int16)).mean())
    alpha_areas = [int(np.count_nonzero(np.asarray(frame.getchannel("A")))) for frame in frames]
    area_ratio = max(alpha_areas) / max(1, min(alpha_areas))
    automatic_flags = []
    if first_last_mae > 10:
        automatic_flags.append("possible-neutral-pose-return-failure")
    if area_ratio > 2.2:
        automatic_flags.append("possible-anatomy-or-background-drift")
    if variation > 30:
        automatic_flags.append("high-border-variation-reviewed-with-cv-matte")
    if not 300 * 1024 <= runtime_bytes <= 700 * 1024:
        automatic_flags.append("runtime-size-outside-target")
    anchor_audit: dict[str, Any] = {}
    if canvas_mode == "anchor":
        anchor_audit = anchor_frame_audit(frames, Image.open(idle).convert("RGBA"))
        automatic_flags.extend(anchor_review_flags(anchor_audit))
    result = {
        "frames": len(frames), "fps": 12, "duration_seconds": duration_seconds, "loop": 1,
        "source_frames": source_frame_count,
        "canvas_size": [frames[0].width, frames[0].height], "canvas_mode": canvas_mode,
        "base_size": 256, "css_scale": 1.0 if canvas_mode == "native" else frames[0].width / 256,
        "presentation": {
            "object_fit": "contain", "object_position": "center center",
            "preserve_full_native_canvas": canvas_mode == "native",
        },
        "border_variation": variation,
        "runtime_bytes": runtime_bytes,
        "runtime_size_target_bytes": [300 * 1024, 700 * 1024],
        "runtime_size_in_target": 300 * 1024 <= runtime_bytes <= 700 * 1024,
        "all_frames_audited": True,
        "frame_alpha_bounds": [list(bounds) for bounds in content_bounds],
        "minimum_content_edge_clearance_px": edge_clearance,
        "first_last_mean_absolute_error": round(first_last_mae, 3),
        "foreground_area_ratio": round(area_ratio, 3),
        **anchor_audit,
        "idle_morph_ramp": (
            {
                "method": "signed-distance-field",
                "pipeline_version": REACTION_SEAM_PIPELINE_VERSION,
                "alpha_coverage": "nearest-endpoint-premultiplied-interpolation",
                "head_intermediate_frames": len(converter.MORPH_HEAD_TIMES),
                "tail_intermediate_frames": len(converter.MORPH_TAIL_TIMES),
                "added_frames": len(frames) - source_frame_count,
                "duration_ms": sum(durations) if durations is not None else duration_seconds * 1000,
            }
            if canvas_mode == "anchor"
            else None
        ),
        "automatic_review_flags": automatic_flags,
        "human_review_checklist": [
            "identity and proportions match approved idle",
            "canonical props and anatomy are present exactly once",
            "no background leakage or dark edge halo",
            "first and last poses read as the approved neutral pose",
        ],
        "review_conversion": {
            "source_duration_seconds": 4,
            "duration_seconds": duration_seconds,
            "cover_rectangles": [list(rectangle) for rectangle in cover_rectangles],
        },
    }
    if write_master:
        result["master_bytes"] = master.stat().st_size
    return result


def compact_reaction_manifest_record(
    runtime: Path, details: dict[str, Any], slot: int,
) -> dict[str, Any]:
    """Keep large prompts and per-frame audit arrays out of the runtime JSON."""
    return {
        "src": str(runtime.relative_to(ROOT)),
        "reaction_slot": slot,
        "frames": details.get("frames"),
        "fps": details.get("fps"),
        "duration_seconds": details.get("duration_seconds"),
        "loop": details.get("loop"),
        "canvas_size": details.get("canvas_size"),
        "css_scale": details.get("css_scale"),
        "presentation": details.get("presentation"),
        "sha256": sha256_path(runtime),
    }


def write_manifest(catalogue: dict[str, Any], approvals: dict[str, Any]) -> None:
    manifest: dict[str, Any] = {"schema_version": 1, "characters": {}}
    for character in catalogue["characters"]:
        idle = approved_idle_path(character, approvals)
        animations = {}
        directory = ASSET_ROOT / character["id"] / "animations"
        directory.mkdir(parents=True, exist_ok=True)
        for action in catalogue["actions"]:
            runtime = directory / f"{action['id']}.webp"
            metadata = directory / f"{action['id']}.json"
            if runtime.exists() and metadata.exists():
                animations[action["id"]] = {"src": str(runtime.relative_to(ROOT)), **read_json(metadata)}
        reactions: dict[str, Any] = {
            reaction: animations[reaction]
            for reaction in ("attentive", "puzzled", "encouraging")
            if reaction in animations
        }
        approved_reactions = approvals.get("reaction_variants", {}).get(character["id"], {})
        for reaction in ("attentive", "puzzled", "encouraging"):
            variants = []
            for slot, record in sorted(
                approved_reactions.get(reaction, {}).items(),
                key=lambda item: int(item[0]),
            ):
                if not record.get("approved") or not record.get("path"):
                    continue
                runtime = ROOT / record["path"]
                metadata = runtime.with_suffix(".json")
                if not runtime.exists() or not metadata.exists():
                    raise PipelineError(
                        f"Approved reaction variant is missing: {character['id']}/{reaction}/{slot}"
                    )
                details = read_json(metadata)
                variants.append(compact_reaction_manifest_record(runtime, details, int(slot)))
            if variants:
                reactions[reaction] = variants
        manifest["characters"][character["id"]] = {
            "name": character["name"], "role": character["role"],
            "idle": str(idle.relative_to(ROOT)), "idle_sha256": sha256_path(idle),
            "animations": animations, "reactions": reactions,
        }
    write_json(ASSET_ROOT / "manifest.json", manifest)


def approved_reaction_assets(
    catalogue: dict[str, Any], characters: Sequence[str] | None = None,
) -> list[tuple[dict[str, Any], Path, Path]]:
    """Return every promoted numbered reaction and its metadata sidecar."""
    selected = set(characters or ())
    unknown = selected - {character["id"] for character in catalogue["characters"]}
    if unknown:
        raise PipelineError(f"Unknown character(s): {', '.join(sorted(unknown))}")
    assets = []
    for character in catalogue["characters"]:
        if selected and character["id"] not in selected:
            continue
        directory = ASSET_ROOT / character["id"] / "animations"
        for runtime in sorted(directory.glob("*-variant-*.webp")):
            metadata = runtime.with_suffix(".json")
            if not metadata.is_file():
                raise PipelineError(f"Reaction sidecar is missing: {metadata}")
            assets.append((character, runtime, metadata))
    if not assets:
        raise PipelineError("No approved numbered reaction assets were found")
    return assets


def command_audit_reactions(args: argparse.Namespace) -> int:
    """Run the anchor audit over promoted WebPs without regenerating media."""
    catalogue = load_catalogue(args.catalogue)
    assets = approved_reaction_assets(catalogue, args.character)
    records = []
    counts: dict[str, int] = {}
    for character, runtime, metadata_path in assets:
        frames = decode_webp_frames(runtime)
        metrics = anchor_frame_audit(
            frames, Image.open(ASSET_ROOT / character["id"] / "idle.png").convert("RGBA")
        )
        flags = anchor_review_flags(metrics)
        for flag in flags:
            counts[flag] = counts.get(flag, 0) + 1
        records.append({
            "path": str(runtime.relative_to(ROOT)),
            **metrics,
            "automatic_review_flags": flags,
        })
        if args.update_sidecars:
            details = read_json(metadata_path)
            existing = [
                flag for flag in details.get("automatic_review_flags", [])
                if not flag.startswith("anchor-")
            ]
            details.update(metrics)
            details["automatic_review_flags"] = existing + flags
            write_json(metadata_path, details)
    report = {
        "schema_version": 1,
        "clips_audited": len(records),
        "clips_flagged": sum(bool(record["automatic_review_flags"]) for record in records),
        "flag_counts": dict(sorted(counts.items())),
        "records": records,
    }
    if args.report is not None:
        write_json(args.report, report)
    print(
        f"Anchor audit: {report['clips_audited']} clips, "
        f"{report['clips_flagged']} flagged; {json.dumps(report['flag_counts'], sort_keys=True)}"
    )
    return 0


def _refresh_reaction_approval_hashes(approvals: dict[str, Any]) -> None:
    for reactions in approvals.get("reaction_variants", {}).values():
        for variants in reactions.values():
            for record in variants.values():
                if record.get("approved") and record.get("path"):
                    runtime = ROOT / record["path"]
                    if runtime.is_file():
                        record["sha256"] = sha256_path(runtime)


def command_rebuild_reactions(args: argparse.Namespace) -> int:
    """Re-register and SDF-bookend every approved numbered reaction asset."""
    catalogue = load_catalogue(args.catalogue)
    approvals = require_catalogue_approval(args.catalogue)
    assets = approved_reaction_assets(catalogue, args.character)
    print(f"Reaction seam rebuild plan: {len(assets)} approved clip(s)")
    if not args.execute:
        print("Dry run only; add --execute to rebuild and promote the complete set.")
        return 0
    if args.max_concurrency < 1 or args.max_concurrency > 8:
        raise PipelineError("--max-concurrency must be between 1 and 8")
    staging_root = args.artifact_root / "reaction-seam-rebuild"

    def rebuild_one(
        character: dict[str, Any], runtime: Path, metadata_path: Path,
    ) -> tuple[Path, Path]:
        staged_runtime = staging_root / "runtime" / character["id"] / runtime.name
        staged_metadata = staged_runtime.with_suffix(".json")
        if args.resume and staged_runtime.is_file() and staged_metadata.is_file():
            staged_details = read_json(staged_metadata)
            ramp = staged_details.get("idle_morph_ramp") or {}
            if (
                ramp.get("method") == "signed-distance-field"
                and ramp.get("pipeline_version") == REACTION_SEAM_PIPELINE_VERSION
            ):
                return staged_runtime, staged_metadata
        details = read_json(metadata_path)
        source = ROOT / details.get("source", "")
        if not source.is_file():
            raise PipelineError(f"Reaction source video is missing: {source}")
        idle = approved_idle_path(character, approvals)
        debug = staging_root / "debug" / character["id"] / runtime.stem
        with tempfile.TemporaryDirectory(prefix="vim-wilds-reaction-rebuild-") as directory:
            master = Path(directory) / "master.webp"
            conversion = convert_video_asset(
                source,
                idle,
                master,
                staged_runtime,
                debug,
                duration_seconds=int(details.get("duration_seconds", 4)),
                cover_rectangles=details.get("review_conversion", {}).get("cover_rectangles", []),
                canvas_mode="anchor",
                write_master=False,
            )
        details.update(conversion)
        # The repository-only rebuild deliberately does not retain a lossless
        # master, so an earlier candidate's byte count would be misleading.
        details.pop("master_bytes", None)
        write_json(staged_metadata, details)
        return staged_runtime, staged_metadata

    staged: dict[Path, tuple[Path, Path]] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.max_concurrency) as executor:
        futures = {
            executor.submit(rebuild_one, character, runtime, metadata): runtime
            for character, runtime, metadata in assets
        }
        for completed, future in enumerate(concurrent.futures.as_completed(futures), 1):
            runtime = futures[future]
            staged[runtime] = future.result()
            print(f"Rebuilt {completed}/{len(assets)}: {runtime.relative_to(ROOT)}", flush=True)

    # Promotion starts only after every source converted successfully.
    for _, runtime, metadata in assets:
        staged_runtime, staged_metadata = staged[runtime]
        shutil.copy2(staged_runtime, runtime)
        shutil.copy2(staged_metadata, metadata)
    _refresh_reaction_approval_hashes(approvals)
    write_json(APPROVALS_PATH, approvals)
    write_manifest(catalogue, approvals)
    print(f"Promoted {len(assets)} rebuilt reaction clips and refreshed the manifest.")
    return 0


def command_convert(args: argparse.Namespace) -> int:
    catalogue = load_catalogue(args.catalogue)
    approvals = require_catalogue_approval(args.catalogue)
    jobs = video_jobs(catalogue, approvals, args.character, args.animation)
    # Bootstrap approved Nix into the uniform asset hierarchy without changing app usage.
    nix_idle = ASSET_ROOT / "nix" / "idle.png"
    nix_idle.parent.mkdir(parents=True, exist_ok=True)
    if not nix_idle.exists():
        shutil.copy2(ROOT / "assets" / "nix.png", nix_idle)
    approvals.setdefault("stills", {})["nix"] = {
        "candidate": "existing",
        "path": str(nix_idle.relative_to(ROOT)),
        "sha256": sha256_path(nix_idle),
        "approved": True,
        "validation": validate_idle_sprite(nix_idle),
    }
    nix_runtime = ASSET_ROOT / "nix" / "animations" / "joyful-hop.webp"
    nix_metadata = nix_runtime.with_suffix(".json")
    if not nix_runtime.exists():
        frames = decode_webp_frames(ROOT / "assets" / "nix-success.webp")
        converter.save_webp(frames, nix_runtime, 12, 1, lossless=False, quality=RUNTIME_QUALITY)
    if not nix_metadata.exists():
        frames = decode_webp_frames(nix_runtime)
        write_json(nix_metadata, {
            "character": "nix", "animation": "joyful-hop", "attempt": "existing",
            "model": "veo-3.1-lite-generate-001", "model_revision": "veo-3.1-lite-generate-001",
            "source": "assets/nix-success.webp",
            "source_sha256": sha256_path(ROOT / "assets" / "nix-success.webp"),
            "frames": len(frames), "fps": 12, "loop": 1, "canvas_size": frames[0].width,
            "base_size": 256, "css_scale": frames[0].width / 256,
            "runtime_bytes": nix_runtime.stat().st_size, "estimated_generation_cost_usd": 0.12,
            "approved": True, "approval_state": "approved",
        })
    approvals.setdefault("animations", {}).setdefault("nix", {})["joyful-hop"] = {
        "attempt": "existing", "path": str(nix_runtime.relative_to(ROOT)),
        "sha256": sha256_path(nix_runtime), "approved": True,
    }
    write_json(APPROVALS_PATH, approvals)
    operations = load_operations(args.artifact_root)
    for character, action in jobs:
        key = f"{character['id']}/{action['id']}"
        record = operations.get("jobs", {}).get(key)
        if not record or record.get("status") != "completed" or not record.get("path"):
            print(f"Skipping incomplete video job {key}")
            continue
        attempt = int(record.get("attempt", 1))
        raw = ROOT / record["path"]
        if not raw.exists():
            print(f"Skipping missing {raw}")
            continue
        runtime = (
            args.artifact_root / "runtime-candidates" / character["id"]
            / f"{action['id']}-attempt-{attempt:02d}.webp"
        )
        metadata_path = runtime.with_suffix(".json")
        if runtime.exists() and metadata_path.exists() and args.resume:
            print(f"Using existing {runtime}")
            continue
        master = (
            args.artifact_root / "masters" / character["id"]
            / f"{action['id']}-attempt-{attempt:02d}.webp"
        )
        debug = args.artifact_root / "debug" / character["id"] / f"{action['id']}-attempt-{attempt:02d}"
        metadata = convert_video_asset(raw, approved_idle_path(character, approvals), master, runtime, debug)
        metadata.update({
            "character": character["id"], "animation": action["id"], "attempt": attempt,
            "description": action_description(character, action),
            "prompt": record.get(
                "prompt",
                video_prompt(
                    catalogue,
                    character,
                    action,
                    int(record.get("variant_index", 1)),
                ),
            ),
            "negative_prompt": record.get("negative_prompt", negative_video_prompt(character, action)),
            "model": catalogue["models"]["video"],
            "model_revision": catalogue["models"]["video"],
            "seed": int(record.get(
                "seed",
                video_seed(catalogue, character, action, int(record.get("variant_index", 1))),
            )),
            "variant_index": int(record.get("variant_index", 1)),
            "source": str(raw.relative_to(ROOT)), "source_sha256": sha256_path(raw),
            "estimated_generation_cost_usd": (
                float(catalogue["models"]["video_cost_per_second_usd"])
                * int(catalogue["models"]["duration_seconds"])
            ),
            "approved": False, "approval_state": "awaiting-human-review",
        })
        write_json(metadata_path, metadata)
        print(f"Created review candidate {runtime} ({runtime.stat().st_size / 1024:.0f} KiB)")
    write_manifest(catalogue, approvals)
    return 0


def review_jobs(
    catalogue: dict[str, Any], review: dict[str, Any], operations: dict[str, Any],
) -> list[tuple[dict[str, Any], dict[str, Any], int, dict[str, Any]]]:
    """Expand the human review file into exact completed attempts to promote."""
    if review.get("schema_version") != 1 or not isinstance(review.get("reviewed"), dict):
        raise PipelineError("Video review file must contain schema_version 1 and a reviewed object")
    overrides = review.get("overrides", {})
    if not isinstance(overrides, dict):
        raise PipelineError("Video review overrides must be an object")
    jobs: list[tuple[dict[str, Any], dict[str, Any], int, dict[str, Any]]] = []
    seen: set[str] = set()
    for character_id, selection in review["reviewed"].items():
        character = character_by_id(catalogue, character_id)
        if not isinstance(selection, dict):
            raise PipelineError(f"Review selection for {character_id} must be an object")
        excluded = set(selection.get("exclude", []))
        unknown = excluded - {action["id"] for action in catalogue["actions"]}
        if unknown:
            raise PipelineError(f"Unknown excluded animation(s) for {character_id}: {', '.join(sorted(unknown))}")
        for action in catalogue["actions"]:
            if action["id"] in excluded:
                continue
            key = f"{character_id}/{action['id']}"
            if key in seen:
                raise PipelineError(f"Duplicate reviewed animation: {key}")
            seen.add(key)
            record = operations.get("jobs", {}).get(key)
            if not record or record.get("status") != "completed" or not record.get("path"):
                raise PipelineError(f"Reviewed animation is not completed: {key}")
            attempt = int(record.get("attempt", 1))
            options = overrides.get(key, {})
            if not isinstance(options, dict):
                raise PipelineError(f"Review override for {key} must be an object")
            duration = int(options.get("duration_seconds", 4))
            rectangles = options.get("cover_rectangles", [])
            if not isinstance(rectangles, list):
                raise PipelineError(f"Review cover_rectangles for {key} must be a list")
            jobs.append((character, action, attempt, {"duration_seconds": duration, "cover_rectangles": rectangles}))
    return jobs


def command_review_approve(args: argparse.Namespace) -> int:
    """Convert and promote a reviewed set, retaining every review adjustment in metadata."""
    catalogue = load_catalogue(args.catalogue)
    approvals = require_catalogue_approval(args.catalogue)
    review = read_json(args.review_file)
    operations = load_operations(args.artifact_root)
    jobs = review_jobs(catalogue, review, operations)
    print(f"Review promotion plan: {len(jobs)} completed clips")
    if args.max_concurrency < 1 or args.max_concurrency > 8:
        raise PipelineError("--max-concurrency must be between 1 and 8")
    # Convert all files before any repository promotion. A bad matte cannot leave
    # a partially approved group behind.
    def convert_one(
        character: dict[str, Any], action: dict[str, Any], attempt: int, options: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, Any], int, bool]:
        key = f"{character['id']}/{action['id']}"
        record = operations["jobs"][key]
        raw = ROOT / record["path"]
        runtime = args.artifact_root / "runtime-candidates" / character["id"] / f"{action['id']}-attempt-{attempt:02d}.webp"
        metadata_path = runtime.with_suffix(".json")
        if runtime.exists() and metadata_path.exists() and args.resume:
            existing_metadata = read_json(metadata_path)
            # A rebuild must not silently reuse the earlier per-frame matte.
            # Only candidates written by the all-frame audit path are safe to
            # reuse while replacing approved runtime assets.
            if not args.replace_approved or existing_metadata.get("all_frames_audited"):
                return character, action, attempt, False
        master = args.artifact_root / "masters" / character["id"] / f"{action['id']}-attempt-{attempt:02d}.webp"
        debug = args.artifact_root / "debug" / character["id"] / f"{action['id']}-attempt-{attempt:02d}"
        metadata = convert_video_asset(
            raw, approved_idle_path(character, approvals), master, runtime, debug,
            duration_seconds=options["duration_seconds"], cover_rectangles=options["cover_rectangles"],
        )
        metadata.update({
            "character": character["id"], "animation": action["id"], "attempt": attempt,
            "description": action_description(character, action),
            "prompt": record.get(
                "prompt",
                video_prompt(
                    catalogue,
                    character,
                    action,
                    int(record.get("variant_index", 1)),
                ),
            ),
            "negative_prompt": record.get(
                "negative_prompt",
                negative_video_prompt(character, action),
            ),
            "model": catalogue["models"]["video"],
            "model_revision": catalogue["models"]["video"],
            "seed": video_seed(catalogue, character, action, int(record.get("variant_index", 1))),
            "variant_index": int(record.get("variant_index", 1)),
            "source": str(raw.relative_to(ROOT)), "source_sha256": sha256_path(raw),
            "estimated_generation_cost_usd": float(catalogue["models"]["video_cost_per_second_usd"]) * 4,
            "approved": False, "approval_state": "awaiting-human-review",
        })
        write_json(metadata_path, metadata)
        return character, action, attempt, True

    converted: list[tuple[dict[str, Any], dict[str, Any], int]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.max_concurrency) as executor:
        futures = [executor.submit(convert_one, *job) for job in jobs]
        for future in concurrent.futures.as_completed(futures):
            character, action, attempt, was_converted = future.result()
            runtime = args.artifact_root / "runtime-candidates" / character["id"] / f"{action['id']}-attempt-{attempt:02d}.webp"
            state = "Created" if was_converted else "Using existing"
            print(f"{state} review candidate {runtime} ({runtime.stat().st_size / 1024:.0f} KiB)", flush=True)
            converted.append((character, action, attempt))
    for character, action, attempt in converted:
        destination = promote_animation_candidate(
            catalogue, approvals, args.artifact_root, character, action, attempt,
            replace_approved=args.replace_approved,
        )
        print(f"Approved {character['name']} {action['id']} attempt {attempt}: {destination}")
    write_json(APPROVALS_PATH, approvals)
    write_manifest(catalogue, approvals)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate and manage the 15-character Vim Wilds cast.")
    parser.add_argument("--catalogue", type=Path, default=CATALOGUE_PATH)
    subparsers = parser.add_subparsers(dest="command", required=True)

    catalogue = subparsers.add_parser("catalogue", help="Validate JSON and render the Markdown catalogue")
    catalogue.add_argument("--output", type=Path, default=CATALOGUE_MD_PATH)
    catalogue.add_argument("--check", action="store_true")
    catalogue.set_defaults(handler=command_catalogue)

    stills = subparsers.add_parser("stills", help="Generate canonical idle candidates with Nano Banana")
    stills.add_argument("--candidates", type=int, default=3)
    stills.add_argument("--character", action="append")
    stills.add_argument("--execute", action="store_true")
    stills.add_argument("--budget-usd", type=float, default=DEFAULT_BUDGET)
    stills.add_argument("--artifact-root", type=Path, default=DEFAULT_ARTIFACT_ROOT)
    stills.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", "YOUR_PROJECT_ID"))
    stills.add_argument("--location", default=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
    stills.add_argument("--device", choices=("auto", "cpu", "mps", "cuda"), default="auto")
    stills.add_argument(
        "--min-request-interval", type=float, default=60.0,
        help="Minimum seconds between Nano Banana requests (default: 60, quota-safe).",
    )
    stills.set_defaults(handler=command_stills)

    void = subparsers.add_parser("void-submissions", help="Append reversals for requests Vertex rejected before acceptance")
    void.add_argument("--kind", choices=("image", "video"), required=True)
    void.add_argument("--character", required=True)
    void.add_argument("--candidate", type=int, required=True)
    void.add_argument("--reason", required=True)
    void.add_argument("--artifact-root", type=Path, default=DEFAULT_ARTIFACT_ROOT)
    void.set_defaults(handler=command_void_submissions)

    approve = subparsers.add_parser("approve", help="Approve the catalogue, a still, or an animation candidate")
    approve.add_argument("--catalogue", dest="catalogue_approval", action="store_true")
    approve.add_argument("--character", dest="character_id")
    approve.add_argument("--candidate", type=int)
    approve.add_argument("--animation")
    approve.add_argument("--attempt", type=int)
    approve.add_argument(
        "--reaction-slot",
        type=int,
        help="Add a reviewed attentive, puzzled or encouraging clip to this playback slot.",
    )
    approve.add_argument("--artifact-root", type=Path, default=DEFAULT_ARTIFACT_ROOT)
    approve.set_defaults(handler=command_approve)

    videos = subparsers.add_parser("videos", help="Generate four-second Veo clips from approved stills")
    videos.add_argument("--character", action="append")
    videos.add_argument("--animation", action="append")
    videos.add_argument("--execute", action="store_true")
    videos.add_argument("--resume", action="store_true")
    videos.add_argument("--retry", action="store_true", help="Submit a numbered retry for completed jobs")
    videos.add_argument("--rejection-reason", help="Human review reason recorded before a numbered retry")
    videos.add_argument("--budget-usd", type=float, default=DEFAULT_BUDGET)
    videos.add_argument("--max-concurrency", type=int, default=2)
    videos.add_argument(
        "--variant-index", type=int, choices=(1, 2, 3, 4, 5), default=1,
        help="Deterministic review variant index. Use a separate artifact root for each index.",
    )
    videos.add_argument(
        "--quota-backoff-seconds", type=float, default=60.0,
        help="Wait this long after a temporary Vertex 429 before retrying (default: 60).",
    )
    videos.add_argument(
        "--anchor-retries", type=int, default=2, choices=range(0, 6),
        help="Automatic retries after a reaction fails the idle-anchor gate (default: 2).",
    )
    videos.add_argument("--artifact-root", type=Path, default=DEFAULT_ARTIFACT_ROOT)
    videos.add_argument("--project", default=os.environ.get("GOOGLE_CLOUD_PROJECT", "YOUR_PROJECT_ID"))
    videos.add_argument("--location", default=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"))
    videos.set_defaults(handler=command_videos)

    convert = subparsers.add_parser("convert", help="Convert completed MP4s into master/runtime WebPs")
    convert.add_argument("--character", action="append")
    convert.add_argument("--animation", action="append")
    convert.add_argument("--resume", action="store_true")
    convert.add_argument("--artifact-root", type=Path, default=DEFAULT_ARTIFACT_ROOT)
    convert.set_defaults(handler=command_convert)

    review = subparsers.add_parser(
        "review-approve", help="Convert and promote a reviewed set of completed Veo clips"
    )
    review.add_argument("--review-file", type=Path, default=VIDEO_REVIEW_PATH)
    review.add_argument("--resume", action="store_true")
    review.add_argument("--max-concurrency", type=int, default=2)
    review.add_argument(
        "--replace-approved", action="store_true",
        help="Rebuild and replace approved runtime WebPs from the reviewed sources.",
    )
    review.add_argument("--artifact-root", type=Path, default=DEFAULT_ARTIFACT_ROOT)
    review.set_defaults(handler=command_review_approve)

    repair_selected = subparsers.add_parser(
        "repair-selected-reactions",
        help="Rebuild explicitly reviewed artifacts in the curated reaction folder",
    )
    repair_selected.add_argument("--selected-root", type=Path, default=SELECTED_REACTIONS_ROOT)
    repair_selected.add_argument("--repair-file", type=Path, default=SELECTED_REACTION_REPAIRS)
    repair_selected.add_argument("--execute", action="store_true")
    repair_selected.set_defaults(handler=command_repair_selected_reactions)

    import_selected = subparsers.add_parser(
        "import-selected-reactions",
        help="Promote every remaining human-curated reaction clip into numbered runtime slots",
    )
    import_selected.add_argument("--selected-root", type=Path, default=SELECTED_REACTIONS_ROOT)
    import_selected.add_argument("--execute", action="store_true")
    import_selected.add_argument(
        "--replace-approved",
        action="store_true",
        help="Resynchronise existing numbered reaction slots from the curated folder.",
    )
    import_selected.set_defaults(handler=command_import_selected_reactions)

    audit_reactions = subparsers.add_parser(
        "audit-reactions",
        help="Compare every approved numbered reaction endpoint with its idle anchor",
    )
    audit_reactions.add_argument("--character", action="append")
    audit_reactions.add_argument("--update-sidecars", action="store_true")
    audit_reactions.add_argument("--report", type=Path)
    audit_reactions.set_defaults(handler=command_audit_reactions)

    rebuild_reactions = subparsers.add_parser(
        "rebuild-reactions",
        help="Re-register and SDF-bookend approved numbered reaction clips",
    )
    rebuild_reactions.add_argument("--character", action="append")
    rebuild_reactions.add_argument("--execute", action="store_true")
    rebuild_reactions.add_argument("--resume", action="store_true")
    rebuild_reactions.add_argument("--max-concurrency", type=int, default=2)
    rebuild_reactions.add_argument("--artifact-root", type=Path, default=DEFAULT_ARTIFACT_ROOT)
    rebuild_reactions.set_defaults(handler=command_rebuild_reactions)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.handler(args)
    except PipelineError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
