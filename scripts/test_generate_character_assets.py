from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_character_assets as pipeline
import convert_veo_animation as converter


class CharacterAssetPipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalogue = pipeline.load_catalogue()

    def test_catalogue_expands_all_195_character_actions(self) -> None:
        descriptions = [
            pipeline.action_description(character, action)
            for character in self.catalogue["characters"]
            for action in self.catalogue["actions"]
        ]
        self.assertEqual(len(self.catalogue["characters"]), 15)
        self.assertEqual(len(self.catalogue["actions"]), 13)
        self.assertEqual(len(descriptions), 195)
        self.assertTrue(all(description.strip() for description in descriptions))
        markdown = pipeline.render_catalogue_markdown(self.catalogue)
        self.assertEqual(markdown.count("<details><summary>Full Veo prompt</summary>"), 195)

    def test_prompts_repeat_identity_and_four_second_contract(self) -> None:
        character = pipeline.character_by_id(self.catalogue, "tatter")
        action = pipeline.action_by_id(self.catalogue, "signature-finale")
        still = pipeline.still_prompt(self.catalogue, character)
        video = pipeline.video_prompt(self.catalogue, character, action)
        for invariant in character["invariants"]:
            self.assertIn(invariant, still)
            self.assertIn(invariant, video)
        self.assertIn("exactly four seconds", video)
        self.assertIn("Start from the supplied neutral pose", video)
        self.assertIn("finish settled in that exact pose", video)
        self.assertIn(character["signature"], video)

    def test_reaction_prompts_are_stationary_specific_performances(self) -> None:
        vela = pipeline.character_by_id(self.catalogue, "vela")
        attentive = pipeline.action_by_id(self.catalogue, "attentive")
        puzzled = pipeline.action_by_id(self.catalogue, "puzzled")
        encouraging = pipeline.action_by_id(self.catalogue, "encouraging")
        self.assertNotIn("light-footed steps", pipeline.action_description(vela, attentive))
        self.assertIn("absolutely no walking", pipeline.action_description(vela, attentive))
        self.assertIn("without detaching, lifting or duplicating it", pipeline.action_description(vela, attentive))
        self.assertIn("scratches the back of the head", pipeline.action_description(vela, puzzled))
        self.assertIn("question-mark-shaped thought wisp", pipeline.action_description(vela, puzzled))
        self.assertIn("after you—take the route", pipeline.action_description(vela, encouraging))
        for action in (attentive, puzzled, encouraging):
            prompt = pipeline.video_prompt(self.catalogue, vela, action)
            self.assertIn("feet remain anchored to the same pixels", prompt)
            self.assertIn("including every prop and its placement", prompt)
            self.assertIn("must not drop, hide, remove, exchange or transform any prop", prompt)
            self.assertIn("3.25-4.00 seconds", prompt)
            self.assertIn("fade-out", prompt)

    def test_puzzled_reactions_use_varied_character_specific_visual_language(self) -> None:
        puzzled_descriptions = [character["puzzled"] for character in self.catalogue["characters"]]
        self.assertEqual(len(set(puzzled_descriptions)), 15)
        self.assertEqual(sum("question-mark-shaped" in item for item in puzzled_descriptions), 1)
        for cue in (
            "reverse direction",
            "untidy knot",
            "searching lights",
            "light curl",
            "offset light panes",
            "off-beat",
            "puff of steam",
            "dust curl",
            "rhythm motes",
            "comically lopsided",
            "leaf wisps",
            "reflected glint",
            "compass needle",
            "route glow",
        ):
            self.assertTrue(any(cue in item for item in puzzled_descriptions), cue)

    def test_attentive_and_encouraging_reactions_use_varied_role_language(self) -> None:
        attentive = [character["attentive"] for character in self.catalogue["characters"]]
        encouraging = [character["encouraging"] for character in self.catalogue["characters"]]
        self.assertEqual(len(set(attentive)), 15)
        self.assertEqual(len(set(encouraging)), 15)
        for cue in (
            "lantern deliberately dims",
            "clean horizontal line",
            "monocular lens",
            "spell-ready",
            "optical lock-on",
            "metronome tail stops",
            "diagnostic attention",
            "command-key slab",
            "listening silence",
            "experimental observation",
            "protective listening",
            "collector's inspection",
            "pathfinder listening",
            "existing illustrated map",
        ):
            self.assertTrue(any(cue in item for item in attentive), cue)
        for cue in (
            "beckoning invitation",
            "step-by-step handoff",
            "next-page handoff",
            "spellcaster's handoff",
            "visual runway",
            "conductor-like count-in",
            "thumbs-up",
            "large clear passage",
            "musical count-in",
            "offered-bubble invitation",
            "safe open route",
            "precise handoff",
            "next route",
        ):
            self.assertTrue(any(cue in item for item in encouraging), cue)

    def test_reaction_prompts_forbid_text_and_salute_like_gestures(self) -> None:
        attentive = pipeline.action_by_id(self.catalogue, "attentive")
        vela = pipeline.character_by_id(self.catalogue, "vela")
        prompt = pipeline.video_prompt(self.catalogue, vela, attentive)
        self.assertIn("Do not display text anywhere in any frame", prompt)
        self.assertIn("no character name", prompt)
        self.assertIn("Never form a salute-like pose", prompt)
        self.assertIn("no single rigid straight arm or wing", prompt)
        negative_prompt = pipeline.negative_video_prompt(vela, attentive)
        self.assertIn("military salute", negative_prompt)
        self.assertIn("single straight raised wing", negative_prompt)
        self.assertIn("exposed breasts", negative_prompt)
        self.assertIn("paired round chest effects", negative_prompt)
        self.assertIn("Preserve the supplied costume and body coverage exactly", prompt)
        self.assertIn("never arrange paired round props", prompt)
        self.assertIn("Never add a puddle", prompt)
        self.assertIn("bodily fluid", negative_prompt)

        mica = pipeline.character_by_id(self.catalogue, "mica")
        self.assertIn("Both wings begin close", mica["encouraging"])
        self.assertIn("No single raised wing", mica["encouraging"])
        self.assertIn("no salute-like silhouette", mica["encouraging"])

    def test_third_reaction_variant_uses_alternate_choreography(self) -> None:
        attentive = pipeline.action_by_id(self.catalogue, "attentive")
        standard_prompts = [
            pipeline.video_prompt(self.catalogue, character, attentive, variant_index=1)
            for character in self.catalogue["characters"]
        ]
        variant_prompts = [
            pipeline.video_prompt(self.catalogue, character, attentive, variant_index=3)
            for character in self.catalogue["characters"]
        ]
        self.assertTrue(all("VARIANT THREE CHOREOGRAPHY" not in prompt for prompt in standard_prompts))
        self.assertTrue(all("VARIANT THREE CHOREOGRAPHY" in prompt for prompt in variant_prompts))
        self.assertTrue(all("no-salute" in prompt for prompt in variant_prompts))
        self.assertEqual(len(set(variant_prompts)), 15)
        for index, prompt in enumerate(variant_prompts):
            self.assertNotEqual(prompt, standard_prompts[index])

        mica = pipeline.character_by_id(self.catalogue, "mica")
        encouraging = pipeline.action_by_id(self.catalogue, "encouraging")
        mica_prompt = pipeline.video_prompt(
            self.catalogue, mica, encouraging, variant_index=3
        )
        self.assertIn("Both wings move as a mirrored pair", mica_prompt)
        self.assertIn("Neither wing may remain on the chest", mica_prompt)

    def test_fourth_reaction_variant_is_additive_and_character_specific(self) -> None:
        descriptions = self.catalogue["reaction_variant_four"]
        self.assertEqual(set(descriptions), {
            character["id"] for character in self.catalogue["characters"]
        })
        flattened = [
            reactions[reaction]
            for reactions in descriptions.values()
            for reaction in ("attentive", "puzzled", "encouraging")
        ]
        self.assertEqual(len(flattened), 45)
        self.assertEqual(len(set(flattened)), 45)

        mica = pipeline.character_by_id(self.catalogue, "mica")
        encouraging = pipeline.action_by_id(self.catalogue, "encouraging")
        prompt = pipeline.video_prompt(
            self.catalogue, mica, encouraging, variant_index=4
        )
        self.assertIn("VARIANT FOUR ADDITIVE CANDIDATE", prompt)
        self.assertIn("both wings folded against the body", prompt)
        self.assertIn("no wing opens, extends, salutes", prompt)
        self.assertNotIn("Both wings move as a mirrored pair", prompt)

        fifth_prompt = pipeline.video_prompt(
            self.catalogue, mica, encouraging, variant_index=5
        )
        self.assertIn("VARIANT FIVE ADDITIVE CANDIDATE", fifth_prompt)
        self.assertIn("both wings folded against the body", fifth_prompt)
        self.assertNotEqual(
            pipeline.video_seed(self.catalogue, mica, encouraging, 4),
            pipeline.video_seed(self.catalogue, mica, encouraging, 5),
        )

        puzzled = pipeline.action_by_id(self.catalogue, "puzzled")
        puzzled_prompt = pipeline.video_prompt(
            self.catalogue, mica, puzzled, variant_index=4
        )
        self.assertIn("false alarm that her brown crystal satchel", puzzled_prompt)
        self.assertIn("purse that was safely attached all along", puzzled_prompt)
        self.assertIn("low, symmetrical curved shrug", puzzled_prompt)
        self.assertIn("must never hit, tap, knock, bump, poke or slap", puzzled_prompt)

        nix = pipeline.character_by_id(self.catalogue, "nix")
        nix_puzzled_prompt = pipeline.video_prompt(
            self.catalogue, nix, puzzled, variant_index=4
        )
        self.assertIn("clear, friendly shoulder shrug", nix_puzzled_prompt)
        self.assertIn("one shoulder rises, then the other", nix_puzzled_prompt)
        self.assertIn("rather than mocking", nix_puzzled_prompt)

        tock = pipeline.character_by_id(self.catalogue, "tock")
        attentive = pipeline.action_by_id(self.catalogue, "attentive")
        tock_prompt = pipeline.video_prompt(
            self.catalogue, tock, attentive, variant_index=4
        )
        self.assertIn("breastplate remains completely closed", tock_prompt)
        self.assertIn("using only the existing body", tock_prompt)
        self.assertIn("No projected gears, floating panels, gauges", tock_prompt)
        for reaction in ("puzzled", "encouraging"):
            reaction_prompt = pipeline.video_prompt(
                self.catalogue,
                tock,
                pipeline.action_by_id(self.catalogue, reaction),
                variant_index=4,
            )
            self.assertIn("using only the existing body", reaction_prompt)
            self.assertIn("projected gears", reaction_prompt)
            self.assertIn("new lights appear anywhere", reaction_prompt)

        brikk = pipeline.character_by_id(self.catalogue, "brikk")
        for reaction in ("puzzled", "encouraging"):
            reaction_prompt = pipeline.video_prompt(
                self.catalogue,
                brikk,
                pipeline.action_by_id(self.catalogue, reaction),
                variant_index=4,
            )
            self.assertIn("using only the existing body", reaction_prompt)
            self.assertIn("puddle", reaction_prompt)

        bramble = pipeline.character_by_id(self.catalogue, "bramble")
        bramble_puzzled_prompt = pipeline.video_prompt(
            self.catalogue,
            bramble,
            pipeline.action_by_id(self.catalogue, "puzzled"),
            variant_index=4,
        )
        self.assertIn("false alarm that the shield has gone missing", bramble_puzzled_prompt)
        self.assertIn("eyes open extremely wide", bramble_puzzled_prompt)
        self.assertIn("shield actually remains attached", bramble_puzzled_prompt)

    def test_generation_seeds_are_stable_and_unique(self) -> None:
        vela = pipeline.character_by_id(self.catalogue, "vela")
        tatter = pipeline.character_by_id(self.catalogue, "tatter")
        hop = pipeline.action_by_id(self.catalogue, "joyful-hop")
        dance = pipeline.action_by_id(self.catalogue, "victory-dance")
        self.assertEqual(pipeline.still_seed(self.catalogue, vela, 2), 1102)
        self.assertNotEqual(
            pipeline.still_seed(self.catalogue, vela, 2),
            pipeline.still_seed(self.catalogue, tatter, 2),
        )
        self.assertNotEqual(
            pipeline.video_seed(self.catalogue, vela, hop),
            pipeline.video_seed(self.catalogue, vela, dance),
        )
        self.assertNotEqual(
            pipeline.video_seed(self.catalogue, vela, hop, 1),
            pipeline.video_seed(self.catalogue, vela, hop, 2),
        )

    def test_dry_runs_report_expected_jobs_without_writing_ledger(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(
                    pipeline.main(["stills", "--candidates", "3", "--artifact-root", str(root)]),
                    0,
                )
                self.assertEqual(pipeline.main(["videos", "--artifact-root", str(root)]), 0)
            rendered = output.getvalue()
            self.assertIn("42 calls", rendered)
            self.assertIn("$2.81", rendered)
            self.assertIn("194 new four-second clips", rendered)
            self.assertIn("$23.28", rendered)
            self.assertFalse((root / pipeline.LEDGER_NAME).exists())

    def test_budget_counts_every_submitted_request(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pipeline.append_ledger(root, {"event": "submitted", "kind": "image", "estimated_cost_usd": 2.81})
            pipeline.append_ledger(root, {"event": "submitted", "kind": "video", "estimated_cost_usd": 17.88})
            self.assertAlmostEqual(pipeline.ledger_spend(root), 20.69)
            pipeline.append_ledger(root, {"event": "voided_submission", "kind": "image", "estimated_cost_usd": 0.067})
            self.assertAlmostEqual(pipeline.ledger_spend(root), 20.623)
            pipeline.enforce_budget(root, 25, 4.31)
            with self.assertRaises(pipeline.PipelineError):
                pipeline.enforce_budget(root, 25, 4.38)

    def test_catalogue_approval_gate_stays_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            approvals = Path(directory) / "approvals.json"
            approvals.write_text(json.dumps({"schema_version": 1, "catalogue_approved": False}))
            with mock.patch.object(pipeline, "APPROVALS_PATH", approvals):
                with self.assertRaisesRegex(pipeline.PipelineError, "Catalogue is not approved"):
                    pipeline.require_catalogue_approval()

    def test_catalogue_approval_is_bound_to_exact_json_revision(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalogue = root / "catalogue.json"
            catalogue.write_text("first")
            approvals = root / "approvals.json"
            approvals.write_text(json.dumps({
                "schema_version": 1,
                "catalogue_approved": True,
                "catalogue_sha256": pipeline.sha256_path(catalogue),
            }))
            with mock.patch.object(pipeline, "APPROVALS_PATH", approvals):
                pipeline.require_catalogue_approval(catalogue)
                catalogue.write_text("changed")
                with self.assertRaisesRegex(pipeline.PipelineError, "current revision"):
                    pipeline.require_catalogue_approval(catalogue)

    def test_idle_validation_requires_transparency_and_readable_coverage(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "idle.png"
            image = Image.new("RGBA", (128, 128))
            ImageDraw.Draw(image).ellipse((32, 16, 96, 116), fill=(20, 110, 108, 255))
            image.save(path)
            result = pipeline.validate_idle_sprite(path)
            self.assertEqual(result["baseline"], 117)
            Image.new("RGBA", (128, 128), (20, 110, 108, 255)).save(path)
            with self.assertRaisesRegex(pipeline.PipelineError, "transparency"):
                pipeline.validate_idle_sprite(path)

    def test_uniform_generated_backdrop_uses_cv_matte_without_model_download(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = root / "raw.png"
            output = root / "idle.png"
            image = Image.new("RGB", (256, 256), "white")
            ImageDraw.Draw(image).ellipse((64, 32, 192, 224), fill=(31, 102, 104))
            image.save(raw)
            with mock.patch.object(pipeline.animate_character, "prepare_foreground_cached") as birefnet:
                pipeline.normalize_idle(raw, output, "cpu")
            birefnet.assert_not_called()
            with Image.open(output) as result:
                self.assertEqual(result.mode, "RGBA")
                self.assertEqual(result.getchannel("A").getpixel((0, 0)), 0)

    def test_baked_checkerboard_uses_cv_matte_without_model_download(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = root / "raw.png"
            output = root / "idle.png"
            grid = Image.new("RGB", (256, 256), "white")
            draw = ImageDraw.Draw(grid)
            for y in range(0, 256, 16):
                for x in range(0, 256, 16):
                    if (x // 16 + y // 16) % 2:
                        draw.rectangle((x, y, x + 15, y + 15), fill=(205, 205, 205))
            draw.ellipse((64, 32, 192, 224), fill=(31, 102, 104))
            grid.save(raw)
            with mock.patch.object(pipeline.animate_character, "prepare_foreground_cached") as birefnet:
                pipeline.normalize_idle(raw, output, "cpu")
            birefnet.assert_not_called()
            with Image.open(output) as result:
                self.assertEqual(result.getchannel("A").getpixel((0, 0)), 0)
                self.assertIsNotNone(result.getchannel("A").getbbox())

    def test_temporal_matte_retains_detached_animated_effects(self) -> None:
        first = Image.new("L", (256, 256))
        second = Image.new("L", (256, 256))
        for alpha, body_y in ((first, 112), (second, 88)):
            draw = ImageDraw.Draw(alpha)
            draw.rectangle((96, body_y, 159, body_y + 95), fill=255)
            draw.ellipse((116, 36, 132, 52), fill=255)  # detached high sparkle
        bounds = converter.temporal_main_bounds([first, second])
        kept = converter.keep_character_and_effects(first, temporal_bounds=bounds)
        self.assertEqual(kept.getpixel((124, 44)), 255)

    def test_video_jobs_require_approved_stills_only_for_execution(self) -> None:
        approvals = pipeline.load_approvals()
        approvals["stills"].pop("vela")
        dry_run_jobs = pipeline.video_jobs(self.catalogue, approvals, None, None, require_approved=False)
        self.assertEqual(len(dry_run_jobs), 194)
        with self.assertRaisesRegex(pipeline.PipelineError, "No approved idle sprite for vela"):
            pipeline.video_jobs(self.catalogue, approvals, None, None, require_approved=True)

    def test_operations_round_trip_preserves_resume_information(self) -> None:
        state = {
            "schema_version": 1,
            "jobs": {
                "vela/joyful-hop": {
                    "status": "submitted",
                    "operation_name": "projects/example/operations/123",
                    "attempt": 2,
                    "path": "artifacts/character-generation/videos/vela/joyful-hop-attempt-02.mp4",
                }
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pipeline.save_operations(root, state)
            self.assertEqual(pipeline.load_operations(root), state)

    def test_missing_vertex_video_is_an_explicit_failure(self) -> None:
        operation = SimpleNamespace(result=SimpleNamespace(generated_videos=[]), response=None)
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(pipeline.PipelineError, "returned no video"):
                pipeline.save_generated_video(operation, Path(directory) / "missing.mp4")

    def test_animation_approval_promotes_one_attempt_without_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact_root = root / "artifacts"
            candidate = artifact_root / "runtime-candidates" / "vela" / "joyful-hop-attempt-01.webp"
            candidate.parent.mkdir(parents=True)
            candidate.write_bytes(b"reviewed-webp")
            candidate.with_suffix(".json").write_text(json.dumps({
                "character": "vela", "animation": "joyful-hop", "approved": False,
            }))
            approvals_path = root / "approvals.json"
            approvals_path.write_text(json.dumps({
                "schema_version": 1,
                "catalogue_approved": True,
                "catalogue_sha256": pipeline.sha256_path(pipeline.CATALOGUE_PATH),
                "stills": {},
                "animations": {},
            }))
            args = SimpleNamespace(
                catalogue=pipeline.CATALOGUE_PATH,
                catalogue_approval=False,
                character_id="vela",
                candidate=None,
                animation="joyful-hop",
                attempt=1,
                artifact_root=artifact_root,
            )
            with (
                mock.patch.object(pipeline, "ROOT", root),
                mock.patch.object(pipeline, "ASSET_ROOT", root / "assets" / "characters"),
                mock.patch.object(pipeline, "APPROVALS_PATH", approvals_path),
                mock.patch.object(pipeline, "write_manifest") as manifest,
            ):
                self.assertEqual(pipeline.command_approve(args), 0)
                destination = root / "assets" / "characters" / "vela" / "animations" / "joyful-hop.webp"
                self.assertEqual(destination.read_bytes(), b"reviewed-webp")
                self.assertEqual(json.loads(destination.with_suffix(".json").read_text())["approval_state"], "approved")
                manifest.assert_called_once()
                with self.assertRaisesRegex(pipeline.PipelineError, "already exists"):
                    pipeline.command_approve(args)

    def test_reaction_approval_adds_numbered_playback_slots(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact_root = root / "artifacts"
            candidate = (
                artifact_root / "runtime-candidates" / "vela" / "puzzled-attempt-01.webp"
            )
            candidate.parent.mkdir(parents=True)
            candidate.write_bytes(b"reviewed-reaction-webp")
            candidate.with_suffix(".json").write_text(json.dumps({
                "character": "vela",
                "animation": "puzzled",
                "approved": False,
            }))
            approvals_path = root / "approvals.json"
            approvals_path.write_text(json.dumps({
                "schema_version": 1,
                "catalogue_approved": True,
                "catalogue_sha256": pipeline.sha256_path(pipeline.CATALOGUE_PATH),
                "stills": {},
                "animations": {},
                "reaction_variants": {},
            }))
            args = SimpleNamespace(
                catalogue=pipeline.CATALOGUE_PATH,
                catalogue_approval=False,
                character_id="vela",
                candidate=None,
                animation="puzzled",
                attempt=1,
                reaction_slot=2,
                artifact_root=artifact_root,
            )
            with (
                mock.patch.object(pipeline, "ROOT", root),
                mock.patch.object(pipeline, "ASSET_ROOT", root / "assets" / "characters"),
                mock.patch.object(pipeline, "APPROVALS_PATH", approvals_path),
                mock.patch.object(pipeline, "write_manifest") as manifest,
            ):
                self.assertEqual(pipeline.command_approve(args), 0)
                destination = (
                    root / "assets" / "characters" / "vela" / "animations"
                    / "puzzled-variant-02.webp"
                )
                self.assertEqual(destination.read_bytes(), b"reviewed-reaction-webp")
                saved = json.loads(approvals_path.read_text())
                slot = saved["reaction_variants"]["vela"]["puzzled"]["2"]
                self.assertEqual(slot["path"], "assets/characters/vela/animations/puzzled-variant-02.webp")
                self.assertTrue(slot["approved"])
                manifest.assert_called_once()
                with self.assertRaisesRegex(pipeline.PipelineError, "already exists"):
                    pipeline.command_approve(args)

    def test_curated_reaction_inventory_accepts_uneven_variant_counts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            selected = Path(directory) / "__selected"
            expected = {
                ("nix", "attentive"): 3,
                ("mica", "puzzled"): 4,
                ("brikk", "encouraging"): 5,
            }
            frames = [
                Image.new("RGBA", (8, 8), (20, 30, 40, 255)),
                Image.new("RGBA", (8, 8), (30, 40, 50, 255)),
            ]
            for (character, reaction), count in expected.items():
                for round_number in range(1, count + 1):
                    runtime = (
                        selected / f"reactions-round-{round_number:02d}" / "runtime-candidates"
                        / character / f"{reaction}-attempt-01.webp"
                    )
                    runtime.parent.mkdir(parents=True, exist_ok=True)
                    frames[0].save(
                        runtime,
                        "WEBP",
                        save_all=True,
                        append_images=frames[1:],
                        duration=100,
                        loop=1,
                        lossless=True,
                    )
                    runtime.with_suffix(".json").write_text(json.dumps({
                        "character": character,
                        "animation": reaction,
                    }))
            jobs = pipeline.selected_reaction_jobs(self.catalogue, selected)
            actual = {}
            for job in jobs:
                key = (job["character"], job["reaction"])
                actual[key] = actual.get(key, 0) + 1
            self.assertEqual(actual, expected)
            mica_slots = [
                job["slot"] for job in jobs
                if job["character"] == "mica" and job["reaction"] == "puzzled"
            ]
            self.assertEqual(mica_slots, [1, 2, 3, 4])

    def test_reaction_runtime_manifest_record_excludes_generation_prompts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "assets/characters/nix/animations/puzzled-variant-01.webp"
            runtime.parent.mkdir(parents=True)
            runtime.write_bytes(b"runtime-reaction")
            details = {
                "frames": 48,
                "fps": 12,
                "duration_seconds": 4,
                "loop": 1,
                "canvas_size": [328, 328],
                "css_scale": 1.28125,
                "presentation": {"object_fit": "contain"},
                "prompt": "large paid-generation prompt",
                "frame_alpha_bounds": [[1, 2, 3, 4]] * 48,
            }
            with mock.patch.object(pipeline, "ROOT", root):
                record = pipeline.compact_reaction_manifest_record(runtime, details, 1)
            self.assertEqual(record["reaction_slot"], 1)
            self.assertEqual(record["frames"], 48)
            self.assertNotIn("prompt", record)
            self.assertNotIn("frame_alpha_bounds", record)

    def test_anchor_audit_records_exact_endpoints_and_flags_drift(self) -> None:
        idle = Image.new("RGBA", (64, 64))
        ImageDraw.Draw(idle).ellipse((18, 10, 46, 58), fill=(40, 130, 110, 255))
        exact = pipeline.anchor_frame_audit([idle, idle], idle, base_size=64)
        self.assertEqual(exact["anchor_first_frame_iou"], 1.0)
        self.assertEqual(exact["anchor_last_frame_iou"], 1.0)
        self.assertEqual(exact["anchor_foot_delta_px"], 0)
        self.assertEqual(pipeline.anchor_review_flags(exact), [])

        shifted = Image.new("RGBA", idle.size)
        ImageDraw.Draw(shifted).ellipse((24, 10, 52, 58), fill=(40, 130, 110, 255))
        drift = pipeline.anchor_frame_audit([shifted, shifted], idle, base_size=64)
        self.assertIn(
            "anchor-first-frame-iou-below-threshold",
            pipeline.anchor_review_flags(drift),
        )


if __name__ == "__main__":
    unittest.main()
