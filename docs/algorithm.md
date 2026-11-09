# Selection algorithm

How shipnote chooses which commits to draft from. This describes the code as it stands after Phase 1 of the selection spec. Background and sources are in [context.md](context.md).

## 1. Capture

The nightly workflow (`.github/workflows/nightly-dataset.yml`) runs `scripts/export-commits.sh`. It produces one `owner/repo.patch` file per repository:

- Repositories come from GitHub's contributions API for `LOGIN`, and only `PUBLIC` repositories are kept. Private repositories are never captured.
- Commits are kept only when their git author matches `AUTHOR` (`vars.DATASET_AUTHOR`).
- Each repository's default branch is read. Feature branches that never merged are not read.
- The window is 30 days (`DAYS`). `shipnote fetch` downloads the latest successful run, not a per-day export.
- The CI job runs gitleaks on the dataset before upload.

## 2. Skip rules

Applied in this order. The first reason that matches is recorded and the commit is dropped:

1. `already used`: the sha is in the used ledger.
2. `denylisted repo`, then `denylisted term`: from `[selection]` in `shipnote.toml`.
3. `merge commit`: the subject starts with `Merge `.
4. `no file changes`: the commit lists no files.
5. `lockfile only`: every file is a lock file (`bun.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `go.sum`, `Cargo.lock`).
6. `only generated or vendored files`: after stripping the noise paths below, no file is left.
7. `no substantive changes`: after stripping, no line is left.

Noise paths, matched per file with `Bun.Glob`: `*-lock.*`, `*.lock`, `go.sum`, `vendor/`, `node_modules/`, `*.pb.go`, `*.generated.*`, `*.min.*`, `dist/`, `build/`, `__snapshots__/`, `*.png`, `*.jpg`, `*.woff2`, `*.map`. Their lines are subtracted from the commit's added and removed counts.

## 3. Score

Each surviving commit gets a score in `[0, 1]`, rounded to three places:

```
score = 0.35 × arch + 0.25 × effort + 0.20 × narrative + 0.20 × scope
```

Inputs use cleaned lines `L` (added + removed, minus noise) and cleaned files.

- **effort**, from `L`:
  - `L < 10`: 0.2
  - `10 ≤ L < 30`: linear from 0.2 up to 0.8
  - `30 ≤ L ≤ 600`: 1.0
  - `600 < L ≤ 2500`: linear from 1.0 down to 0.5
  - `L > 2500`: 0.35
- **arch**: 1.0 if any file is under `migrations/`, `api/`, `routes/`, `auth/`, `engine/`, `core/`, or `.github/workflows/`. 0.2 if every file is a doc (`.md`, `.mdx`, `.txt`, `docs/`) or a test. 0.6 otherwise.
- **narrative**: starts at 0.2. Adds 0.5 if the body has more than one prose line. Git trailers (`Signed-off-by`, `Co-authored-by`, `Reviewed-by`, `Change-Id`, `Acked-by`) and blank lines do not count. Adds 0.3 if the subject or body contains `migrate`, `race`, `latency`, `cache`, `parser`, or `security`. Subtracts 0.4 if the subject is one word. Clamped to `[0, 1]`.
- **scope**: the number of distinct top-level folders, capped at 4, divided by 4. Adds 0.15 when production and test files change together. Capped at 1.

## 4. Draft candidates

`draft` (`rankCandidates` in `cli/draft.ts`) turns the scored list into candidates:

1. Keep the highest-scoring commit per topic. A topic is the repository plus the most common folder among the commit's files, two levels deep (`topicKey`).
2. Drop topics that an approved draft covered in the last 7 days (`recentTopics` in `cli/shipnote.ts`, `TOPIC_COOLDOWN_DAYS`). The repeat check keeps its own 30-day window.
3. Reorder with a per-repository decay (`decayByRepo`). Each commit's weight is its score times `0.55` raised to the number of earlier picks from its repository. Repeat until the list is empty, always taking the highest weight.

## 5. Mode and count

- Mode is `story` when at least 2 candidates have a score of at least `min_story_score` (default `0.6`). Otherwise it is `theme`. `chooseMode` in `cli/draft.ts` applies this to the candidates after the topic filter.
- Story mode drafts the qualifying candidates, up to `--top` (default 12). Theme mode drafts a fixed number of examples.
- Eval cases are different: each case is one story, so `caseMode` in `cli/eval.ts` marks a case as story when its top commit clears the threshold.

Before the prompt cuts a commit's diff to 2,500 characters, its per-file sections are sorted by file arch weight, then by changed lines (`prioritizedDiff` in `cli/draft.ts`). The core file that earned the arch weight is kept in the prompt.

## Known limits

- Commits above 2,500 lines drop to effort 0.35, which is a steep step from 0.5 at 2,500. Large commits that touch core paths still rank high, as in the 21,514-line commit in the 2026-11-01 archive.
- Each commit is scored alone. Commits that belong to one piece of work are not grouped. Phase 2 of the spec covers PR, branch, and session grouping.
- Whitespace-only commits are not dropped. That needs an `--ignore-all-space` diff, which the export does not produce.
- Pure renames get no discount. Git reports them with zero changed lines, so they already score low on effort.
- There is no niche match against a list of pillars. That is part of the spec's later phases.
- The weights and the 2,500 cutoff are code constants, not `shipnote.toml` keys.
