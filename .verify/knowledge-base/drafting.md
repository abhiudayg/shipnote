# Drafting: knowledge base

## Decisions
- The model must return JSON, and each item lists the full SHA of every commit it uses. Code, not the model, decides which items are kept.
- Grounding checks identifiers, file names, and numbers of two or more digits against the cited commits. Tweet prose gets a word-overlap check: more than 40% of its content words missing from the cited commits drops the tweet. It is a heuristic, and it does not check blog prose.
- Repeat detection uses word overlap against approved posts from the previous 30 days. Drafts never write to memory.
- A run that fails writes `review.md` and no drafts, and keeps earlier drafts and approvals. An earlier version deleted `sources.json` on a failed rerun, which broke repeat checks.

## Known traps
- The default provider is `agy` with a model name from the config. The model name shown in `review.md` is what was configured, not what the provider served.
- Commit text and voice samples are escaped so they cannot close their own block. The escaping does not stop a model from following instructions written as prose inside a commit. The guard is the JSON contract and the checks, not the prompt.
- `meta.json` cost is an estimate from `usd_per_million_tokens`. The agent CLIs report no usage.

## Real-model measurement
- One run on 2026-10-30 produced three tweets and a blog with no rejections, in about 105 seconds.
- The ten-case eval gave 100% SHA validity, 100% validation pass, and 80% mode match. The two mismatches are theme-labelled cases drafted as story.

## Where to look
- Prompt and checks: `cli/draft.ts`. Writing files: `cli/output.ts`. Repeat detection: `cli/similarity.ts`. Evaluation: `cli/eval.ts`.

## Negative controls
- cli/fixtures/negative-controls.json has four invented claims that reuse commit words. All four are rejected.
- Three controls must be kept: two supported tweets and one known miss, a tweet with a single false word among several true ones, which the 40% limit lets through.
- Code gate (`qualityProblem` in `cli/draft.ts`): a tweet is dropped when it uses a hype word, its first sentence is over 25 words, or it names no file, command, or number. The word list is `HYPE_WORDS`, shared with the prompt.
- Repair loop: when tweets are rejected, one repair call is made with the rejected text and reasons (`repairNotes` in `cli/draft.ts`, `repairTweets` in `cli/shipnote.ts`). Its passing tweets join the first pass's. The repair is skipped when the budget refuses it, and a failed repair call is recorded in `review.md`.
- The agent call ends at its deadline even if a child process keeps the output pipe open. Only the agent's own process group is killed; a child that leaves the group keeps running.
- Openings: each tweet opens with the problem the change solves (the prompt rule is in `buildPrompt`). Repeated runs on the same data give near-identical output, because the inputs, the candidates, and the prompt are all fixed, and nothing asks for variation.
- One tweet per commit: `coveredCommit` in `cli/draft.ts` rejects a tweet that cites a commit an earlier kept tweet covers. The repair pass applies the same rule against the first pass.
