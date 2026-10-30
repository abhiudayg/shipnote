# social-pipeline

A nightly GitHub Action that builds a dataset of your recent public commits, with full diffs, so that content (posts, threads, write-ups) can be drafted from what you actually shipped.

This repo is a template. Fork it, set two settings, and the same job runs against your own account.

## How it works

1. **Discover repos.** One GraphQL call to GitHub's contribution data lists every repo where the account made commits in the window. Private repos are dropped.
2. **Export commits.** For each repo, a shallow `git clone` and `git log -p` write commit metadata and full patches to `dataset/<owner>/<repo>.patch`. Git clones don't use the REST API, so the job stays well inside rate limits even for 30 days of history.
3. **Scan for secrets.** Gitleaks scans `dataset/`. A finding fails the run before anything is uploaded.
4. **Upload.** `dataset/` is uploaded as a workflow artifact with `retention-days: 10`. GitHub deletes it automatically after that.

Each run rebuilds the full window from git, so nothing needs to persist between runs. The dataset is a snapshot, not a history.

## Setup

1. **Fork or use this template** on GitHub.
2. **Enable Actions** in your fork. Forks have Actions turned off by default.
3. **Set a repository variable** `DATASET_AUTHOR` (Settings → Secrets and variables → Actions → Variables). This is the git author name or email that matches your commits, for example `Jane Doe` or `jane@example.com`. Check it with `git config user.name` and `git config user.email`.
4. **Run it once manually** (Actions → nightly-dataset → Run workflow) with `days` set to `30` to build the initial dataset. Scheduled runs use the default of 30 days.

The job exports the account that owns the repository (`github.repository_owner`), so the fork needs no other configuration.

## Schedule

The workflow runs at `30 18 * * *` UTC, which is 00:00 IST. To run at another time, change the cron expression in `.github/workflows/nightly-dataset.yml`. GitHub's cron runs in UTC and can start several minutes late.

Scheduled workflows in public repositories are disabled after 60 days without repository activity.

## Running locally

Requires `git` and the GitHub CLI (`gh`), authenticated with `gh auth login`.

```bash
LOGIN=your-github-login AUTHOR="Your Name" DAYS=7 scripts/export-commits.sh out
```

`LOGIN` and `AUTHOR` are required. `DAYS` defaults to 30. Output goes to `out/<owner>/<repo>.patch`.

## Output format

Each `.patch` file contains the matching commits in chronological order:

```
commit <sha>
Date: <author date, ISO 8601>
Subject: <commit subject>

<commit body>

diff --git a/... b/...
...
```

## Privacy

- Only public repositories are exported.
- The dataset contains full diffs, so anything committed to a public repo is included. Gitleaks catches common secret formats, but it is not a guarantee. Keep secrets out of commits.
- Artifacts are visible to anyone with read access to the repository. Use a private fork if the dataset should not be public.

## Limits and retention

- Artifact retention is 10 days. Older datasets are removed by GitHub, not by this repo.
- Storage: GitHub's billing docs list 500 MB of included artifact storage on the Free plan. They don't state a separate limit for public repositories. In a 30-day test export for one account, the dataset was about 26 MB.

## Project layout

```
.github/workflows/nightly-dataset.yml   scheduled and manual job
scripts/export-commits.sh               discovery, clone, export
```

## Roadmap

- Draft tweets and blog posts from the dataset, with each claim tied to a commit SHA. The design is in [docs/PRD.md](docs/PRD.md); agent and model settings are in [shipnote.example.toml](shipnote.example.toml).
- Store per-day change summaries in agent-brain and pull them back as context during drafting.
- Approval step before anything is published.

## License

No license is set yet.
