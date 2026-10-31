# Feature map

Each file here is a contract for one user-facing behaviour of shipnote. A contract names the sub-features, the way to reach them, the commands that prove them, and the known gaps.

## Preconditions

- Bun 1.4.4 or later, git, jq, shellcheck, xmllint, and ruby. `.verify/doctor.sh` checks them.
- Unit and static phases need no network and no model.
- The functional phase runs the CLI against a fixture archive and a fake agent. It does not call a real model.
- agent-brain, gh, and agy are optional. Features that need them are skipped or fall back, and the contract says so.

## Driving conventions

- Run the harness from the repository root: `.verify/run.sh [all|doctor|unit|static|functional] [feature|all]`.
- Each run writes its logs to `.verify/artifacts/<RUN_ID>/`.
- Commands in contracts are literal. Placeholders appear only in prose.

## Proof standards

- A behaviour is proven by a unit test in `cli/*.test.ts` or by a functional step in `.verify/functional/cli-smoke.sh`.
- Every command a contract names is in `.verify/verify.toml`.
- A failing test is fixed, or its gap is written into the Gotchas section. It is not weakened or skipped.

## Feature index

| Feature | Contract | Unit suites | Functional |
|---|---|---|---|
| Dataset selection | [dataset-select.md](dataset-select.md) | archive, ledger, select | select step |
| Drafting | [drafting.md](drafting.md) | draft, output, similarity, platforms, eval, budget, config | draft and rerun steps |
| Review and approval | [review-approval.md](review-approval.md) | approval | approve, review --decide, stats steps |
| Voice memory | [voice-memory.md](voice-memory.md) | memory, recall | none; needs agent-brain |
| Repository hygiene and harness | [repo-hygiene.md](repo-hygiene.md) | none | static and functional phases |
| Command-line interface | [cli-interface.md](cli-interface.md) | help, progress | help, verbose, and agent spin-down steps |

Each feature has a knowledge-base entry in `../knowledge-base/<feature>.md` with its decisions and known traps.
