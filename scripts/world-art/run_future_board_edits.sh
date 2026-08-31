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

for scene_id in \
  beacon-glass-gallery \
  menders-confluence \
  keepers-relay \
  mosslight-landing \
  open-trail-overlook; do
  print "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting $scene_id"
  python3 "$runner" \
    --scene-config "$config_root/$scene_id/scene-config.json" \
    --round 1 \
    generate \
    --execute \
    --budget-usd 4.00 \
    --min-request-interval 15 \
    --quota-backoff-seconds 75 \
    --max-quota-retries 2
  result=$?
  print "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Finished $scene_id (exit $result)"
done
