#!/usr/bin/env bash
set -euo pipefail

VERSION=${1:?usage: release-notes.sh <version>}
CHANGELOG=${CHANGELOG:-CHANGELOG.md}

NOTES=$(awk -v heading="## [${VERSION}]" '
  index($0, "## [") == 1 {
    if (found) exit
    if (index($0, heading) == 1) found = 1
    next
  }
  found { print }
' "$CHANGELOG" | sed -e '/./,$!d')

if [ -z "$NOTES" ]; then
  echo "no section for ${VERSION} in ${CHANGELOG}" >&2
  exit 1
fi

printf '%s\n' "$NOTES"
