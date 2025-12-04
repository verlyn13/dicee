# Dicee Core Guardrails

**Activation**: Always On
**Purpose**: Critical rules for all Cascade work on Dicee

## Three Strikes Rule (MANDATORY)

If you fail at the same operation 3 times:
1. **STOP immediately**
2. Do NOT try a 4th time
3. Ask the human for guidance

This applies to: build failures, test failures, file operations, anything.

## Project Context

- **Current Phase**: Phase 3 - Profile & Stats System
- **State Location**: `.claude/state/current-phase.json`
- **Full Documentation**: See `CLAUDE.md` and `.claude/AGENT-GUARDRAILS.md`

## Quick Rules

1. **Read before edit** - Never modify a file you haven't read this session
2. **Verify after change** - Run tests/build after edits
3. **Update state** - Mark tasks complete in `.claude/state/current-phase.json`
4. **Svelte 5 runes** - Use `$state`, `$derived`, `$effect` (not stores)
5. **Biome formatting** - Use Biome, NOT Prettier

## Commands

```bash
pnpm check        # TypeScript + Svelte check
pnpm test         # Run tests
pnpm biome:check  # Lint check
pnpm biome:fix    # Auto-fix linting
```

## When Stuck

- Check `.claude/state/session-handoff.md` for context
- Read `.claude/AGENT-GUARDRAILS.md` for full rules
- Ask the human after 3 failed attempts
