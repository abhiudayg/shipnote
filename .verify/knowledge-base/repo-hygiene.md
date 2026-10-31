# Repository hygiene and the harness: knowledge base

## Decisions
- Archives, drafts, the ledger, voice samples, eval results, and build output are ignored. Those files can contain personal writing or dataset content.
- `.env*` and `.vercel` are ignored. `.vercel` is a machine-specific project link.
- `.verify/artifacts/` is ignored; the rest of `.verify/` is committed.

## Known traps
- `scripts/export-commits.sh` reads `LOGIN` and `AUTHOR` from the environment, so no value needs to be committed.
- The Vercel link in `website/.vercel` is not reproducible on another machine; relink with the CLI.
- The agstack helper scripts are not in this repository. The feature map is checked by hand until they are added.

## Where to look
- Ignore rules: `.gitignore`. Harness: `.verify/run.sh`, `.verify/doctor.sh`, `.verify/verify.toml`.
