# Drafting

shipnote sends the selected commits and voice samples to the configured agent, requires JSON back, and writes tweets, a blog post, and a LinkedIn post only after each claim passes its checks. A consumer runs `draft` for a date and finds the drafts and a review file that explains every rejection.

## Sub-features

- `story-or-theme-mode`: Picks story mode when the top commit clears `min_story_score`, and theme mode otherwise.
  - Intent: post about one change when there is one, and about a shared theme when there is not.
  - Behaviour: chooses the mode from the top score, and writes no tweets in theme mode.
  - Outcome: `review.md` shows the mode.
- `grounding-checks`: Rejects a tweet or blog that cites an unknown SHA, names a backticked identifier, file, or two-digit number missing from the cited commits, is over 280 characters, or matches a secret pattern.
  - Intent: every claim can be traced to a commit.
  - Behaviour: checks each item and records a reason for each rejection.
  - Outcome: rejected items are listed in `review.md`, and kept items are written.
- `repeat-check`: Rejects a draft that repeats an approved post from the last 30 days.
  - Intent: do not post the same idea twice.
  - Behaviour: compares word overlap with approved posts and rejects at or above 0.6.
  - Outcome: the rejection names the earlier date and draft id.
- `failure-handling`: Writes `review.md` with the reason and no drafts when the dataset is missing, the agent fails, the output is unparsable, the budget is exceeded, or nothing passes.
  - Intent: a failed run never posts something weaker.
  - Behaviour: keeps earlier drafts and approvals, and records the failure.
  - Outcome: `review.md` has a Failure section and says no drafts were written.
- `run-record`: Writes `meta.json` with the prompt hash, config hash, rubric, time, estimated cost, and cost per kept item.
  - Intent: a later quality change can be traced to its cause.
  - Behaviour: records the values for each run.
  - Outcome: `meta.json` is present after a successful run.

## How to get to it (user POV)

- CLI: `shipnote draft --date 2026-10-31 --top 5` writes `drafts/2026-10-31/`.
- CLI: `shipnote eval` runs saved commit cases through the agent and reports mode match, SHA validity, and validation rates.
- Files: `drafts/<date>/review.md`, `tweets.md`, `blog.md`, `linkedin.md`, `sources.json`, and `meta.json`.

## Verification Suites (Targeted Test Commands)

- **Unit Tests:** `.verify/run.sh unit drafting`, which runs the draft, output, similarity, platforms, eval, budget, and config suites.
- **Functional Test:** `.verify/run.sh functional`. The draft step runs the CLI with a fake agent, the rerun step rejects the tweet, and both check the files written.
- **Allowlisted:** `.verify/run.sh unit drafting` and `.verify/run.sh functional`.
- **Preconditions:** the functional step needs no network. It uses a fake agent script under `.verify/artifacts/`.

Steps:

1. Run `.verify/run.sh unit drafting`. Expect all tests to pass, including the grounding, repeat, and untrusted-input tests.
2. Run `.verify/run.sh functional`. Expect `functional smoke passed`. The draft step checks `meta.json` for two kept items, and the rerun step checks that approvals survive a rejected tweet.

## Gotchas

- Grounding checks identifiers, file names, and numbers. Prose is checked by a word-overlap heuristic: a tweet is dropped when more than 40% of its content words (five letters or more, generic marketing words excluded) are absent from the cited commits. It cannot tell a true paraphrase from a false claim that reuses commit vocabulary. Blogs are not checked for prose.
- Repeat detection is word overlap, not embeddings. The 0.6 threshold is not tuned on real posts.
- Draft quality on a real model is measured only by `shipnote eval`, and the eval set has ten cases. Two of them are labeled theme and drafted as story.
- The harness uses a fake agent. A change in prompt wording is not measured by the functional phase.

## Code

- `cli/draft.ts`, `cli/draft.test.ts`: the prompt (including the problem-first opening rule), parsing, the commit and grounding checks (version strings are checked whole), one tweet per commit, the quality gate, and the repair notes.
- `cli/output.ts`, `cli/output.test.ts`
- `cli/similarity.ts`, `cli/similarity.test.ts`
- `cli/platforms.ts`, `cli/platforms.test.ts`
- `cli/eval.ts`, `cli/eval.test.ts`
- `cli/budget.ts`, `cli/budget.test.ts`
- `cli/config.ts`, `cli/config.test.ts`
- `shipnote.example.toml`
- `cli/shipnote.ts` (shared entry point; this feature owns the `draft`, `eval`, and `eval-add` commands)
- `cli/negative-controls.test.ts`
- `cli/fixtures/negative-controls.json`
