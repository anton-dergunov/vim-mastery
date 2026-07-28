#!/usr/bin/env python3
"""Refresh only unsubmitted WP-04 variation prompts from prepared inventories."""

from __future__ import annotations

import json
from pathlib import Path

import review_wayfinder_patches as generator


ROOT = Path(__file__).resolve().parents[2]
CONFIG_ROOT = ROOT / "artifacts" / "world-generation" / "wp04-variant-inventories"


def main() -> int:
    for config_path in sorted(CONFIG_ROOT.glob("*.json")):
        config = json.loads(config_path.read_text())
        manifest_path = ROOT / "artifacts" / "world-generation" / "patch-reviews" / config["sceneId"] / "round-03" / "approval-manifest.json"
        if not manifest_path.is_file():
            continue
        manifest = json.loads(manifest_path.read_text())
        sites = {site["id"]: site for site in config["sites"]}
        refreshed = 0
        for candidate in manifest["candidates"]:
            if candidate.get("output"):
                continue
            site = sites[candidate["siteId"]]
            change = site["changes"][candidate["ordinal"] - 1]
            generator.configure_scene(config_path)
            candidate["transformation"] = change
            candidate["prompt"] = generator.candidate_prompt(site, change)
            refreshed += 1
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"{config['sceneId']}: refreshed {refreshed} pending prompt(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
