#!/usr/bin/env bash
set -euo pipefail

status=0
for tool in bun git jq shellcheck xmllint ruby node npm; do
  if command -v "$tool" > /dev/null; then
    echo "ok       $tool"
  else
    echo "missing  $tool"
    status=1
  fi
done

for tool in gh agent-brain agy; do
  if command -v "$tool" > /dev/null; then
    echo "ok       $tool (optional)"
  else
    echo "absent   $tool (optional; the features that need it are skipped or fall back)"
  fi
done

exit "$status"
