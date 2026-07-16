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
import hashlib
import json
import os
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
ASSET_ROOT = ROOT / "assets" / "characters"
DEFAULT_ARTIFACT_ROOT = ROOT / "artifacts" / "character-generation"
LEDGER_NAME = "ledger.jsonl"
OPERATIONS_NAME = "operations.json"
BACKGROUND = (26, 32, 30, 255)
DEFAULT_BUDGET = 25.0
RUNTIME_QUALITY = 88


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
    if len(actions) != 10:
        raise PipelineError(f"Catalogue must contain 10 actions, found {len(actions)}")
    character_ids = [item.get("id") for item in characters]
    action_ids = [item.get("id") for item in actions]
    if len(set(character_ids)) != len(character_ids) or not all(character_ids):
        raise PipelineError("Character IDs must be present and unique")
    if len(set(action_ids)) != len(action_ids) or not all(action_ids):
        raise PipelineError("Action IDs must be present and unique")
    required = {
        "name", "species", "role", "description", "invariants", "motion",
        "prop_motion", "magic", "project", "prop_trick", "illusion", "signature",
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


def video_seed(catalogue: dict[str, Any], character: dict[str, Any], action: dict[str, Any]) -> int:
    return 2000 + catalogue["characters"].index(character) * 100 + catalogue["actions"].index(action)


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


def video_prompt(catalogue: dict[str, Any], character: dict[str, Any], action: dict[str, Any]) -> str:
    invariants = "; ".join(character["invariants"])
    description = action_description(character, action)
    return f"""Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character {character['name']}, {character['description']}
Action over exactly four seconds: {description}
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: {invariants}.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described."""


def negative_video_prompt(character: dict[str, Any]) -> str:
    return (
        "camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, "
        "new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, "
        "new props, missing props, mutated anatomy, changed costume, changed face, changed species, "
        "text, captions, watermark, scenery, floor, realistic texture, photorealism, 3D render, "
        f"anything inconsistent with {character['name']}"
    )


def render_catalogue_markdown(catalogue: dict[str, Any]) -> str:
    models = catalogue["models"]
    still_cost = 14 * 3 * float(models["image_cost_usd"])
    video_unit_cost = float(models["video_cost_per_second_usd"]) * int(models["duration_seconds"])
    video_cost = 149 * video_unit_cost
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
        f"- Minimum generation plan: 42 stills × ${models['image_cost_usd']:.3f} + 149 videos × ${video_unit_cost:.2f} = ${minimum_cost:.2f}",
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
            f"**Role:** {character['role']}  ",
            f"**Species:** {character['species']}  ",
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
                negative_video_prompt(character),
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
    print(f"Wrote {args.output}: 15 characters, 150 animation descriptions and prompts")
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
    # Nano Banana's baked checkerboards range from light white through mid-grey;
    # their border shades can be as low as 150 even when the subject is centred.
    neutral_light = (brightness >= 140) & (chroma <= 12)
    border = max(4, min(image.width, image.height) // 40)
    border_mask = np.concatenate((
        neutral_light[:border, :].ravel(), neutral_light[-border:, :].ravel(),
        neutral_light[border:-border, :border].ravel(), neutral_light[border:-border, -border:].ravel(),
    ))
    if variation <= 7:
        cleaned = converter.matte_frames([image], background, 7, 16, "background", device)[0]
    elif float(border_mask.mean()) >= 0.9:
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
        source = (
            args.artifact_root / "runtime-candidates" / character["id"]
            / f"{action['id']}-attempt-{args.attempt:02d}.webp"
        )
        source_metadata = source.with_suffix(".json")
        if not source.is_file() or not source_metadata.is_file():
            raise PipelineError(f"Animation candidate or metadata does not exist: {source}")
        destination = ASSET_ROOT / character["id"] / "animations" / f"{action['id']}.webp"
        destination_metadata = destination.with_suffix(".json")
        existing = approvals.get("animations", {}).get(character["id"], {}).get(action["id"])
        if existing and existing.get("approved"):
            raise PipelineError(f"Approved animation already exists: {destination}")
        if destination.exists() or destination_metadata.exists():
            raise PipelineError(f"Refusing to overwrite repository animation: {destination}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        metadata = read_json(source_metadata)
        metadata.update({"approved": True, "approval_state": "approved", "approved_attempt": args.attempt})
        write_json(destination_metadata, metadata)
        approvals.setdefault("animations", {}).setdefault(character["id"], {})[action["id"]] = {
            "attempt": args.attempt,
            "path": str(destination.relative_to(ROOT)),
            "sha256": sha256_path(destination),
            "approved": True,
        }
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


def command_videos(args: argparse.Namespace) -> int:
    catalogue = load_catalogue(args.catalogue)
    approvals = require_catalogue_approval(args.catalogue) if args.execute else load_approvals()
    jobs = video_jobs(catalogue, approvals, args.character, args.animation, require_approved=args.execute)
    unit_cost = float(catalogue["models"]["video_cost_per_second_usd"]) * int(catalogue["models"]["duration_seconds"])
    print(f"Video plan: {len(jobs)} new four-second clips; estimated output cost ${len(jobs) * unit_cost:.2f}")
    if not args.execute:
        print("Dry run only; no Vertex requests submitted. Execution requires all 15 approved idle sprites.")
        return 0
    if args.retry and (not args.character or not args.animation or not args.rejection_reason):
        raise PipelineError(
            "--retry requires an explicit --character, --animation, and --rejection-reason"
        )
    if args.max_concurrency < 1 or args.max_concurrency > 2:
        raise PipelineError("--max-concurrency must be 1 or 2")
    from google.genai import types

    client = create_vertex_client(args.project, args.location)
    operations = load_operations(args.artifact_root)
    queue = list(jobs)
    pending: dict[str, tuple[Any, dict[str, Any], dict[str, Any], Path]] = {}

    while queue or pending:
        while queue and len(pending) < args.max_concurrency:
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
            operation = client.models.generate_videos(
                model=catalogue["models"]["video"],
                prompt=video_prompt(catalogue, character, action),
                image=types.Image(image_bytes=prepared.read_bytes(), mime_type="image/png"),
                config=types.GenerateVideosConfig(
                    number_of_videos=1,
                    duration_seconds=4,
                    fps=24,
                    seed=video_seed(catalogue, character, action),
                    aspect_ratio="9:16",
                    resolution="720p",
                    negative_prompt=negative_video_prompt(character),
                    generate_audio=False,
                    resize_mode=types.ImageResizeMode.PAD,
                ),
            )
            if record and record.get("status") == "completed" and args.retry:
                append_ledger(args.artifact_root, {
                    "event": "rejected", "kind": "video", "character": character["id"],
                    "animation": action["id"], "attempt": record.get("attempt", 1),
                    "path": record.get("path"), "reason": args.rejection_reason,
                })
            append_ledger(args.artifact_root, {
                "event": "submitted", "kind": "video", "character": character["id"],
                "animation": action["id"], "model": catalogue["models"]["video"],
                "operation_name": operation.name, "estimated_cost_usd": unit_cost,
            })
            operations["jobs"][key] = {
                "status": "submitted", "operation_name": operation.name, "attempt": attempt,
                "path": str(raw_video.relative_to(ROOT)),
            }
            save_operations(args.artifact_root, operations)
            pending[key] = (operation, character, action, raw_video)
            print(f"Started {key}: {operation.name}")

        if not pending:
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
            save_generated_video(operation, raw_video)
            prior = operations["jobs"][key]
            operations["jobs"][key] = {**prior, "status": "completed", "path": str(raw_video.relative_to(ROOT))}
            save_operations(args.artifact_root, operations)
            append_ledger(args.artifact_root, {"event": "completed", "kind": "video", "character": character["id"], "animation": action["id"], "path": str(raw_video.relative_to(ROOT)), "sha256": sha256_path(raw_video)})
            print(f"Saved {raw_video}")
            del pending[key]
    return 0


def decode_webp_frames(path: Path) -> list[Image.Image]:
    frames = []
    with Image.open(path) as source:
        for index in range(source.n_frames):
            source.seek(index)
            frames.append(source.convert("RGBA").copy())
    return frames


def convert_video_asset(raw_video: Path, idle: Path, master: Path, runtime: Path, debug: Path) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="vim-wilds-cast-convert-") as directory:
        source = converter.extract_frames(raw_video, 12, Path(directory))
        if len(source) != 48:
            raise PipelineError(f"Expected 48 decoded frames for a four-second clip, found {len(source)}")
        background, variation = converter.estimate_background(source)
        mode = "background" if variation <= 7 else "birefnet"
        cleaned = converter.matte_frames(source, background, 7, 16, mode, "auto")
        placement = converter.fit_placement(cleaned, Image.open(idle).convert("RGBA"), 256, 6, "width")
        frames = converter.render_aligned_frames(cleaned, placement, 256)
        converter.save_webp(frames, master, 12, 1, lossless=True)
        converter.save_webp(frames, runtime, 12, 1, lossless=False, quality=RUNTIME_QUALITY)
        converter.write_debug(debug, source, cleaned, frames, background, variation, placement)
        review_frames = [debug / f"frame-{index:02d}.png" for index in (0, len(frames) // 2, len(frames) - 1)]
        make_contact_sheet(review_frames, debug / "contact-sheet.png", raw_video.stem)
    animation_info = converter.inspect_webp_animation(runtime)
    if animation_info != {"frames": 48, "duration_ms": 4000, "loop": 1}:
        raise PipelineError(f"Runtime WebP metadata is invalid: {animation_info}")
    with Image.open(runtime) as encoded:
        for index in range(encoded.n_frames):
            encoded.seek(index)
            alpha = np.asarray(encoded.convert("RGBA").getchannel("A"))
            if alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any():
                raise PipelineError(f"Runtime WebP clips foreground pixels in frame {index}")
    runtime_bytes = runtime.stat().st_size
    first_last_mae = float(np.abs(np.asarray(frames[0], dtype=np.int16) - np.asarray(frames[-1], dtype=np.int16)).mean())
    alpha_areas = [int(np.count_nonzero(np.asarray(frame.getchannel("A")))) for frame in frames]
    area_ratio = max(alpha_areas) / max(1, min(alpha_areas))
    automatic_flags = []
    if first_last_mae > 10:
        automatic_flags.append("possible-neutral-pose-return-failure")
    if area_ratio > 2.2:
        automatic_flags.append("possible-anatomy-or-background-drift")
    if variation > 7:
        automatic_flags.append("nonuniform-background-required-birefnet")
    if not 300 * 1024 <= runtime_bytes <= 700 * 1024:
        automatic_flags.append("runtime-size-outside-target")
    return {
        "frames": len(frames), "fps": 12, "loop": 1, "canvas_size": frames[0].width,
        "base_size": 256, "css_scale": frames[0].width / 256, "border_variation": variation,
        "runtime_bytes": runtime_bytes, "master_bytes": master.stat().st_size,
        "runtime_size_target_bytes": [300 * 1024, 700 * 1024],
        "runtime_size_in_target": 300 * 1024 <= runtime_bytes <= 700 * 1024,
        "first_last_mean_absolute_error": round(first_last_mae, 3),
        "foreground_area_ratio": round(area_ratio, 3),
        "automatic_review_flags": automatic_flags,
        "human_review_checklist": [
            "identity and proportions match approved idle",
            "canonical props and anatomy are present exactly once",
            "no background leakage or dark edge halo",
            "first and last poses read as the approved neutral pose",
        ],
    }


def write_manifest(catalogue: dict[str, Any], approvals: dict[str, Any]) -> None:
    manifest: dict[str, Any] = {"schema_version": 1, "characters": {}}
    for character in catalogue["characters"]:
        idle = approved_idle_path(character, approvals)
        animations = {}
        directory = ASSET_ROOT / character["id"] / "animations"
        for action in catalogue["actions"]:
            runtime = directory / f"{action['id']}.webp"
            metadata = directory / f"{action['id']}.json"
            if runtime.exists() and metadata.exists():
                animations[action["id"]] = {"src": str(runtime.relative_to(ROOT)), **read_json(metadata)}
        manifest["characters"][character["id"]] = {
            "name": character["name"], "role": character["role"],
            "idle": str(idle.relative_to(ROOT)), "idle_sha256": sha256_path(idle), "animations": animations,
        }
    write_json(ASSET_ROOT / "manifest.json", manifest)


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
            "description": action_description(character, action), "prompt": video_prompt(catalogue, character, action),
            "negative_prompt": negative_video_prompt(character), "model": catalogue["models"]["video"],
            "model_revision": catalogue["models"]["video"],
            "seed": video_seed(catalogue, character, action),
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
