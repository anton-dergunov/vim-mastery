#!/usr/bin/env python3
"""Sync in-app feedback reports from the Cloudflare Worker into local files.

Each report becomes a directory holding the Markdown the reporter reviewed
before sending and, when one was attached, the screenshot it references. The
layout is deliberately the same shape as the hand-made ``feedback_example``
notes, so triage reads the same way it always has.

The endpoint is write-only to the public; reading needs the admin token set
with ``wrangler secret put ADMIN_TOKEN``.

Example:
    export FEEDBACK_ENDPOINT=https://vim-wilds-feedback.example.workers.dev
    export FEEDBACK_ADMIN_TOKEN=...
    python3 scripts/pull_feedback.py

Only the standard library is used, so no virtualenv is needed to run it.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_OUTPUT = Path("feedback")
WATERMARK_FILE = ".last-sync"
SCREENSHOT_NAME = "screenshot.webp"


def request_json(url: str, token: str) -> dict:
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def request_bytes(url: str, token: str) -> bytes:
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def report_slug(report: dict) -> str:
    """Name a directory after when and where the report was made."""
    created = (report.get("created_at") or "")[:10] or "undated"
    where = report.get("activity_id") or report.get("unit_id") or report.get("surface") or "report"
    safe = "".join(character if character.isalnum() or character == "-" else "-" for character in where)
    return f"{created}-{safe.strip('-').lower()}"


def unique_directory(root: Path, slug: str, report_id: str) -> Path:
    """Two reports on one activity in one day must not overwrite each other."""
    candidate = root / slug
    if not candidate.exists():
        return candidate
    return root / f"{slug}-{report_id[:8]}"


def write_report(root: Path, report: dict, token: str, endpoint: str) -> Path:
    directory = unique_directory(root, report_slug(report), report["id"])
    directory.mkdir(parents=True, exist_ok=True)

    markdown = report.get("markdown") or ""
    if not markdown:
        # A report should always carry its rendered text, but a row written by
        # an older client should still land somewhere readable.
        markdown = f"# {report.get('note') or 'Feedback'}\n\n{report.get('note', '')}\n"
    (directory / "report.md").write_text(markdown, encoding="utf-8")
    (directory / "report.json").write_text(
        json.dumps(json.loads(report["payload_json"]), indent=2) + "\n", encoding="utf-8"
    )

    # A missing screenshot is the ordinary case, not a failure to report.
    if report.get("screenshot_key"):
        try:
            image = request_bytes(f"{endpoint}/screenshot/{report['id']}", token)
            (directory / SCREENSHOT_NAME).write_bytes(image)
        except urllib.error.URLError as error:
            print(f"  ! screenshot for {report['id']} could not be fetched: {error}", file=sys.stderr)

    return directory


def write_index(root: Path) -> None:
    """One scannable list, newest first, of everything pulled so far."""
    entries = []
    for directory in sorted(root.iterdir(), reverse=True):
        report_file = directory / "report.md" if directory.is_dir() else None
        if not report_file or not report_file.exists():
            continue
        heading = report_file.read_text(encoding="utf-8").splitlines()[0].lstrip("# ").strip()
        entries.append(f"- [{heading or directory.name}]({directory.name}/report.md)")

    (root / "index.md").write_text(
        "# Feedback\n\nPulled from the app. Newest first.\n\n" + "\n".join(entries) + "\n",
        encoding="utf-8",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--endpoint", default=os.environ.get("FEEDBACK_ENDPOINT", ""),
                        help="Worker base URL (default: $FEEDBACK_ENDPOINT)")
    parser.add_argument("--token", default=os.environ.get("FEEDBACK_ADMIN_TOKEN", ""),
                        help="Admin bearer token (default: $FEEDBACK_ADMIN_TOKEN)")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                        help=f"Directory to write into (default: {DEFAULT_OUTPUT})")
    parser.add_argument("--since", default=None,
                        help="ISO timestamp to resume from, overriding the stored watermark")
    parser.add_argument("--all", action="store_true", help="Ignore the watermark and pull everything")
    arguments = parser.parse_args(argv)

    if not arguments.endpoint or not arguments.token:
        parser.error("set --endpoint/--token or FEEDBACK_ENDPOINT/FEEDBACK_ADMIN_TOKEN")

    endpoint = arguments.endpoint.rstrip("/")
    root: Path = arguments.output
    root.mkdir(parents=True, exist_ok=True)
    watermark_path = root / WATERMARK_FILE

    since = ""
    if not arguments.all:
        since = arguments.since or (
            watermark_path.read_text(encoding="utf-8").strip() if watermark_path.exists() else ""
        )

    try:
        payload = request_json(f"{endpoint}/reports?since={since}&limit=500", arguments.token)
    except urllib.error.HTTPError as error:
        print(f"endpoint returned {error.code}: {error.reason}", file=sys.stderr)
        return 1
    except urllib.error.URLError as error:
        print(f"could not reach {endpoint}: {error.reason}", file=sys.stderr)
        return 1

    reports = payload.get("reports", [])
    if not reports:
        print("No new reports.")
        return 0

    for report in reports:
        directory = write_report(root, report, arguments.token, endpoint)
        note = (report.get("note") or "").splitlines()[0] if report.get("note") else "(no note)"
        print(f"{directory}  {note}")

    watermark_path.write_text(reports[-1]["created_at"], encoding="utf-8")
    write_index(root)
    print(f"\n{len(reports)} report(s) written to {root}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
