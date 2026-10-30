#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p .verify/artifacts

{
  shellcheck scripts/export-commits.sh
  ruby -ryaml -e 'YAML.load_file(".github/workflows/nightly-dataset.yml"); puts "workflow yaml ok"'
  bun -e 'const c = await import("./shipnote.example.toml"); console.log("shipnote config ok:", c.default.agent.provider)'
} 2>&1 | tee .verify/artifacts/run.log
