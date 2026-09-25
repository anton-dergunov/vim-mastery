from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import mark as marker
import pull as puller

REPORT_ID = "3f2b1c4d-0000-4000-8000-000000000001"


def seed(root: Path, report_id: str = REPORT_ID, name: str = "2026-09-06-promote-one-identifier",
         status: str = "new") -> Path:
    directory = root / name
    directory.mkdir(parents=True)
    (directory / "report.md").write_text("# iw is not suggested\n\nBody.\n", encoding="utf-8")
    puller.write_meta(directory, {"id": report_id, "created_at": "2026-09-06T10:00:00.000Z",
                                  "status": status})
    return directory


class ResolveTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.addCleanup(self.temporary.cleanup)

    def test_a_directory_name_resolves_to_the_report_id(self):
        seed(self.root)
        resolved = marker.resolve_reference(self.root, "2026-09-06-promote-one-identifier")
        self.assertEqual(resolved, REPORT_ID)

    def test_an_id_prefix_is_passed_through_for_the_server_to_resolve(self):
        # This is what keeps marking possible when feedback/ has been deleted.
        self.assertEqual(marker.resolve_reference(self.root, "3f2b1c4d"), "3f2b1c4d")

    def test_a_directory_without_usable_meta_is_reported_rather_than_guessed(self):
        directory = self.root / "2026-09-06-broken"
        directory.mkdir(parents=True)
        (directory / "meta.json").write_text("{}", encoding="utf-8")
        with self.assertRaises(SystemExit):
            marker.resolve_reference(self.root, "2026-09-06-broken")

    def test_the_local_directory_for_an_id_is_found_by_its_meta(self):
        directory = seed(self.root)
        self.assertEqual(marker.local_directory_for(self.root, REPORT_ID), directory)
        self.assertIsNone(marker.local_directory_for(self.root, "no-such-id"))


class ListTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.addCleanup(self.temporary.cleanup)

    def test_listing_a_missing_directory_fails_rather_than_printing_nothing(self):
        self.assertEqual(marker.list_reports(self.root / "absent"), 1)

    def test_listing_reports_succeeds(self):
        seed(self.root)
        seed(self.root, report_id="99999999-0000-4000-8000-000000000002",
             name="2026-09-07-frame-an-assignment", status="done")
        self.assertEqual(marker.list_reports(self.root), 0)


class MarkTests(unittest.TestCase):
    """The mark path with the network replaced, so the local mirror is testable."""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.addCleanup(self.temporary.cleanup)
        self.sent = {}

        def fake_request_json(url, token, data=None):
            self.sent = {"url": url, "token": token, "body": json.loads(data)}
            return {"id": REPORT_ID, "status": self.sent["body"]["status"],
                    "resolution": self.sent["body"]["resolution"],
                    "resolved_at": "2026-09-08T09:00:00.000Z"}

        original = puller.request_json
        puller.request_json = fake_request_json
        self.addCleanup(lambda: setattr(puller, "request_json", original))

    def run_mark(self, *args):
        return marker.main([*args, "--endpoint", "https://example.test",
                            "--token", "secret", "--output", str(self.root)])

    def test_marking_by_directory_name_posts_the_resolved_id(self):
        seed(self.root)
        code = self.run_mark("2026-09-06-promote-one-identifier", "done", "fixed in a1b2c3")

        self.assertEqual(code, 0)
        self.assertEqual(self.sent["url"], f"https://example.test/reports/{REPORT_ID}/status")
        self.assertEqual(self.sent["body"], {"status": "done", "resolution": "fixed in a1b2c3"})

    def test_the_local_mirror_updates_without_waiting_for_the_next_pull(self):
        directory = seed(self.root)
        self.run_mark("2026-09-06-promote-one-identifier", "done", "fixed in a1b2c3")

        meta = puller.read_meta(directory)
        self.assertEqual(meta["status"], "done")
        self.assertEqual(meta["resolution"], "fixed in a1b2c3")
        self.assertFalse(puller.is_open(directory))
        self.assertIn("## Open (0)", (self.root / "index.md").read_text())

    def test_a_resolution_is_optional(self):
        seed(self.root)
        self.assertEqual(self.run_mark("2026-09-06-promote-one-identifier", "wontfix"), 0)
        self.assertIsNone(self.sent["body"]["resolution"])

    def test_marking_an_id_prefix_works_with_no_local_copy(self):
        self.assertEqual(self.run_mark("3f2b1c4d", "done"), 0)
        self.assertEqual(self.sent["url"], "https://example.test/reports/3f2b1c4d/status")


if __name__ == "__main__":
    unittest.main()
