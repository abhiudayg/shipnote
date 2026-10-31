# Changelog

All notable changes to shipnote are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

Each release's notes are taken from its section below, so write entries for what shipped, not for plans.

## [Unreleased]

### Added

- `remember "<text>"` command that stores one voice fact in agent-brain. Optional `--tag` (default `voice_tag`) and `--source` (default `manual`). Text that matches a secret pattern is refused.
- `import-voice [dir]` command that stores each paragraph of a folder of Markdown files (default `voice/`) in agent-brain under the voice tag. Re-importing the same folder stores nothing new.
- `approve`, `mark-used`, and `status` commands. Approving a draft records its id and posts nothing. Marking commits used writes `ledger.json`.
- `shipnote.toml` support for the agent provider, model, command template, denylist, and budget limits.
- `review` command that shows each draft with its approval state, its length, and the commit evidence behind it.
- Budget checks before any agent call, with retries and a usage estimate logged in `review.md`.
- `media` command that renders the first clean diff excerpt as SVG cards at tweet and blog sizes. Each excerpt is checked against the commit diff, and excerpts matching secret patterns are refused.
- Theme mode for days with no commit above `min_story_score`. It writes one blog post and no tweets, from recent commits as examples.
- Voice samples read from a local `voice/` folder, within the context budget.
- Voice facts read from agent-brain with `agent-brain recall --json`, filtered by the `voice_tag` setting. If agent-brain is unavailable, drafting continues and `review.md` records the error.
- `eval-add` and `eval` commands that run saved commit cases and report mode, parse, SHA validity, and validation rates. Eval results record the prompt and config hashes.
- `stats` command that reports the approval rate across all draft days.
- `review --decide` for one-keystroke review: approve, reject, edit, skip, or quit each draft. It needs an interactive terminal.
- Each drafting run writes `meta.json` with the prompt hash, config hash, rubric, time, estimated tokens and cost, and cost per kept item.
- `linkedin.md` is written with each successful run, from the blog summary or the first tweet, with links to the cited commits.
- `budget.timeout_seconds` (default 300) stops an agent call that does not finish in time. Timeouts are retried within `max_retries`.

### Changed

- Denylisted terms are now skipped during selection, alongside denylisted repositories.
- Commit text and voice samples can no longer close their own `<commit>` or `<voice>` block in the prompt.
- A draft that names a file, backticked identifier, or number absent from the commits it cites is rejected.
- A draft that repeats an approved post from the last 30 days is rejected.
- A run that fails writes `review.md` with the reason and writes no drafts. Earlier drafts and approvals are kept.
- Vercel builds the website from the repository root through `vercel.json`.

## [0.1.0] - 2026-10-30

### Added

- Nightly GitHub Action that exports public commits and full diffs from the last 30 days, discovered from GitHub contribution data.
- The export is scanned with gitleaks, pinned to v8.18.4, before upload. The artifact expires after 10 days.
- `fetch` command that downloads and archives the latest successful nightly dataset.
- `import` command that archives `owner/repo.patch` files from any producer, so the Action is not required.
- `select` command that ranks commits, skipping merges, lockfile-only changes, used commits, and denylisted repositories.
- `draft` command that writes tweets and a blog post with an agent CLI. Every commit SHA, tweet length, and blog length is checked, and failures are logged in `review.md`.
- Website for the project, with setup, CLI, privacy, roadmap, and changelog pages.
