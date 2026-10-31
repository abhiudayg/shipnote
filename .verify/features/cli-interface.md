# Command-line interface

A user runs `shipnote` the way they run `docker`: help at every level, one global verbose flag, and progress for any step that takes time. A slow agent call is stopped at its timeout, and nothing it started is left running.

## Sub-features

- `help`: Prints the command list with summaries, and each command's usage and options.
  - Intent: a user can discover commands without reading the README.
  - Behaviour: `shipnote --help` lists commands; `shipnote COMMAND --help` lists that command's options.
  - Outcome: the output names every command and its options.
- `verbose`: Writes step-by-step details to stderr when `-v` or `--verbose` is given, on any command.
  - Intent: a user can see what a run did without changing its output.
  - Behaviour: writes `debug:` lines for the command, the archive read, the draft mode, agent-brain calls, and the agent process id. The prompt text is not printed.
  - Outcome: stdout is unchanged, and stderr holds the debug lines.
- `progress`: Shows a spinner with elapsed seconds for a step that runs longer than one second.
  - Intent: a long step is never silent.
  - Behaviour: quick steps print nothing. In a terminal the spinner redraws in place; otherwise one start line is printed.
  - Outcome: a finished step ends with a check mark and its duration.
- `agent-spin-down`: Starts the agent as a process group, and ends the whole group at the timeout or on Ctrl-C.
  - Intent: a stalled agent cannot hang the CLI or leave processes behind.
  - Behaviour: kills the group with SIGKILL when the timeout passes or SIGINT arrives, and records the timeout in `review.md`.
  - Outcome: the CLI exits near the timeout, or with status 130 on Ctrl-C, and no agent process remains.

## How to get to it (user POV)

- CLI: `shipnote --help` and `shipnote COMMAND --help`.
- CLI: any command with `-v` or `--verbose`, for example `shipnote select --date 2026-10-31 -v`.
- CLI: `shipnote --version` prints the package version.
- CLI: `shipnote update` installs the latest version from npm, and `shipnote update --check` only reports whether one exists.

## Verification Suites (Targeted Test Commands)

- **Unit Tests:** `.verify/run.sh unit cli-interface`, which runs `bun test cli/help.test.ts cli/progress.test.ts`.
- **Functional Test:** `.verify/run.sh functional`. The steps check the help output, the verbose debug line, and a stalled agent that must exit within 15 seconds with no `sleep` process left.
- **Allowlisted:** `.verify/run.sh unit cli-interface` and `.verify/run.sh functional`.
- **Preconditions:** the functional steps use a fake stalled agent under `.verify/artifacts/`. They need no network.

Steps:

1. Run `.verify/run.sh unit cli-interface`. Expect the help and progress tests to pass.
2. Run `.verify/run.sh functional`. Expect `exited after` with a time under 15 seconds and `functional smoke passed`.

## Gotchas

- Ctrl-C is checked by hand in a pseudo-terminal. The harness sends SIGINT programmatically, which covers the same handler.
- The process group is created with `detached`. A helper that changes its own process group can escape the kill, and no check covers that case.
- Verbose output can include the text given to `remember`, because agent-brain calls are logged. Run without `-v` when recording voice text.

## Code

- `cli/help.ts`, `cli/help.test.ts`
- `cli/log.ts`
- `cli/progress.ts`, `cli/progress.test.ts`
- `cli/shipnote.ts` (shared entry point; this feature owns the command table, help dispatch, verbose setup, and `callAgent` spin-down)
- `cli/update.ts`, `cli/update.test.ts`
