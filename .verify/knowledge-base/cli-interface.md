# Command-line interface: knowledge base

## Decisions
- Help is generated from one command table in `cli/shipnote.ts`, so it cannot drift from the commands that run.
- Progress appears only after one second. Quick commands stay silent, so their output is unchanged.
- The agent runs as its own process group. Killing only the direct child left a grandchild holding the output pipe, and the CLI hung past its timeout. This was found by a test, not by reading the code.
- Verbose logging goes to stderr only. Scripts that parse stdout are unaffected by `-v`.

## Known traps
- Bun does not kill child processes when the parent exits. The SIGINT handler in `callAgent` covers Ctrl-C only while the CLI is in an agent call.
- A `grep -q` in a shell pipeline with `pipefail` can fail a passing check, because grep exits on its first match. Capture output into a variable first.
- A relative path in the functional script breaks after `cd` into the work directory. Use the absolute root path.

## Where to look
- Command table, dispatch, and agent process control: `cli/shipnote.ts`. Help text: `cli/help.ts`. Verbose flag: `cli/log.ts`. Progress: `cli/progress.ts`.
