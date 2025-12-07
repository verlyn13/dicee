# Run Quality Gate

Execute the quality gate checks before phase transition.

## Instructions

Run the quality gate script:

```bash
./scripts/quality-gate.sh
```

This checks (7 steps):
1. TypeScript & Rust - `pnpm check`
2. AKG Invariants - `pnpm akg:check` (architectural rules)
3. Biome Lint - `pnpm biome:check`
4. Tests - `pnpm test`
5. Secrets - `infisical scan` (if available)
6. Build - `pnpm build`
7. AKG Diagrams - Check if diagrams are current

If any check fails:
1. Report which check failed
2. Show the error output
3. Suggest fixes

If all pass:
1. Report success
2. Confirm ready for phase transition

Run the quality gate now and report results.
