# Voice memory

A user stores their writing samples as facts in agent-brain, so drafts can follow their voice. Samples are style only, and the drafting prompt says so. Storing a fact never sends it anywhere except the local agent-brain store.

## Sub-features

- `remember`: Stores one fact with a tag and a source, after refusing secret-shaped text.
  - Intent: add a single sample without a file.
  - Behaviour: checks the text against the secret pattern, then calls `agent-brain remember`.
  - Outcome: prints the stored id, or reports that the fact already exists.
- `import-voice`: Stores each paragraph of a folder of Markdown files under the voice tag.
  - Intent: bring in a body of writing once.
  - Behaviour: calls `agent-brain import-corpus`, which deduplicates by content hash.
  - Outcome: prints the counts of stored, already-stored, and refused paragraphs.
- `voice-context`: Reads voice facts with `agent-brain recall --json` and adds them to the drafting prompt.
  - Intent: drafts match the way the user already writes.
  - Behaviour: filters by the voice tag and falls back to the voice folder if agent-brain fails.
  - Outcome: `review.md` records the number of facts and any recall error.

## How to get to it (user POV)

- CLI: `shipnote remember "I write short sentences."` stores one fact.
- CLI: `shipnote import-voice` stores the paragraphs of `voice/`.
- Config: `voice_tag` in `shipnote.toml` picks the tag.

## Verification Suites (Targeted Test Commands)

- **Unit Tests:** `.verify/run.sh unit voice-memory`, which runs `bun test cli/memory.test.ts cli/recall.test.ts`. Both inject a fake runner, so agent-brain is not needed.
- **Functional Test:** none in the harness. The behaviour was checked by hand against an isolated HOME with agent-brain 1.0.0-rc6.
- **Allowlisted:** `.verify/run.sh unit voice-memory`.
- **Preconditions for the manual check:** agent-brain 1.0.0-rc6 on the PATH, and an isolated `HOME` so the real store is not changed.

Steps:

1. Run `.verify/run.sh unit voice-memory`. Expect the secret refusal, argv, and report-parsing tests to pass.
2. For a manual check, set `HOME` to an empty directory, run `shipnote remember` twice with the same text, and expect the second run to report `already stored`.

## Gotchas

- `import-voice` runs agent-brain's own secret check. shipnote's pattern check applies only to `remember`.
- The voice folder is still read directly while drafting. A folder imported with `import-voice` reaches the prompt twice until one path is removed.
- The functional phase does not run agent-brain, so this feature has no end-to-end check in the harness.
