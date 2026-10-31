# Drafting: knowledge base

## Decisions
- The model must return JSON, and each item lists the full SHA of every commit it uses. Code, not the model, decides which items are kept.
- Grounding checks identifiers, file names, and numbers of two or more digits against the cited commits. Prose claims are not checked, because a reliable check would need a second model call.
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
