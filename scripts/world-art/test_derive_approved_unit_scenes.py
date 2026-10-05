from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import derive_approved_unit_scenes as derive


def scene(root: Path, *, wide_source: bool = True) -> tuple[Path, dict]:
    directory = root / "text-objects"
    directory.mkdir()
    approved = directory / "candidate-04.png"
    Image.new("RGB", (64, 48), (20, 60, 70)).save(approved)
    if wide_source:
        Image.new("RGB", (64, 36), (20, 60, 70)).save(directory / "wide-source.png")
    manifest = {
        "unitId": "text-objects",
        "sceneId": "nested-garden",
        "approval": {"candidateId": "candidate-04"},
        "candidates": [{
            "id": "candidate-04",
            "path": approved.name,
            "approvalState": "approved",
            "sha256": derive.sha256(approved),
        }],
    }
    return directory, manifest


class PlanJobsTest(unittest.TestCase):
    def test_an_existing_source_is_left_alone_without_candidates(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory, manifest = scene(Path(temporary))
            self.assertEqual(derive.plan_jobs(directory, manifest, ["wide"], 0, False), [])

    def test_candidates_are_planned_beside_an_existing_source(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory, manifest = scene(Path(temporary))
            derive.candidate_path(directory, "wide", 2).write_bytes(b"kept")
            jobs = derive.plan_jobs(directory, manifest, ["wide"], 3, False)
            self.assertEqual([job[2].name for job in jobs], ["wide-candidate-01.png", "wide-candidate-03.png"])
            self.assertEqual({job[1].name for job in jobs}, {"candidate-04.png"})

    def test_a_repair_starts_from_the_existing_source(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory, manifest = scene(Path(temporary))
            jobs = derive.plan_jobs(directory, manifest, ["wide"], 2, True)
            self.assertEqual({job[1].name for job in jobs}, {"wide-source.png"})

    def test_a_repair_needs_a_source_to_repair(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory, manifest = scene(Path(temporary), wide_source=False)
            with self.assertRaises(RuntimeError):
                derive.plan_jobs(directory, manifest, ["wide"], 2, True)


class PromptTest(unittest.TestCase):
    def test_only_the_derive_prompt_refers_to_the_mask_image(self) -> None:
        self.assertIn("Image 2", derive.prompt("wide", "text-objects", "nested-garden"))
        repair = derive.repair_prompt("wide", "text-objects", "nested-garden")
        self.assertNotIn("Image 2", repair)
        self.assertIn("Remove it completely", repair)

    def test_text_occlusion_describes_the_band_and_drops_the_mask(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            (Path(temporary) / "metrics.json").write_text(
                '{"profiles": [{"id": "wide", "editor": {"x": 0.3, "y": 0.05, "width": 0.4, "height": 0.1}}]}'
            )
            original, derive.MASK_ROOT = derive.MASK_ROOT, Path(temporary)
            try:
                text = derive.text_occlusion_prompt("wide", "cursor-movement", "wayfinder-crossroads")
            finally:
                derive.MASK_ROOT = original
        self.assertNotIn("Image 2", text)
        self.assertNotIn("red-hatched", text)
        self.assertIn("from 30% to 70% of the width and 5% to 15% of the height", text)


class PromoteTest(unittest.TestCase):
    def test_the_chosen_candidate_becomes_the_source_and_the_rest_go(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory, manifest = scene(Path(temporary))
            for number, colour in ((1, (1, 2, 3)), (2, (4, 5, 6))):
                Image.new("RGB", (64, 36), colour).save(derive.candidate_path(directory, "wide", number))
            (directory / "wide-candidates-review.png").write_bytes(b"sheet")
            chosen = derive.candidate_path(directory, "wide", 2)
            chosen_hash = derive.sha256(chosen)
            manifest["derivativeCandidates"] = {"wide": [
                {"path": "wide-candidate-01.png", "mode": "repair", "model": "m", "generatedAt": "t1"},
                {"path": "wide-candidate-02.png", "mode": "repair", "model": "m", "generatedAt": "t2"},
            ]}
            destination = derive.promote(directory, manifest, "wide", 2)
            self.assertEqual(derive.sha256(destination), chosen_hash)
            self.assertEqual(manifest["derivatives"]["wide"], {
                "path": "wide-source.png",
                "sha256": chosen_hash,
                "generatedAt": "t2",
                "model": "m",
                "mode": "repair",
                "promotedFrom": "wide-candidate-02.png",
            })
            self.assertNotIn("derivativeCandidates", manifest)
            self.assertEqual(
                sorted(path.name for path in directory.iterdir()),
                ["candidate-04.png", "wide-source.png"],
            )

    def test_a_missing_candidate_changes_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory, manifest = scene(Path(temporary))
            before = derive.sha256(directory / "wide-source.png")
            with self.assertRaises(RuntimeError):
                derive.promote(directory, manifest, "wide", 1)
            self.assertEqual(derive.sha256(directory / "wide-source.png"), before)


class CopiedMaskTest(unittest.TestCase):
    def test_a_hatched_block_is_measured_and_plain_scenery_is_not(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            clean = Path(temporary) / "clean.png"
            Image.new("RGB", (640, 360), (20, 60, 70)).save(clean)
            masked = Path(temporary) / "masked.png"
            image = Image.new("RGB", (640, 360), (20, 60, 70))
            ImageDraw.Draw(image).rectangle((210, 0, 430, 34), fill=(232, 110, 122))
            image.save(masked)
            self.assertEqual(derive.copied_mask_fraction(clean), 0)
            self.assertGreater(derive.copied_mask_fraction(masked), derive.COPIED_MASK_THRESHOLD)


if __name__ == "__main__":
    unittest.main()
