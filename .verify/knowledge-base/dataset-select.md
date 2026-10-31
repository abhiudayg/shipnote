# Dataset selection: knowledge base

## Decisions
- The dataset is an archive of exported `owner/repo.patch` files, one folder per date. The nightly job produces it; a user without a fork can produce the same layout with `scripts/export-commits.sh` and `shipnote import`.
- `select` never writes. It only ranks and counts skips, so running it is always safe.
- Ranking uses a log scale on change size, so a large commit does not dominate every day.

## Known traps
- `fetch` downloads from `SHIPNOTE_REPO`, which defaults to the author's repository. A fork must set its own value, or the download fails.
- `loadCommits` parses every `.patch` file. A single corrupt file fails the whole day, and the drafting run writes a dataset failure to `review.md`.
- Dates are in IST (`Asia/Kolkata`) for the default day. A run near midnight UTC can target the wrong day without `--date`.

## Where to look
- Ranking and skip rules: `cli/select.ts`. Parsing: `cli/patch.ts`. Archive copy: `cli/archive.ts`.
