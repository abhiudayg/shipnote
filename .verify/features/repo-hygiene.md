# Repository hygiene and the verification harness

The repository keeps local and generated files out of git, and provides the harness that checks every feature. A contributor clones the repository and gets no secrets, local archives, drafts, or build output, and runs one command to check the change.

## Sub-features

- `ignore-local-files`: Keeps archives, drafts, the ledger, voice samples, eval results, and build output out of git.
  - Intent: personal writing, drafts, and dataset content stay on the machine that made them.
  - Behaviour: lists those paths in `.gitignore`.
  - Outcome: `git status` shows none of them after a run.
- `ignore-secrets-and-links`: Keeps environment files and the local Vercel link out of git.
  - Intent: credentials and machine-specific project links are never committed.
  - Behaviour: lists `.env*` and `.vercel` in `.gitignore`.
  - Outcome: `git status` does not show those files.
- `harness-entry`: Runs the phased verification harness.
  - Intent: one command gives evidence for a change.
  - Behaviour: `.verify/run.sh` runs doctor, unit, static, and functional phases, and writes logs to `.verify/artifacts/`.
  - Outcome: the run prints an evidence path, and exits non-zero if any phase fails.

## How to get to it (user POV)

- Repository: `.gitignore` at the root.
- CLI: `.verify/run.sh` runs every phase. `.verify/run.sh unit <feature>` runs one feature's unit suite.
- Files: `.verify/artifacts/<RUN_ID>/` holds the logs for each run.

## Verification Suites (Targeted Test Commands)

- **Unit Tests:** none. The harness is shell scripts.
- **Functional Test:** `.verify/run.sh functional`, which runs the CLI smoke test.
- **Static:** `.verify/run.sh static`, which runs shellcheck on the harness and scripts, the logo check, typecheck, the release-notes check, YAML checks, and the website build.
- **Allowlisted:** `.verify/run.sh` and `.verify/run.sh static`.

Steps:

1. Run `git status --short`. Expect no artifact, draft, archive, or secret file.
2. Run `.verify/run.sh`. Expect `evidence: .verify/artifacts/<RUN_ID>` at the end and exit code 0.

## Gotchas

- `.verify/artifacts/` is ignored by git, but `.verify/` itself is committed.
- The agstack helper scripts (`feature_coverage.sh`, `gate_report.sh`) are not copied into this repository, so the feature map is checked by hand.
- A new local file type needs a line in `.gitignore`, or it will show up in `git status`.

## Code

- `.gitignore`
- `.verify/`
