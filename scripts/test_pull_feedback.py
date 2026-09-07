from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pull_feedback as puller


def report(**overrides) -> dict:
    base = {
        "id": "3f2b1c4d-0000-4000-8000-000000000001",
        "created_at": "2026-09-06T10:00:00.000Z",
        "surface": "lesson",
        "unit_id": "text-objects",
        "activity_id": "promote-one-identifier",
        "note": "iw is not suggested",
        "markdown": "# iw is not suggested\n\nBody.\n",
        "payload_json": json.dumps({"schemaVersion": 1, "note": "iw is not suggested"}),
        "screenshot_key": None,
    }
    base.update(overrides)
    return base


class SlugTests(unittest.TestCase):
    def test_names_the_report_after_when_and_where_it_was_made(self):
        self.assertEqual(puller.report_slug(report()), "2026-09-06-promote-one-identifier")

    def test_falls_back_through_unit_then_surface(self):
        self.assertEqual(puller.report_slug(report(activity_id=None)), "2026-09-06-text-objects")
        self.assertEqual(
            puller.report_slug(report(activity_id=None, unit_id=None)), "2026-09-06-lesson"
        )

    def test_strips_characters_that_do_not_belong_in_a_path(self):
        slug = puller.report_slug(report(activity_id="mastery:text-objects:drill"))
        self.assertEqual(slug, "2026-09-06-mastery-text-objects-drill")
        self.assertNotIn("/", slug)
        self.assertNotIn(":", slug)


class WriteTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.addCleanup(self.temporary.cleanup)

    def test_writes_the_reviewed_markdown_and_the_envelope(self):
        directory = puller.write_report(self.root, report(), "token", "https://example.test")
        self.assertEqual((directory / "report.md").read_text(), "# iw is not suggested\n\nBody.\n")
        self.assertEqual(json.loads((directory / "report.json").read_text())["schemaVersion"], 1)

    def test_a_report_without_a_screenshot_is_written_normally(self):
        directory = puller.write_report(self.root, report(), "token", "https://example.test")
        self.assertFalse((directory / puller.SCREENSHOT_NAME).exists())
        self.assertTrue((directory / "report.md").exists())

    def test_two_reports_on_one_activity_in_one_day_do_not_collide(self):
        first = puller.write_report(self.root, report(), "token", "https://example.test")
        second = puller.write_report(
            self.root,
            report(id="99999999-0000-4000-8000-000000000002"),
            "token",
            "https://example.test",
        )
        self.assertNotEqual(first, second)
        self.assertTrue(second.name.endswith("99999999"))

    def test_a_row_with_no_markdown_still_lands_somewhere_readable(self):
        directory = puller.write_report(
            self.root, report(markdown=""), "token", "https://example.test"
        )
        self.assertIn("iw is not suggested", (directory / "report.md").read_text())

    def test_the_index_lists_reports_newest_first(self):
        puller.write_report(self.root, report(), "token", "https://example.test")
        puller.write_report(
            self.root,
            report(
                id="99999999-0000-4000-8000-000000000002",
                created_at="2026-09-07T10:00:00.000Z",
                activity_id="frame-an-assignment",
                markdown="# Stepping const at once\n\nBody.\n",
            ),
            "token",
            "https://example.test",
        )
        puller.write_index(self.root)

        lines = (self.root / "index.md").read_text().splitlines()
        entries = [line for line in lines if line.startswith("- [")]
        self.assertEqual(len(entries), 2)
        self.assertIn("Stepping const at once", entries[0])
        self.assertIn("iw is not suggested", entries[1])


if __name__ == "__main__":
    unittest.main()
