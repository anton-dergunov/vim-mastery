#!/bin/zsh
# Resumable paid Nano Banana submission batch for the five approved Session 23 boards.
# Each underlying manifest is updated after every generated image. Re-running this
# script only submits candidates that still have no output.

set -u

# launchd supplies only the system PATH; retain the Homebrew Python and gcloud
# installation used by the established Vertex workflow.
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/python@3.14/bin:$PATH"

run_root=${0:A:h:h:h}
runner="$run_root/scripts/world-art/review_wayfinder_patches.py"
config_root="$run_root/artifacts/world-generation/future-board-media-runs"
python_bin="/opt/homebrew/opt/python@3.14/bin/python3"

remaining_candidates() {
  "$python_bin" - "$run_root" "$1" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
scene = sys.argv[2]
manifest = root / "artifacts/world-generation/patch-reviews" / scene / "round-01/approval-manifest.json"
data = json.loads(manifest.read_text())
print(sum(candidate.get("output") is None for candidate in data["candidates"]))
PY
}

scene_ids=(
  beacon-glass-gallery
  menders-confluence
  keepers-relay
  mosslight-landing
  open-trail-overlook
)

while true; do
  remaining_total=0
  for scene_id in $scene_ids; do
    before=$(remaining_candidates "$scene_id")
    if (( before == 0 )); then
      continue
    fi
    print "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting $scene_id with $before pending"
    "$python_bin" "$runner" \
      --scene-config "$config_root/$scene_id/scene-config.json" \
      --round 1 \
      generate \
      --execute \
      --budget-usd 4.00 \
      --min-request-interval 15 \
      --quota-backoff-seconds 75 \
      --max-quota-retries 2
    result=$?
    after=$(remaining_candidates "$scene_id")
    remaining_total=$((remaining_total + after))
    print "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Finished $scene_id (exit $result; $after pending)"
  done
  if (( remaining_total == 0 )); then
    print "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] All 250 Nano Banana candidates are saved."
    exit 0
  fi
  print "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $remaining_total candidates remain; retrying incomplete scenes after a 120s quota pause."
  sleep 120
done
