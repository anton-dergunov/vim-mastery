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


class CharacterAssetPipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalogue = pipeline.load_catalogue()

    def test_catalogue_expands_all_150_character_actions(self) -> None:
        descriptions = [
            pipeline.action_description(character, action)
            for character in self.catalogue["characters"]
            for action in self.catalogue["actions"]
        ]
        self.assertEqual(len(self.catalogue["characters"]), 15)
        self.assertEqual(len(self.catalogue["actions"]), 10)
        self.assertEqual(len(descriptions), 150)
        self.assertTrue(all(description.strip() for description in descriptions))
        markdown = pipeline.render_catalogue_markdown(self.catalogue)
        self.assertEqual(markdown.count("<details><summary>Full Veo prompt</summary>"), 150)

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
            self.assertIn("149 new four-second clips", rendered)
            self.assertIn("$17.88", rendered)
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

    def test_video_jobs_require_approved_stills_only_for_execution(self) -> None:
        approvals = pipeline.load_approvals()
        dry_run_jobs = pipeline.video_jobs(self.catalogue, approvals, None, None, require_approved=False)
        self.assertEqual(len(dry_run_jobs), 149)
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


if __name__ == "__main__":
    unittest.main()
