#!/usr/bin/env bash
set -euo pipefail

OUT=$1
ROOT=$(pwd)
WORK="$ROOT/$OUT/functional"
CLI="$ROOT/cli/shipnote.ts"
SHA=1111111111111111111111111111111111111111

rm -rf "$WORK"
mkdir -p "$WORK/home" "$WORK/archive/2026-10-31/abhiudayg"
cp cli/fixtures/sample.patch "$WORK/archive/2026-10-31/abhiudayg/dustmap.patch"

cat > "$WORK/fake-agent.ts" <<EOF
const body = Array.from({ length: 650 }, () => "word").join(" ");
const text = process.env.FAKE_AGENT === "hostile" ? "\`makeTea()\` now runs first." : "Retries now run three times.";
console.log(JSON.stringify({ tweets: [{ text, shas: ["$SHA"] }], blog: { title: "Retry", summary: "Retries now back off.", body, shas: ["$SHA"] } }));
EOF

cat > "$WORK/shipnote.toml" <<EOF
[agent]
provider = "fake"

[agent.providers.fake]
command = "bun"
args = ["$WORK/fake-agent.ts"]
prompt_mode = "stdin"
model = "fake-model"
effort = "low"

[selection]
min_story_score = 0

[budget]
timeout_seconds = 30
max_retries = 0
EOF

cd "$WORK"
export HOME="$WORK/home"

check() {
  echo "check: $1"
}

check "select ranks the fixture archive"
bun "$CLI" select --date 2026-10-31 | grep -q "3 commits" || { echo "select did not rank 3 commits"; exit 1; }

check "draft writes story drafts for a fake agent"
bun "$CLI" draft --date 2026-10-31
test -f drafts/2026-10-31/tweets.md
test -f drafts/2026-10-31/blog.md
test -f drafts/2026-10-31/meta.json
grep -q '"kept": 2' drafts/2026-10-31/meta.json || { echo "meta.json does not record 2 kept items"; exit 1; }

check "approve records the draft id"
bun "$CLI" approve tweet-1 --date 2026-10-31 | grep -q "Nothing was posted"
grep -q "tweet-1" drafts/2026-10-31/approved.json

check "a rerun that rejects the new tweet keeps approvals"
FAKE_AGENT=hostile bun "$CLI" draft --date 2026-10-31
grep -q "tweet-1" drafts/2026-10-31/approved.json
test -f drafts/2026-10-31/tweets.md

check "review --decide refuses without a terminal"
if bun "$CLI" review --decide --date 2026-10-31 < /dev/null > review-decide.out 2>&1; then
  echo "review --decide should fail without a terminal"
  exit 1
fi
grep -q "interactive terminal" review-decide.out

check "stats reports the approval rate"
bun "$CLI" stats | grep -q "approval rate"

echo "functional smoke passed"
