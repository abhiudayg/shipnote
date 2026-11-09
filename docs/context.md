# Context

Why shipnote selects and writes the way it does. Pairs with [algorithm.md](algorithm.md), which describes the code.

## Goal

A developer should be able to build a personal brand from the pipeline and their commit history. Each draft should be one idea, written for a developer reader, with a clear result and a question at the end.

## Where the ideas came from

Two long-form pieces were pasted into the project as the working reference:

1. **A copywriting breakdown**: one idea per post, a hook that names a specific problem, short sentences, active voice, cut filler, and a closing line that asks for a reply.
2. **An explainer of the X ranking code**: the claim that scoring weights replies and shares above likes, that posting too often hurts reach, and that negativity suppresses reach.

What shipnote took from them:

- Problem first, then the fix, then the result or trade-off, then one question a developer can answer. This is in the prompt in `cli/draft.ts`.
- One idea per tweet, one tweet per commit (`coveredCommit`).
- A ban on em dashes and on "not X, it's Y" phrasing. The em dash is enforced in code (`EM_DASH`). The contrast pattern is prompt-only, because a regex would catch honest sentences.
- No attacks on people or tools, and no asks to follow, like, or repost.
- A short hype-word list (`HYPE_WORDS`).

What shipnote did not take:

- **Platform weights.** The numbers in the explainer (for example, reply 5.0, share 20.0) are the author's reading of code. They have not been checked against the source. Nothing in the prompt or the scoring depends on them.
- **Engagement claims.** The follower and impression figures in both pieces are self-reported and were not verified.

## Selection: what the data can and cannot show

- The export only includes public repositories, commits that match one author identity, and default branches. Most work outside that set is invisible to shipnote.
- Early runs ranked by diff size. The top of the list was dominated by large refactors, so the same few repositories kept appearing. Phase 1 of the selection spec changed the ranking. See [algorithm.md](algorithm.md) for the new rules.
- A labelled set of "commits worth a post" does not exist yet. Without one, the ranking cannot be measured for quality. Labelling is the next thing that would make changes testable.

## Decisions and their reasons

- **Private repositories are not captured.** Pulling them requires a token, and the spec puts a gitleaks gate in front of any private ingest. Until that gate exists, private code does not reach drafts.
- **The selection spec was adopted in phases.** Phase 1 (cleaning, the effort curve, the arch and narrative terms, and per-repo decay) is in place. Phase 2 (grouping by PR, branch, and session) changes the ingest format and needs a design note. Phase 3 (local capture with a gitleaks gate, and a second triage model call) waits until Phases 1 and 2 are measured.
- **The spec's knobs are code constants for now**, not `shipnote.toml` keys. Moving them into config changes the config schema, and that decision is still open.
- **The model is not told the weights.** The prompt asks for good writing. It does not ask the model to optimise for a platform's ranking.

## Open questions

- Should the effort curve drop more gently above 2,500 lines?
- Which commits in the current archive would a developer actually post about? That answer defines the eval set.
- Should the spec's knobs move into `shipnote.toml`?
