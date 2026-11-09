# Voice memory: knowledge base

## Decisions
- Voice facts live in agent-brain, which is local. The prompt labels them as style samples, not facts.
- `remember` runs shipnote's secret pattern check before storing. `import-voice` relies on agent-brain's check, which is different.
- Imports deduplicate by content hash in agent-brain, so re-running an import stores nothing new.

## Known traps
- The voice folder is still read directly by drafting, so an imported folder reaches the prompt twice until one path is removed.
- The commands need agent-brain 1.0.0-rc6. Earlier releases did not have `remember` or `import-corpus`.
- Verified in an isolated `HOME` only. The real store has not been imported into.

## Where to look
- Commands: `cli/memory.ts`. Recall: `cli/recall.ts`. Command wiring: `cli/shipnote.ts`.
- The shared `cli/shipnote.ts` calls `rankCandidates` (`cli/draft.ts`) for the `draft` candidates. That is drafting's code, not this feature's. The `remember` and `import-voice` wiring is unchanged.
