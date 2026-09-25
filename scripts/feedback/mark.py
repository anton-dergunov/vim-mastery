#!/usr/bin/env python3
"""Mark an in-app feedback report processed.

Triage state lives on the server rather than in the local directory, so it
survives a re-clone and can be read from a phone through the D1 console. This
writes it and updates the local mirror in one step.

A report is addressed the way it actually appears during triage: by the
directory name that ``pull.py`` created, or by any unambiguous prefix
of its id. Nobody should have to retype a uuid.

Example:
    ./fetch-feedback.sh                      # pull, see what is open
    python3 scripts/feedback/mark.py 2026-09-07-yank-ready-field done \\
        "fixed the missing suggestion in a1b2c3d"
    python3 scripts/feedback/mark.py 94dd7fb1 wontfix "works as intended"
    python3 scripts/feedback/mark.py --list

Only the standard library is used.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pull as puller

STATUSES = ("new", "done", "wontfix")


def resolve_reference(root: Path, reference: str) -> str:
    """Turn a directory name into a report id, or pass a prefix straight through.

    The Worker resolves prefixes itself and refuses ambiguous ones, so an id
    fragment needs no local state at all — which keeps this working when
    ``feedback/`` has been deleted.
    """
    candidate = root / reference
    if candidate.is_dir():
        report_id = puller.read_meta(candidate).get("id")
        if report_id:
            return report_id
        raise SystemExit(f"{candidate}/{puller.META_NAME} has no id; re-run the pull first")
    return reference


def local_directory_for(root: Path, report_id: str) -> Path | None:
    if not root.is_dir():
        return None
    for directory in puller.report_directories(root):
        if puller.read_meta(directory).get("id") == report_id:
            return directory
    return None


def list_reports(root: Path) -> int:
    if not root.is_dir():
        print(f"{root}/ does not exist yet; run the pull first", file=sys.stderr)
        return 1
    directories = puller.report_directories(root)
    if not directories:
        print(f"No reports in {root}/")
        return 0

    for directory in directories:
        meta = puller.read_meta(directory)
        status = meta.get("status") or "new"
        marker = " " if status == "new" else "x"
        note = f"  ({meta['resolution']})" if meta.get("resolution") else ""
        print(f"[{marker}] {(meta.get('id') or '?')[:8]}  {status:<8}  {directory.name}{note}")

    outstanding = sum(1 for directory in directories if puller.is_open(directory))
    print(f"\n{outstanding} open of {len(directories)}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("reference", nargs="?",
                        help="report directory name, or any unambiguous prefix of its id")
    parser.add_argument("status", nargs="?", choices=STATUSES,
                        help="new reopens a report and clears its resolution")
    parser.add_argument("resolution", nargs="?", default=None,
                        help="a short note on what was done, kept with the report")
    parser.add_argument("--list", action="store_true", help="show every report and its status")
    parser.add_argument("--endpoint", default=os.environ.get("FEEDBACK_ENDPOINT", ""))
    parser.add_argument("--token", default=os.environ.get("FEEDBACK_ADMIN_TOKEN", ""))
    parser.add_argument("--output", type=Path, default=puller.DEFAULT_OUTPUT,
                        help=f"where reports were pulled (default: {puller.DEFAULT_OUTPUT})")
    arguments = parser.parse_args(argv)

    root: Path = arguments.output
    if arguments.list:
        return list_reports(root)
    if not arguments.reference or not arguments.status:
        parser.error("give a report and a status, or --list")
    if not arguments.endpoint or not arguments.token:
        parser.error("set --endpoint/--token or FEEDBACK_ENDPOINT/FEEDBACK_ADMIN_TOKEN")

    endpoint = arguments.endpoint.rstrip("/")
    reference = resolve_reference(root, arguments.reference)
    body = json.dumps({"status": arguments.status, "resolution": arguments.resolution}).encode()

    try:
        result = puller.request_json(
            f"{endpoint}/reports/{reference}/status", arguments.token, data=body
        )
    except urllib.error.HTTPError as error:
        puller.explain_http_error(error)
        return 1
    except urllib.error.URLError as error:
        print(f"could not reach {endpoint}: {error.reason}", file=sys.stderr)
        return 1

    # Keep the local mirror honest immediately, rather than leaving it stale
    # until the next pull.
    directory = local_directory_for(root, result["id"])
    if directory:
        puller.write_meta(directory, {**puller.read_meta(directory), **result})
        puller.write_index(root)

    note = f" — {result['resolution']}" if result.get("resolution") else ""
    print(f"{result['id'][:8]}  {result['status']}{note}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
