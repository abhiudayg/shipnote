# Review and approval

A user reads each draft beside its commit evidence, approves or rejects it, and sees the approval rate across all draft days. Nothing is posted by shipnote, and approval records a draft id only.

## Sub-features

- `review-listing`: Prints each draft with its approval state, its length, its evidence, and the rejections from `review.md`.
  - Intent: a user can judge a draft against its commits without opening files.
  - Behaviour: reads `sources.json` and `approved.json`.
  - Outcome: each draft id appears with approved or not approved.
- `approve`: Records a draft id in `approved.json`, after checking that the id exists.
  - Intent: a user marks a draft as chosen, and nothing posts.
  - Behaviour: rejects an unknown id and keeps the list unchanged on a repeat.
  - Outcome: the output says that nothing was posted.
- `decide-keys`: Steps through drafts with one key each: `a` approves, `r` rejects, `e` opens the draft in `$EDITOR`, `s` skips, and `q` quits.
  - Intent: a review takes a few minutes a day.
  - Behaviour: needs an interactive terminal and saves each change as it is made.
  - Outcome: `approved.json` reflects the decisions.
- `approval-rate`: Reports approved items as a share of all draft items across all days.
  - Intent: measure whether drafts are worth approving.
  - Behaviour: counts claims in each day's `sources.json` and matches them with `approved.json`.
  - Outcome: one line with the day count, item count, and approval rate.

## How to get to it (user POV)

- CLI: `shipnote review --date 2026-10-31` prints the listing.
- CLI: `shipnote review --decide --date 2026-10-31` steps through the drafts in a terminal.
- CLI: `shipnote approve tweet-1 --date 2026-10-31` approves one draft.
- CLI: `shipnote stats` prints the approval rate.

## Verification Suites (Targeted Test Commands)

- **Unit Tests:** `.verify/run.sh unit review-approval`, which runs `bun test cli/approval.test.ts`.
- **Functional Test:** `.verify/run.sh functional`. The steps approve `tweet-1`, check that `review --decide` refuses without a terminal, and check that `stats` prints the approval rate.
- **Allowlisted:** `.verify/run.sh unit review-approval` and `.verify/run.sh functional`.
- **Preconditions:** the decide key loop needs a real terminal and is not run by the harness.

Steps:

1. Run `.verify/run.sh unit review-approval`. Expect the unapprove and key-mapping tests to pass.
2. Run `.verify/run.sh functional`. Expect the approve, decide-refusal, and stats checks to pass.

## Gotchas

- The key loop itself is checked by hand. A pseudo-terminal run covered approve, reject, skip, and edit, but the harness does not repeat it.
- Editing a draft with `e` does not change its approval, because approval is recorded by id, not by text.
- A publish step does not exist. Nothing reads `approved.json` to post, by design.
