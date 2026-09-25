#!/usr/bin/env python3
"""Sync in-app feedback reports from the Cloudflare Worker into local files.

Each report becomes a directory holding the Markdown the reporter reviewed
before sending, the envelope the app sent, its triage state, and — when one was
attached — the screenshot it references. The layout is deliberately the same
shape as the hand-made ``feedback_example`` notes, so triage reads the same way
it always has.

The endpoint is write-only to the public; reading needs the admin token set
with ``wrangler secret put ADMIN_TOKEN``.

Example:
    export FEEDBACK_ENDPOINT=https://vim-wilds-feedback.example.workers.dev
    export FEEDBACK_ADMIN_TOKEN=...
    python3 scripts/feedback/pull.py

Mark a report processed with ``scripts/feedback/mark.py``.

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
META_NAME = "meta.json"

# urllib identifies itself as "Python-urllib/x.y", which Cloudflare's browser
# integrity check bans at the edge with a 403 and error code 1010 — before the
# request reaches the Worker, so it looks like an auth failure and is not one.
# Any honest, non-library user agent passes.
USER_AGENT = "vim-wilds-feedback-sync/1.0"


def headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT}


def request_json(url: str, token: str, data: bytes | None = None) -> dict:
    request_headers = headers(token)
    if data is not None:
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=request_headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def request_bytes(url: str, token: str) -> bytes:
    request = urllib.request.Request(url, headers=headers(token))
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def explain_http_error(error: urllib.error.HTTPError) -> None:
    """Say which side refused, because 401 and 403 here mean opposite things."""
    print(f"endpoint returned {error.code}: {error.reason}", file=sys.stderr)
    if error.code == 401:
        print("  FEEDBACK_ADMIN_TOKEN does not match the Worker's ADMIN_TOKEN secret.",
              file=sys.stderr)
        print("  Reset it with: wrangler secret put ADMIN_TOKEN", file=sys.stderr)
    elif error.code == 403:
        # The Worker never answers 403 on these routes, so this is Cloudflare's
        # edge rejecting the request before the Worker ever runs.
        print("  Blocked by Cloudflare before reaching the Worker, not an auth failure.",
              file=sys.stderr)
        print("  Reports are still safe. Read them directly with:", file=sys.stderr)
        print("    cd worker && wrangler d1 execute vim-wilds-feedback --remote \\",
              file=sys.stderr)
        print('      --command "SELECT created_at, activity_id, note FROM reports;"',
              file=sys.stderr)
    else:
        detail = error.read().decode("utf-8", "replace").strip()
        if detail:
            print(f"  {detail}", file=sys.stderr)


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


def write_meta(directory: Path, report: dict) -> None:
    """Server-side facts about a report: its id and how triage left it.

    Kept in its own file so ``report.md`` stays exactly what the reporter wrote
    and ``report.json`` stays exactly the envelope the app sent. The id lives
    here because it is what ``mark.py`` needs to address a report.
    """
    (directory / META_NAME).write_text(
        json.dumps({
            "id": report["id"],
            "created_at": report.get("created_at"),
            "status": report.get("status") or "new",
            "resolution": report.get("resolution"),
            "resolved_at": report.get("resolved_at"),
        }, indent=2) + "\n",
        encoding="utf-8",
    )


def read_meta(directory: Path) -> dict:
    try:
        return json.loads((directory / META_NAME).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def is_open(directory: Path) -> bool:
    return (read_meta(directory).get("status") or "new") == "new"


def report_directories(root: Path) -> list[Path]:
    return sorted(
        (path for path in root.iterdir() if path.is_dir() and (path / "report.md").exists()),
        reverse=True,
    )


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
    write_meta(directory, report)

    # A missing screenshot is the ordinary case, not a failure to report.
    if report.get("screenshot_key"):
        try:
            image = request_bytes(f"{endpoint}/screenshot/{report['id']}", token)
            (directory / SCREENSHOT_NAME).write_bytes(image)
        except urllib.error.URLError as error:
            print(f"  ! screenshot for {report['id']} could not be fetched: {error}",
                  file=sys.stderr)

    return directory


def refresh_meta(root: Path, reports: list[dict]) -> None:
    """Apply triage state pulled from the server to reports already on disk."""
    by_id = {report["id"]: report for report in reports}
    for directory in report_directories(root):
        report = by_id.get(read_meta(directory).get("id"))
        if report:
            write_meta(directory, report)


def write_index(root: Path) -> None:
    """Open reports first, because those are the ones still asking for work."""
    open_entries: list[str] = []
    closed_entries: list[str] = []

    for directory in report_directories(root):
        heading = (directory / "report.md").read_text(encoding="utf-8").splitlines()[0]
        heading = heading.lstrip("# ").strip() or directory.name
        entry = f"- [{heading}]({directory.name}/report.md)"
        if is_open(directory):
            open_entries.append(entry)
        else:
            meta = read_meta(directory)
            note = f" — {meta['resolution']}" if meta.get("resolution") else ""
            closed_entries.append(f"{entry} `{meta.get('status')}`{note}")

    sections = [
        "# Feedback",
        "",
        "Pulled from the app. Newest first.",
        "",
        f"## Open ({len(open_entries)})",
        "",
        "\n".join(open_entries) if open_entries else "_Nothing outstanding._",
    ]
    if closed_entries:
        sections += ["", f"## Resolved ({len(closed_entries)})", "", "\n".join(closed_entries)]

    (root / "index.md").write_text("\n".join(sections) + "\n", encoding="utf-8")


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
    parser.add_argument("--all", action="store_true",
                        help="Ignore the watermark and pull everything")
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

    def fetch(query: str) -> dict | None:
        try:
            return request_json(f"{endpoint}/reports?{query}", arguments.token)
        except urllib.error.HTTPError as error:
            explain_http_error(error)
        except urllib.error.URLError as error:
            print(f"could not reach {endpoint}: {error.reason}", file=sys.stderr)
        return None

    payload = fetch(f"since={since}&limit=500")
    if payload is None:
        return 1

    reports = payload.get("reports", [])
    for report in reports:
        directory = write_report(root, report, arguments.token, endpoint)
        note = (report.get("note") or "").splitlines()[0] if report.get("note") else "(no note)"
        print(f"{directory}  {note}")
    if reports:
        watermark_path.write_text(reports[-1]["created_at"], encoding="utf-8")

    # Triage state changes after a report has been pulled, so the local mirror
    # is refreshed from a listing of everything rather than only the new rows.
    # The summary view omits the report bodies, so this stays cheap.
    summary = fetch("since=&limit=500&fields=summary")
    if summary is not None:
        refresh_meta(root, summary.get("reports", []))
    write_index(root)

    outstanding = sum(1 for directory in report_directories(root) if is_open(directory))
    print(f"\n{len(reports)} new report(s); {outstanding} open in {root}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
