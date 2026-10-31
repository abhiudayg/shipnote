<p align="center">
  <img src="assets/logo.svg" width="128" alt="shipnote logo">
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

shipnote reads your public commits, drafts tweets and blog posts from them, and leaves every post for you to approve. Each claim in a draft cites the commit it came from. Nothing publishes on its own.

It runs in two parts:

1. **A nightly GitHub Action** exports your public commits and full diffs as an artifact. It runs on your own GitHub account.
2. **A local CLI** downloads that artifact, archives it, and selects which commits are worth writing about. Drafting, review, and approval are the next milestones.

## Status

| Part | State |
|---|---|
| Nightly dataset Action | Working. Builds a 30-day dataset, scans it for secrets, and uploads it as an artifact that expires after 10 days. |
| `shipnote fetch` | Working. Downloads and archives the latest successful dataset. |
| `shipnote select` | Working. Parses commits, skips merges, lockfile-only changes, used commits, and denylisted repos, and ranks the rest. |
| Drafting, media, review, approval | Not built yet. See the [roadmap](https://shipnote.abhiudayg.dev/roadmap/). |
| Website | Live on Vercel. Custom domain not connected yet. |

## Quick start

You need [Bun](https://bun.sh), [git](https://git-scm.com), and the [GitHub CLI](https://cli.github.com) signed in with `gh auth login`.

```bash
bun install
bun cli/shipnote.ts fetch          # download and archive the latest dataset
bun cli/shipnote.ts select         # rank the commits worth a post
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

## Install without forking

The package installs a `shipnote` command. It runs under Bun, so install [Bun](https://bun.sh) first.

```bash
npm install -g @abhiudayg/shipnote
```

`fetch` downloads the nightly dataset from a repository that runs the export workflow. Without a fork, export your own commits with your GitHub login instead, then import them:

```bash
LOGIN=your-github-login AUTHOR="you@example.com" "$(npm root -g)/@abhiudayg/shipnote/scripts/export-commits.sh" ./export
shipnote import ./export
shipnote select
```

Run the commands from a folder of your own. Drafts, the ledger, and `shipnote.toml` are written there, not in the package.

## CLI reference

```
shipnote fetch  [--date YYYY-MM-DD] [--run ID]
shipnote import <dir> [--date YYYY-MM-DD]
shipnote select [--date YYYY-MM-DD]
shipnote draft  [--date YYYY-MM-DD] [--top N]
```

- `fetch` downloads the newest successful `nightly-dataset` run, or the run given by `--run`, into `archive/<date>/`. If that date is already archived, it does nothing.
- `select` reads `archive/<date>/` and prints commits ranked by score. `--date` defaults to today in IST.

Environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `SHIPNOTE_REPO` | `abhiudayg/shipnote` | The repo whose Action artifacts `fetch` downloads. Set this to your fork. |
| `SHIPNOTE_DENYLIST` | empty | Comma-separated repos to exclude, for example `you/private-client`. |

The ranking combines the size of the change (log scale), the number of new files, and whether the commit message is specific. Commits already in `ledger.json` are skipped.

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
- The website uses no analytics or tracking scripts.

## Configuration

`shipnote.example.toml` is the planned configuration for the drafting step: the agent provider, model, effort, token and cost budgets, and dedup settings. Copy it to `shipnote.toml`, which is gitignored. The CLI does not read it yet.

## Project layout

```
.github/workflows/nightly-dataset.yml   nightly export job
scripts/export-commits.sh               discovery, clone, and export (used by the job and locally)
.gitleaks.toml                          secret-scan allowlist for the dataset
cli/                                    shipnote CLI: fetch, select, and the parser
  shipnote.ts                           command entry point
  patch.ts                              parses exported patches into commits
  select.ts                             skip rules, scoring, and selection
  select.test.ts                        tests against a fixture patch
website/                                Astro + Tailwind site, deployed to Vercel
assets/logo.svg                         logo used in the README
.verify/run.sh                          verification: shellcheck, YAML, TOML, logo, website build, tests
docs/                                   design notes (PRD, not published)
```

## Development

```bash
bun install
bun test cli                 # CLI unit tests
bun cli/shipnote.ts select   # against a fetched archive
cd website && bun run dev    # website at localhost:4321
```

Run the full verification with `.verify/run.sh`. It covers shellcheck on the export script, workflow and TOML parsing, the logo, the website build, and the CLI tests.

## Releasing

Releases are automatic once a version tag is pushed. The changelog is the source of the release notes.

1. Move the entries under `## [Unreleased]` in `CHANGELOG.md` into a new section, `## [X.Y.Z] - YYYY-MM-DD`.
2. Set `"version"` in `package.json` to `X.Y.Z`.
3. Commit both, then tag and push: `git tag -a vX.Y.Z -m "shipnote vX.Y.Z" && git push origin vX.Y.Z`.

The `release` workflow then runs the CLI tests, checks that the tag matches `package.json`, takes the notes from the matching changelog section, and publishes the GitHub release. If the tag and the package version disagree, or the changelog has no section for the version, the release is not published.

Verification (`.verify/run.sh`) also checks that the current package version has a changelog section.

## Roadmap

- **Drafting:** tweets and blog drafts from the selected commits, using the agent you configure. Each claim must cite a commit SHA that exists in the dataset.
- **Review and approval:** a review command that shows each draft beside its evidence, plus approve, edit, and mark-used steps.
- **Evaluation set:** past commit clusters with the post each should have produced, used to judge every prompt or model change.

The website's [roadmap page](https://shipnote.abhiudayg.dev/roadmap/) has the milestones.

## License

No license is set yet.
