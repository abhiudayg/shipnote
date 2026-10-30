#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p .verify/artifacts

{
  shellcheck scripts/export-commits.sh
  xmllint --noout assets/logo.svg && echo "logo svg ok"
  bun -e 'const h = await Bun.file("website/index.html").text(); if (!h.includes("<title>") || !h.trimEnd().endsWith("</html>")) throw new Error("website/index.html is incomplete"); console.log("website html ok")'
  ruby -ryaml -e 'YAML.load_file(".github/workflows/nightly-dataset.yml"); puts "workflow yaml ok"'
  bun -e 'const c = await import("./shipnote.example.toml"); console.log("shipnote config ok:", c.default.agent.provider)'
} 2>&1 | tee .verify/artifacts/run.log
