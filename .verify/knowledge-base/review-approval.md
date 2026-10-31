# Review and approval: knowledge base

## Decisions
- Approval records a draft id, not the draft text, so an edit does not change an approval.
- Nothing in the code posts. `approved.json` has no reader that publishes; that is intentional.
- Approvals survive reruns. `writeDrafts` deletes only generated files, never `approved.json`.

## Known traps
- Draft ids are derived from the claim item (`tweet 1` becomes `tweet-1`). Renumbering tweets in a rerun changes which approval applies.
- `review --decide` needs a terminal. Without one it exits with an error and changes nothing.
- The approval rate in `stats` counts all draft items across all days, including days that were never reviewed.

## Where to look
- Approval state and key mapping: `cli/approval.ts`. Command wiring: `cli/shipnote.ts`.
- Approving marks the draft's commits as used in `ledger.json`. Rejecting an approved draft releases them, unless another approved draft still cites them (`releaseShas` in `cli/ledger.ts`).
- Every approve or reject is recorded in `decisions.json` beside the draft. `tune` reads those decisions and reports approval rates by tweet opening length. It suggests a length only after 20 decisions, and never changes a threshold.
- `cli/tune.ts` holds the bucketing and the report. `tune` in `cli/shipnote.ts` reads the files.
