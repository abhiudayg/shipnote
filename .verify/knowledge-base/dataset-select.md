# Dataset selection: knowledge base

## Decisions
- The dataset is an archive of exported `owner/repo.patch` files, one folder per date. The nightly job produces it; a user without a fork can produce the same layout with `scripts/export-commits.sh` and `shipnote import`.
- `select` never writes. It only ranks and counts skips, so running it is always safe.
- Ranking scores four signals: architecture paths, a piecewise effort curve on cleaned lines (30 to 600 is the sweet spot, above 2,500 is 0.35), narrative (multi-line body, concrete verbs, a one-word subject), and cross-module scope. Weights are 0.35, 0.25, 0.20, 0.20. Size is no longer a log scale on total lines.
- Generated, vendored, lock, and binary files are stripped per file before counting (`NOISE_PATHS` in `cli/select.ts`). A commit left with no source file or no source line is skipped.
- Drafting applies a per-repo decay of 0.55 for each earlier pick from the same repo (`decayByRepo`). A repo's first pick keeps its score, the second is multiplied by 0.55, the third by 0.30.

## Known traps
- `fetch` downloads from `SHIPNOTE_REPO`, which defaults to the author's repository. A fork must set its own value, or the download fails.
- `loadCommits` parses every `.patch` file. A single corrupt file fails the whole day, and the drafting run writes a dataset failure to `review.md`.
- Dates are in IST (`Asia/Kolkata`) for the default day. A run near midnight UTC can target the wrong day without `--date`.

## Where to look
- Ranking and skip rules: `cli/select.ts`. Parsing: `cli/patch.ts`. Archive copy: `cli/archive.ts`.
- Topics group commits by repository and the most common folder among their files, two levels deep (`topicKey` in `cli/select.ts`). Drafting keeps one commit per topic, so a large commit set reaches the model as topics, not commits.
- A topic that an approved post covered in the last 30 days is skipped by drafting (`recentTopics` in `cli/shipnote.ts`).
