# Changelog

All notable changes to shipnote are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

Each release's notes are taken from its section below, so write entries for what shipped, not for plans.

## [Unreleased]

### Changed

- Drafts name the specific file, command, flag, number, or behavior from the diff, and avoid vague verbs such as "ensure" and "streamline."

## [0.3.1] - 2026-10-31

### Added

- `shipnote import-docs <dir>` imports a folder of markdown files as drafting sources, so a day with no commits can still produce posts. Documents get no GitHub link.
- `shipnote update` installs the latest version from npm. `shipnote update --check` only reports whether a newer version exists.

### Changed

- Each tweet opens with a hook in its first sentence: a result, a number from the diff, or a question.
- The CI, release, and nightly workflows use the current major versions of `actions/checkout`, `actions/upload-artifact`, and `actions/setup-node`, which run on Node 24. The nightly secret scan redacts and prints each finding in the job log.
- A theme-mode blog is not drafted when its sources hold fewer than 600 words. The run writes `review.md` and makes no agent call, so a thin set of documents is not padded.

## [0.3.0] - 2026-10-31

### Added

- Docker-style help. `shipnote --help` lists the commands with summaries, `shipnote COMMAND --help` shows a command's usage and options, and `shipnote --version` prints the version.
- `-v` or `--verbose` on every command writes step-by-step details to stderr. Stdout is unchanged.
- A spinner with elapsed seconds for steps that take more than a second: reading the archive, the agent call, each eval case, dataset downloads, and voice imports. Quick commands print nothing.
- `draft` prints the tweets when it finishes, with each commit link under "Reply with."
- Negative controls: invented claims that reuse commit words, checked by tests. Four are rejected, and one known miss is recorded.
- Ten eval cases for drafting quality, eight story and two theme, with notes written from each commit's diff and agent-brain context.
- A `LICENSE` file with the MIT license.

### Changed

- Tweets are shown without their commit links, which go under "Reply with," since links in the main post reduce reach.
- A tweet is dropped when more than 40% of its content words are absent from the commits it cites.
- Duplicate helpers and a redundant corpus pass were removed from the CLI. The command output is unchanged.

### Fixed

- A stalled agent is ended as a process group at its timeout, and on Ctrl-C. Before, killing only the direct child could leave the CLI running past its timeout, with the agent's child still alive.

## [0.2.1] - 2026-10-31

### Changed

- The release workflow publishes each version to npm as well as GitHub Packages.

## [0.2.0] - 2026-10-31

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
- Published as `@abhiudayg/shipnote` 0.1.0 on GitHub Packages. Installing needs a token with `read:packages`, and the README shows the `.npmrc` setup. The release workflow publishes each version tag.
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

### Fixed

- The README logo uses an absolute URL, so it shows on the GitHub Packages and npm pages.

## [0.1.0] - 2026-10-30

### Added

- Nightly GitHub Action that exports public commits and full diffs from the last 30 days, discovered from GitHub contribution data.
- The export is scanned with gitleaks, pinned to v8.18.4, before upload. The artifact expires after 10 days.
- `fetch` command that downloads and archives the latest successful nightly dataset.
- `import` command that archives `owner/repo.patch` files from any producer, so the Action is not required.
- `select` command that ranks commits, skipping merges, lockfile-only changes, used commits, and denylisted repositories.
- `draft` command that writes tweets and a blog post with an agent CLI. Every commit SHA, tweet length, and blog length is checked, and failures are logged in `review.md`.
- Website for the project, with setup, CLI, privacy, roadmap, and changelog pages.
