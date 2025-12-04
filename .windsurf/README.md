# Windsurf/Cascade Configuration

**Agent**: Windsurf with Cascade AI
**Purpose**: UI component development for Dicee project

## Quick Start

When you open this project in Windsurf:

1. **Cascade will have access to**:
   - Shared MCP memory server (`.claude/state/memory.jsonl`)
   - Supabase database schema and docs
   - Project state files (`.claude/state/current-phase.json`)

2. **Start with the workflow**:
   ```
   /build-component
   ```

3. **Check current tasks**:
   ```
   cat .claude/state/current-phase.json
   ```

4. **Read the handoff**:
   ```
   cat .claude/state/session-handoff.md
   ```

## Rules (Automatic)

### Always On
- **core-guardrails.md** - Three Strikes Rule, project context, critical rules

### Glob-based (*.svelte files)
- **svelte-components.md** - Svelte 5 runes syntax, component patterns, testing

## Workflows

### `/build-component`
Guides you through creating a new component:
1. Read task details from state file
2. Check dependencies
3. Read design specs
4. Create component with Svelte 5 runes
5. Create tests
6. Verify (check, lint, test)
7. Update state
8. Report

### `/verify-task`
Verifies a completed task:
1. Read task verification requirements
2. Run checks (TypeScript, lint, tests)
3. Update task status
4. Report results

## MCP Servers

### dicee-memory
- **Type**: stdio (local node process)
- **File**: `.claude/state/memory.jsonl`
- **Purpose**: Shared state across Claude Code and Cascade

### dicee-supabase
- **Type**: HTTP (hosted)
- **URL**: https://mcp.supabase.com/mcp
- **Purpose**: Database schema, migrations, edge functions

## File Structure

```
.windsurf/
├── README.md              # This file
├── rules/
│   ├── core-guardrails.md     # Always On - Critical rules
│   └── svelte-components.md   # Glob: *.svelte - Svelte 5 patterns
└── workflows/
    ├── build-component.md     # /build-component
    └── verify-task.md         # /verify-task
```

## Integration with Claude Code

This configuration enables smooth handoff between Claude Code CLI (backend/API work) and Windsurf/Cascade (UI component work):

1. **Shared state**: Both agents read/write to `.claude/state/` files
2. **Shared memory**: Both access the same MCP memory server
3. **Shared database**: Both query Supabase via MCP
4. **Coordinated tasks**: Task dependencies tracked in `current-phase.json`

## Testing Setup

When Cascade creates components, tests are co-located:
```
src/lib/components/ui/
├── Avatar.svelte
└── __tests__/
    └── Avatar.test.ts
```

## Quality Checks

Run before marking tasks complete:
```bash
pnpm check          # TypeScript + Svelte
pnpm biome:fix      # Auto-fix linting
pnpm test           # All tests
```

## Modern Patterns (2025)

- **Svelte 5 runes** - `$state`, `$derived`, `$effect` (not stores)
- **Biome** - Modern linter/formatter (not Prettier)
- **Vitest** - Fast test runner
- **MCP** - Shared context protocol across agents
- **State-driven** - Task tracking in JSON files

## References

- Full project docs: `CLAUDE.md`
- Agentic guardrails: `.claude/AGENT-GUARDRAILS.md`
- UI/UX design: `docs/UI-UX-DESIGN-REPORT.md`
- Workflow docs: `.claude/workflow-orchestration.md`
