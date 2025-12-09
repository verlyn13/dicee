# System Health Check

Quick diagnostic check of the development environment. Use this to verify the agentic framework is operational.

## Instructions

Run these checks and report results:

### 1. MCP Servers
Check connectivity of all 3 MCP servers:

- **memory**: Call `mcp__memory__read_graph` - should return entities
- **supabase**: Call `mcp__supabase__list_tables` - should return tables
- **akg**: Call `mcp__akg__akg_invariant_status` - should return invariant results

Report: `[name]: ✓ Connected` or `[name]: ✗ Error: [message]`

### 2. Hook Scripts
Verify hook scripts are executable:

```bash
ls -la scripts/hooks/*.sh | awk '{print $1, $NF}'
```

All should show `rwx` permissions. Report any missing execute permission.

### 3. State Files
Validate state files are valid JSON:

```bash
jq empty .claude/state/current-phase.json && echo "current-phase.json: valid"
jq empty .claude/state/blockers.json && echo "blockers.json: valid"
jq empty .claude/state/decisions.json && echo "decisions.json: valid"
```

Report any JSON parse errors.

### 4. AKG Graph Freshness
Check graph age and node count:

```bash
stat -f "%Sm" docs/architecture/akg/graph/current.json
jq '.nodes | length' docs/architecture/akg/graph/current.json
jq '.edges | length' docs/architecture/akg/graph/current.json
```

Warn if graph is older than 24 hours.

### 5. Development Commands
Verify pnpm is functional:

```bash
pnpm --version
```

## Output Format

```
## Health Check Results

### MCP Servers
- memory: ✓ Connected (X entities)
- supabase: ✓ Connected (X tables)
- akg: ✓ Connected (X/X invariants passing)

### Hooks
- All 4 hook scripts executable: ✓

### State Files
- current-phase.json: ✓ valid
- blockers.json: ✓ valid
- decisions.json: ✓ valid

### AKG Graph
- Last updated: [timestamp]
- Nodes: X | Edges: X
- Freshness: ✓ Current (or ⚠ Stale - run `pnpm akg:discover`)

### Environment
- pnpm: vX.X.X ✓

## Summary: [X/5 checks passing]
```

Run the health check now and report results in this format.
