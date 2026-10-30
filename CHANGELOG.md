# Changelog

All notable changes to shipnote are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

Each release's notes are taken from its section below, so write entries for what shipped, not for plans.

## [Unreleased]

### Added

- `approve`, `mark-used`, and `status` commands. Approving a draft records its id and posts nothing. Marking commits used writes `ledger.json`.
- `shipnote.toml` support for the agent provider, model, command template, denylist, and budget limits.
- `review` command that shows each draft with its approval state, its length, and the commit evidence behind it.
- Budget checks before any agent call, with retries and a usage estimate logged in `review.md`.
- `media` command that renders the first clean diff excerpt as SVG cards at tweet and blog sizes. Each excerpt is checked against the commit diff, and excerpts matching secret patterns are refused.
- Theme mode for days with no commit above `min_story_score`. It writes one blog post and no tweets, from recent commits as examples.
- Voice samples read from a local `voice/` folder, within the context budget.
- `eval-add` and `eval` commands that run saved commit cases and report mode, parse, and validation rates.

### Changed

- Denylisted terms are now skipped during selection, alongside denylisted repositories.
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
