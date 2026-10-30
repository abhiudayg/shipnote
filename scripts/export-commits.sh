#!/usr/bin/env bash
set -euo pipefail

OUT_DIR=${1:?usage: export-commits.sh <output-dir>}
DAYS=${DAYS:-30}
LOGIN=${LOGIN:?set LOGIN to the GitHub account to export}
AUTHOR=${AUTHOR:?set AUTHOR to the git author name or email to match}
SINCE=$(date -u -d "$DAYS days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-"${DAYS}"d +%Y-%m-%dT%H:%M:%SZ)
CLONE_SINCE=$(date -u -d "$((DAYS + 1)) days ago" +%Y-%m-%d 2>/dev/null || date -u -v-"$((DAYS + 1))"d +%Y-%m-%d)
UNTIL=$(date -u +%Y-%m-%dT%H:%M:%SZ)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

QUERY='query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner visibility }
      }
    }
  }
}'

gh api graphql -F login="$LOGIN" -F from="$SINCE" -F to="$UNTIL" -f query="$QUERY" \
  --jq '.data.user.contributionsCollection.commitContributionsByRepository[]
        | select(.repository.visibility == "PUBLIC")
        | .repository.nameWithOwner' |
while read -r repo; do
  clone="$WORK/${repo//\//__}"
  patch="$OUT_DIR/$repo.patch"
  mkdir -p "$(dirname "$patch")"

  git clone --quiet --no-checkout --shallow-since="$CLONE_SINCE" "https://github.com/$repo.git" "$clone"
  git -C "$clone" log \
    --since="$SINCE" \
    --author="$AUTHOR" \
    --reverse \
    --no-color \
    -p \
    --format='commit %H%nDate: %aI%nSubject: %s%n%n%b' \
    > "$patch"
done
