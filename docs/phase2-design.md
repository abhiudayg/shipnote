# Phase 2 design: PR metadata and work clusters

Status: proposed. Approved direction: the `owner/repo.meta.json` artifact and the clustering tiers below. Nothing here is implemented yet. The current rules are in [algorithm.md](algorithm.md), and the reasoning is in [context.md](context.md).

## Problem

Phase 1 scores single commits. Two cases it cannot handle:

- A feature built from several small commits loses to one large refactor on the same day. Phase 1 has no notion of a unit of work.
- A squash-merged PR is written by one person and merged by another. The commit message may not carry the PR title or body, and the author filter can miss it.

## Capture

### `owner/repo.meta.json`

The export writes one meta file next to each patch file:

```json
{
  "schema_version": 1,
  "repo": "owner/repo",
  "prs": [
    {
      "number": 142,
      "title": "Add export retry with backoff",
      "body": "Retries transient GitHub errors three times.",
      "head_branch": "feat/export-retry",
      "author": "login",
      "merged_at": "2026-10-29T10:00:00Z",
      "merge_sha": "<40 hex>",
      "commit_shas": ["<40 hex>", "..."]
    }
  ]
}
```

- Source: `gh pr list --repo <repo> --state merged --search "author:<login> merged:>=<since>"`. The exact `--json` field names should be checked against `gh pr list --help` before implementation.
- `commit_shas` lists the PR's commits, so a squash merge keeps the link to its constituent commits.
- The meta file is a new file in the same folder. The loader reads `**/*.patch` only, so an old loader ignores it.
- Secrets: the nightly job already runs gitleaks over the whole `dataset/` folder before upload. A meta file in that folder is covered without a change to the scan. Local capture (Phase 3) still needs its own gate.

### Window

- Capture: 45 days of history, so work that started before the 30-day cutoff and finished after it is complete.
- Selection: a cluster is kept when its last commit is within 30 days. A cluster's last commit is the latest `date` among its members.

## Clustering

Three tiers, applied in order. A commit joins the first tier that matches it:

1. **PR:** commits that share a PR (`commit_shas` contains the sha). The cluster takes the PR title and body as its text.
2. **Branch:** unmerged commits whose branch matches a `head_branch` in the meta file, or whose conventional scope (`feat(select):`) matches. Without a PR, the branch name is the key.
3. **Session:** remaining direct-to-main commits in the same repo, where consecutive commits are at most `session_gap_hours` (4) apart and share a directory prefix.

A cluster is a `Cluster` value: `{ id, kind, repo, commits, title, body, last_commit_at }`. Selection, decay, and drafting operate on clusters. Drafting receives the cluster's title and body as context and the member commits as evidence.

### Cluster score

Phase 2 scores a cluster as a whole, using the Phase 1 terms on the union of its members:

- Effort uses the sum of cleaned lines across members.
- Commit count adds a multiplier of `min(1 + 0.1 × (n − 1), 1.4)`, so five iterative commits outrank one drive-by edit.
- Narrative uses the PR body when present.

The multiplier and the 1.4 cap come from the spec and have not been measured. They need labelled cases before anyone relies on them.

## Compatibility and rollout

1. **Export:** write `meta.json` next to each patch. Old archives have no meta file.
2. **Select:** read the meta file when present and cluster on tiers 1 to 3. When it is absent, cluster on tier 3 only, and write a line to `review.md` saying so. Old archives keep working.
3. **Default:** switch to clusters once a labelled eval run shows no loss against Phase 1 on the same archive.

Rollback is step 2 with the meta file ignored. No stored data changes shape.

## Failure modes

- `gh` rate limit or outage: the export writes patches without a meta file, and the run records that in `review.md`. It does not fail the whole export.
- A PR whose commits are not on the default branch: `commit_shas` still lists them, but the patch may not contain them. Tier 1 only groups commits present in the patch.
- A fork PR: `head_branch` may not exist in the fetched repo. Treat the PR title and body as text only.
- Two authors in one PR: the export keeps commits matching `AUTHOR`, so the cluster may hold only part of the PR. Record the member count in the cluster.

## Testing plan

- Unit tests for each tier, using a small patch and meta fixture: a PR with three commits becomes one cluster; a branch with two commits joins one cluster; two commits four hours apart in one folder join one session.
- A cluster-score test: five small commits outrank one commit with the same total lines.
- Compatibility tests: an archive with no meta file produces the Phase 1 result plus the `review.md` note.
- Eval: a labelled set, the same one used for Phase 1, scored before and after. Precision at 12 must not drop.

## Non-goals

- The second triage model call. It waits for Phase 2 to be measured.
- Local capture of private repositories. That is Phase 3 and needs the gitleaks gate first.
- The niche-match multiplier. It needs a core-pillars setting that does not exist yet.

## Open questions

- Should session gap also split on a change of author?
- Should a PR title that is one word fall back to the commit subjects?
- What is the minimum number of labelled cases before the default flips?
