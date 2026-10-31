<p align="center">
  <img src="https://raw.githubusercontent.com/abhiudayg/shipnote/master/assets/logo.svg" width="128" alt="shipnote logo">
</p>

<h1 align="center">shipnote</h1>

<p align="center">
  Turn the work you ship into posts you approve.
</p>

<p align="center">
  <a href="https://shipnote.abhiudayg.dev">Website</a> ·
  <a href="https://shipnote.abhiudayg.dev/setup/">Setup</a> ·
  <a href="https://shipnote.abhiudayg.dev/roadmap/">Roadmap</a>
</p>

---

shipnote reads your public commits, drafts tweets, a LinkedIn post, and a blog post from them, and leaves every draft for you to approve. Each claim in a draft cites the commit it came from, and a draft that names something missing from those commits is dropped. Nothing publishes on its own.

It runs in two parts:

1. **A nightly GitHub Action** exports your public commits and full diffs as an artifact. It runs on your own GitHub account.
2. **A local CLI** downloads or imports that export, selects the commits worth writing about, drafts posts with the agent CLI you configure, and records your approvals.

## Status

| Part | State |
|---|---|
| Nightly dataset Action | Working. Builds a 30-day dataset, scans it for secrets, and uploads it as an artifact that expires after 10 days. |
| `fetch`, `import`, `select` | Working. Download or import commits, skip merges, lockfile-only changes, used commits, and denylisted repos, and rank the rest. |
| `draft` | Working. Writes tweets, a LinkedIn post, and a blog post with checks on every claim. Tested with a fake agent. Draft quality on a real model is not measured yet. |
| `review`, `approve`, `mark-used`, `stats` | Working. One-key review with `review --decide`. Approvals never post anything. |
| Voice memory | Working with agent-brain 1.0.0-rc6. `remember` and `import-voice` store voice facts. |
| Evaluation set | Two cases so far. The goal is 10 to 20 past commit clusters. |
| Website | Live on Vercel. Custom domain not connected yet. |

## Install

