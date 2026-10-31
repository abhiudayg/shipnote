# Dataset selection

shipnote reads a dated archive of exported commits, skips commits that should not be written about, and ranks the rest by how much changed and how specific the message is. A consumer runs `select` and sees the ranked commits, with the skipped commits counted by reason.

## Sub-features

- `archive-import`: Copies exported `owner/repo.patch` files into `archive/<date>/`.
  - Intent: let a user without a fork supply their own commits.
  - Behaviour: copies each patch file, and skips a date that is already archived.
  - Outcome: the archive directory holds the patches for `select`.
- `skip-rules`: Drops merges, lockfile-only changes, used commits, and denylisted repositories.
  - Intent: keep posts about work that is new and worth a post.
  - Behaviour: applies each rule in order and records the first reason that matches.
  - Outcome: skipped commits are counted by reason in the `select` output.
- `ranking`: Scores each remaining commit on change size, new files, and message quality.
  - Intent: put the most substantial work first.
  - Behaviour: scores on a log scale and sorts descending.
  - Outcome: the top commit has the highest score and appears first.

## How to get to it (user POV)

- CLI: `shipnote fetch --date 2026-10-31` downloads the nightly dataset, and needs `SHIPNOTE_REPO` and gh.
- CLI: `shipnote import ./export --date 2026-10-31` imports patches from a local folder.
- CLI: `shipnote select --date 2026-10-31` prints the ranked commits.

## Verification Suites (Targeted Test Commands)

- **Unit Tests:** `.verify/run.sh unit dataset-select`, which runs `bun test cli/archive.test.ts cli/ledger.test.ts cli/select.test.ts`.
- **Functional Test:** `.verify/run.sh functional`, which runs `.verify/functional/cli-smoke.sh` and checks that `select` ranks the three commits of the fixture archive.
- **Allowlisted:** `.verify/run.sh unit dataset-select` and `.verify/run.sh functional`.
- **Preconditions:** none for the unit tests. The functional step copies `cli/fixtures/sample.patch`.

Steps:

1. Run `.verify/run.sh unit dataset-select`. Expect all tests to pass.
2. Run `.verify/run.sh functional`. Expect `select did not rank 3 commits` to be absent, and `functional smoke passed` at the end.

## Gotchas

- `fetch` needs a repository that runs the nightly export workflow, and gh signed in. Neither is exercised by the harness.
- The export script `scripts/export-commits.sh` is checked by shellcheck only. Its live GitHub calls are not tested.
- The fixture archive has three commits. A larger archive is not covered by the harness.
