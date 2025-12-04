# Run Quality Gate

Execute the quality gate checks before phase transition.

## Instructions

Run the quality gate script:

```bash
./scripts/quality-gate.sh
```

This checks:
1. TypeScript - `pnpm typecheck`
2. Lint - `pnpm lint` (Biome)
3. Tests - `pnpm test`
4. Secrets - `infisical scan` (if available)
5. Build - `pnpm build`

If any check fails:
1. Report which check failed
2. Show the error output
3. Suggest fixes

If all pass:
1. Report success
2. Confirm ready for phase transition

Run the quality gate now and report results.