The package installs a `shipnote` command. It runs under [Bun](https://bun.sh), so install Bun first.

```bash
npm install -g @abhiudayg/shipnote
```

This installs from npm and needs no token.

The same versions are also on GitHub Packages. To install from there instead, create a classic GitHub token with the `read:packages` scope at https://github.com/settings/tokens, then add these two lines to `~/.npmrc`. They route the `@abhiudayg` scope to GitHub Packages, so the same `npm install -g` command installs from there:

```
@abhiudayg:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

Run the commands from a folder of your own. Archives, drafts, the ledger, and `shipnote.toml` are written there, not in the package.

### From a clone

You need [Bun](https://bun.sh), [git](https://git-scm.com), and the [GitHub CLI](https://cli.github.com) signed in with `gh auth login`.

```bash
bun install
bun cli/shipnote.ts fetch          # download and archive the latest dataset
bun cli/shipnote.ts select         # rank the commits worth a post
bun cli/shipnote.ts draft          # draft posts for the top commits
bun cli/shipnote.ts review         # read the drafts beside their evidence
```

Example output of `select`:

```
2026-10-30: 450 commits, 447 selected, 3 skipped

 1. 1.000  bc533d5  autonomic-ai-dev/agent-brain  refactor: debloat serve binary, honest metrics, Docker-style CLI help (#54)
 2. 0.976  9440c82  autonomic-ai-dev/website      feat: centralize organ documentation, update blogs, and enforce high-contrast typography (#6)
...

skipped:
  2 merge commit
  1 no file changes
```

### Without a fork

`fetch` downloads the nightly dataset from a repository that runs the export workflow. Without a fork, export your own commits with your GitHub login, then import them:

```bash
LOGIN=your-github-login AUTHOR="you@example.com" "$(npm root -g)/@abhiudayg/shipnote/scripts/export-commits.sh" ./export
shipnote import ./export
shipnote select
```

## CLI reference

```
shipnote fetch        [--date YYYY-MM-DD] [--run ID]
shipnote import       <dir> [--date YYYY-MM-DD]
shipnote select       [--date YYYY-MM-DD]
shipnote draft        [--date YYYY-MM-DD] [--top N]
shipnote review       [--date YYYY-MM-DD] [--decide]
shipnote approve      <draft-id> [--date YYYY-MM-DD]
shipnote mark-used    <sha> [<sha> ...]
shipnote status       [--date YYYY-MM-DD]
shipnote stats
shipnote media        [--date YYYY-MM-DD]
shipnote remember     "<text>" [--tag TAG] [--source SOURCE]
shipnote import-voice [dir]
shipnote eval-add     <name> --date YYYY-MM-DD --sha SHA[,SHA] --expect story|theme --notes TEXT
shipnote eval         [--dry-run]
```

- `fetch` downloads the newest successful `nightly-dataset` run, or the run given by `--run`, into `archive/<date>/`. If that date is already archived, it does nothing.
- `select` ranks the commits for a date. The ranking combines the size of the change (log scale), the number of new files, and whether the commit message is specific. Commits in `ledger.json` are skipped.
- `draft` writes the drafts for a date into `drafts/<date>/`. See [Drafting](#drafting).
- `review` shows each draft with its approval state and its evidence. `--decide` steps through the drafts one key at a time: `a` approves, `r` rejects, `e` opens the draft in `$EDITOR`, `s` skips, and `q` quits. It needs an interactive terminal.
- `approve` marks one draft as approved. It posts nothing.
- `mark-used` adds full commit SHAs to `ledger.json`, so `select` skips them later.
- `stats` reports the approval rate across every draft day.
- `media` renders the first clean diff excerpt from the top commits as SVG cards. It refuses any excerpt that does not match its diff.
- `remember` and `import-voice` store voice facts in agent-brain. See [Voice memory](#voice-memory).
- `eval-add` saves a commit case, and `eval` runs every saved case through the agent and reports mode match, parse, SHA validity, and validation rates.

Environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `SHIPNOTE_REPO` | `abhiudayg/shipnote` | The repo whose Action artifacts `fetch` downloads. Set this to your fork. |
| `SHIPNOTE_DENYLIST` | empty | Comma-separated repos to exclude, for example `you/private-client`. |
| `SHIPNOTE_MODEL` | from `shipnote.toml` | Overrides the model for one run. |
| `SHIPNOTE_EFFORT` | from `shipnote.toml` | Overrides the effort setting for one run. |

## Drafting

`draft` selects the top commits for a date and decides the mode. If the top commit clears `min_story_score`, it writes tweets and a blog post about the most significant change (story mode). Otherwise it writes one blog post about the theme the commits share, and no tweets (theme mode).

The prompt wraps every commit and every voice sample in its own block and tells the model that the text inside is data. Text that tries to close a block is escaped. The model must return JSON, and each tweet and the blog must list the full SHA of every commit it describes.

Each draft is then checked:

- Every cited SHA must exist in the dataset.
- Tweets fit 280 characters, and the blog is 600 to 1,200 words.
- Every backticked identifier, file name, and number of two or more digits must appear in the cited commits.
- A draft that repeats an approved post from the last 30 days is dropped.
- Secret-shaped text is refused.

If no draft passes, the run writes `review.md` with the reason and writes no drafts. A failed run never deletes earlier drafts or approvals.

Each run writes these files into `drafts/<date>/`:

| File | Contents |
|---|---|
| `tweets.md` | Tweets with their source commits. |
| `blog.md` | The blog post with front matter. |
| `linkedin.md` | A LinkedIn post built from the blog summary or the first tweet, with links to the cited commits. |
| `sources.json` | The evidence behind each draft item. |
| `review.md` | The model, prompt and config hashes, time, usage estimate, kept items, and every rejection. |
| `meta.json` | The same run data as JSON, with rubric settings and cost per kept item. |
| `approved.json` | The approved draft ids. Written by `approve` and `review --decide`. |

## Voice memory

shipnote reads voice facts from agent-brain and includes them, with the `voice/` folder, as style samples in the drafting prompt. The samples show style only, and the prompt says they are not facts.

- `shipnote remember "I write short sentences about what shipped."` stores one fact. The tag defaults to `voice_tag`, and the source defaults to `manual`.
- `shipnote import-voice` stores each paragraph of `voice/`, or another folder you name. Re-importing the same folder stores nothing new.

These commands need the agent-brain CLI, version 1.0.0-rc6 or later. If agent-brain is missing, drafting continues without voice facts, and `review.md` says so.

## Configuration

Copy `shipnote.example.toml` to `shipnote.toml` in the folder you run from. The file is read on every run.

| Section | Keys |
|---|---|
| `[agent]` | `provider` picks one of the entries in `[agent.providers]`. Each provider has a `command`, `args` (with `{prompt}`, `{model}`, and `{effort}` placeholders), `prompt_mode` (`arg` or `stdin`), `model`, `effort`, and `usd_per_million_tokens` for cost estimates. |
| `[selection]` | `denylist_repos`, `denylist_terms`, and `min_story_score`. |
| `[context]` | `token_budget` limits the voice context. `voice_tag` picks the agent-brain tag for voice facts. |
| `[budget]` | `max_tokens_per_run`, `max_cost_usd_per_run`, `max_retries`, and `timeout_seconds` for each agent call. |

Drafts go to whichever agent CLI you configure. The default provider is `agy`.

## Nightly dataset (GitHub Action)

The workflow is in `.github/workflows/nightly-dataset.yml`. It runs at 18:30 UTC, which is 00:00 IST, and can also be triggered by hand with a `days` input (default 30).

Each run:

1. Finds every public repo where the account made commits in the window, using GitHub's contribution data. Private repos are not included.
2. Clones each repo shallowly and writes its commits with full diffs to `dataset/<owner>/<repo>.patch`.
3. Scans `dataset/` with gitleaks, pinned to `v8.18.4`, with a small allowlist in `.gitleaks.toml`. A finding fails the run before upload.
4. Uploads `dataset/` as an artifact that expires after 10 days.

To run it on your own account, fork this repo, then:

1. Enable Actions in the fork. Forks have them off by default.
2. Set the repository variable `DATASET_AUTHOR` to your git name or email, for example `Jane Doe`.
3. Run the workflow once by hand with `days` set to `30`.

The job reads the account from the repository owner, so a fork needs no other changes.

## Privacy

- Only public repositories are exported. Private repos are not in the dataset.
- The dataset contains full diffs. Anything committed to a public repo is in the artifact, and anyone with read access to the repo can download it for 10 days. Keep secrets out of commits.
- Gitleaks catches common secret formats but is not a guarantee.
- Voice samples, archives, drafts, and the ledger stay on your machine. They are gitignored.
- A draft prompt, including the commit diffs it cites, goes to the agent CLI you configure.
- shipnote never posts. You copy an approved draft to the platform yourself.
- The website uses no analytics or tracking scripts.

## Project layout

```
.github/workflows/nightly-dataset.yml   nightly export job
.github/workflows/release.yml           release, GitHub Packages, and npm publish on version tags
.github/workflows/ci.yml                tests, typecheck, and the website build on pull requests
scripts/export-commits.sh               discovery, clone, and export (used by the job and locally)
.gitleaks.toml                          secret-scan allowlist for the dataset
cli/                                    shipnote CLI
  shipnote.ts                           command entry point
  patch.ts, archive.ts, ledger.ts       parse exports, archive them, and track used commits
  select.ts                             skip rules, scoring, and selection
  draft.ts, output.ts                   prompt, checks, and the files a run writes
  similarity.ts                         repeat detection against approved posts
  platforms.ts                          per-platform output (LinkedIn)
  approval.ts, eval.ts, media.ts        approvals, evaluation cases, and diff cards
  memory.ts, recall.ts                  voice facts through agent-brain
  config.ts, budget.ts                  shipnote.toml and per-run limits
website/                                Astro + Tailwind site, deployed to Vercel
assets/logo.svg                         logo used in the README
.verify/run.sh                          verification: shellcheck, YAML, TOML, logo, website build, tests
docs/                                   design notes (PRD, not published)
```

## Development

```bash
bun install
bun test cli                 # CLI unit tests
bun run typecheck            # TypeScript check
bun cli/shipnote.ts select   # against a fetched archive
cd website && bun run dev    # website at localhost:4321
```

Run the full verification with `.verify/run.sh`. It covers shellcheck on the scripts, workflow and TOML parsing, the logo, the changelog section for the current version, the website build, and the CLI tests.

Pull requests run the same checks in the `ci` workflow.

## Releasing

Releases are automatic once a version tag is pushed. The changelog is the source of the release notes.

1. Move the entries under `## [Unreleased]` in `CHANGELOG.md` into a new section, `## [X.Y.Z] - YYYY-MM-DD`.
2. Set `"version"` in `package.json` to `X.Y.Z`.
3. Commit both, merge the pull request, then tag `master` and push: `git tag -a vX.Y.Z -m "shipnote vX.Y.Z" && git push origin vX.Y.Z`.

The `release` workflow then:

- runs the CLI tests,
- checks that the tag matches `package.json`,
- takes the notes from the matching changelog section and publishes the GitHub release,
- publishes the package to GitHub Packages, and
- publishes the package to npm.

Publishing to npm needs the `NPM_TOKEN` repository secret, an npm automation token. If the tag and the package version disagree, or the changelog has no section for the version, nothing is published.

## Roadmap

- **Evaluation set:** build 10 to 20 past commit clusters with the post each should have produced. Every prompt or model change is judged against them, and the results track SHA validity, rubric pass rate, and approval rate.
- **Blog drafts and theme mode:** theme mode exists. Next are retrieval from agent-brain for repeat checks and quality checks for theme posts.
- **Two weeks of daily use:** before any change to the default workflow.

The website's [roadmap page](https://shipnote.abhiudayg.dev/roadmap/) has the milestones.

## License

No license is set yet.
