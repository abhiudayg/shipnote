#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
PHASE=${1:-all}
FEATURE=${2:-all}
RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
export RUN_ID
OUT=".verify/artifacts/$RUN_ID"
mkdir -p "$OUT"

feature_tests() {
  case "$1" in
    dataset-select) echo "cli/archive.test.ts cli/ledger.test.ts cli/select.test.ts" ;;
    drafting) echo "cli/draft.test.ts cli/output.test.ts cli/similarity.test.ts cli/platforms.test.ts cli/eval.test.ts cli/budget.test.ts cli/config.test.ts" ;;
    review-approval) echo "cli/approval.test.ts" ;;
    voice-memory) echo "cli/memory.test.ts cli/recall.test.ts" ;;
    media-cards) echo "cli/media.test.ts" ;;
    all) echo "cli" ;;
    *) echo "unknown feature: $1" >&2; exit 2 ;;
  esac
}

run_doctor() {
  if [ -x .verify/doctor.sh ]; then
    .verify/doctor.sh 2>&1 | tee "$OUT/doctor.log"
  else
    echo "doctor: skipped, .verify/doctor.sh not found" | tee "$OUT/doctor.log"
  fi
}

run_unit() {
  read -ra tests <<< "$(feature_tests "$FEATURE")"
  bun test "${tests[@]}" 2>&1 | tee "$OUT/unit.log"
}

run_static() {
  {
    shellcheck scripts/export-commits.sh scripts/release-notes.sh .verify/run.sh .verify/doctor.sh .verify/functional/cli-smoke.sh
    xmllint --noout assets/logo.svg && echo "logo svg ok"
    bun run typecheck
    scripts/release-notes.sh "$(jq -r .version package.json)" > /dev/null && echo "release notes ok"
    ruby -ryaml -e 'Dir[".github/workflows/*.yml"].each { |f| YAML.load_file(f) }; puts "workflow yaml ok"'
    bun -e 'const c = await import("./shipnote.example.toml"); console.log("shipnote config ok:", c.default.agent.provider)'
    (cd website && bun install --frozen-lockfile && bun run build)
  } 2>&1 | tee "$OUT/static.log"
}

run_functional() {
  if [ "$FEATURE" = all ] || [ "$FEATURE" = dataset-select ] || [ "$FEATURE" = drafting ] || [ "$FEATURE" = review-approval ]; then
    .verify/functional/cli-smoke.sh "$OUT" 2>&1 | tee "$OUT/functional.log"
  else
    echo "functional: no functional suite for $FEATURE" | tee "$OUT/functional.log"
  fi
}

case "$PHASE" in
  all)
    run_doctor
    run_unit
    run_static
    run_functional
    ;;
  doctor) run_doctor ;;
  unit) run_unit ;;
  static) run_static ;;
  functional) run_functional ;;
  *) echo "usage: run.sh [all|doctor|unit|static|functional] [feature|all]" >&2; exit 2 ;;
esac

echo "evidence: $OUT"
