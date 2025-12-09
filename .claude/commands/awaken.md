# Session Awakening

Initialize the development session by loading context and verifying infrastructure.

## Instructions

Run these checks in order and report results:

### 1. MCP Server Connectivity

Verify all 3 MCP servers are operational:

- **memory**: Call `mcp__memory__read_graph` - should return entities
- **supabase**: Call `mcp__supabase__list_tables` - should return tables
- **akg**: Call `mcp__akg__akg_invariant_status` - should return invariant results

Report status: `[server]: ✓ Connected` or `[server]: ✗ Error`

If any server fails, note the issue but continue with other checks.

### 2. Load Current Phase

Read `.claude/state/current-phase.json` and extract:
- Current phase name and status
- Active tracks and their status
- Any pending tasks
- Last session info

### 3. Load Handoff Notes

Read `.claude/state/session-handoff.md` and summarize:
- Previous session date and work completed
- Any blockers or decisions pending
- Recommended next steps

### 4. Check Quality Gate Status

Run a quick quality check:
```bash
pnpm exec tsc --noEmit 2>&1 | tail -5
```

Report: `TypeScript: ✓ Clean` or `TypeScript: ⚠ X errors`

### 5. Check AKG Graph Freshness

```bash
stat -f "%Sm" docs/architecture/akg/graph/current.json
```

Report if graph is older than 24 hours with recommendation to run `pnpm akg:discover`.

## Output Format

```
## Session Awakened

### MCP Servers
- memory: ✓ Connected (X entities)
- supabase: ✓ Connected (X tables)
- akg: ✓ Connected (X/X invariants passing)

### Current Phase
- **Phase**: [name]
- **Status**: [status]
- **Active Tracks**: [list with status]

### Last Session
- **Date**: [date]
- **Work**: [summary]
- **Next Steps**: [list]

### Quality Status
- TypeScript: ✓ Clean
- AKG Graph: ✓ Current (updated [timestamp])

### Blockers
[List any blockers or "None"]

## Ready to Work

Current focus: [primary task or track]
```

## After Awakening

Once session is awakened:
1. The agent should be ready to accept tasks
2. State files are loaded and understood
3. MCP tools are available for use
4. Context from previous session is established

Run this command at the start of every session.
