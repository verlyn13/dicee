# Windsurf/Cascade Configuration

**Agent**: Windsurf with Cascade AI
**Purpose**: UI component development for Dicee project
**Version**: 2.0.0 (with AKG integration)

## Quick Start

When you open this project in Windsurf:

1. **Cascade will have access to**:
   - Shared MCP memory server (`.claude/state/memory.jsonl`)
   - Supabase database schema and docs
   - AKG architectural knowledge graph
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
- **akg-architecture.md** - Layer boundaries, import validation, invariants

### Glob-based (*.svelte files)
- **svelte-components.md** - Svelte 5 runes syntax, component patterns, testing

## Workflows

### `/build-component`
Guides you through creating a new component with AKG validation:
1. Read task details from state file
2. Check dependencies
3. **Validate layer placement with AKG**
4. Read design specs
5. Create component with Svelte 5 runes
6. **Validate imports with akg_check_import**
7. Create tests
8. Verify (check, lint, test, **akg:check**)
9. Update state
10. Report

### `/verify-task`
Verifies a completed task with full quality gate:
1. Read task verification requirements
2. Run checks (TypeScript, lint, tests, **AKG invariants**)
3. Update task status
4. Report results

### `/akg`
Query the architectural knowledge graph:
- `/akg layer <name>` - Get layer import rules
- `/akg node <path>` - Get file info
- `/akg check-import <from> <to>` - Validate import
- `/akg invariants` - Check all invariants
- `/akg diagram <type>` - Generate diagram
- `/akg path <from> <to>` - Find dependency path
- `/akg refresh` - Reload graph

## MCP Servers

### dicee-memory
- **Type**: stdio (local node process)
- **File**: `.claude/state/memory.jsonl`
- **Purpose**: Shared state across Claude Code and Cascade
- **Tools**: `mcp0_create_entities`, `mcp0_search_nodes`, `mcp0_read_graph`

### supabase
- **Type**: HTTP (hosted)
- **URL**: https://mcp.supabase.com/mcp
- **Purpose**: Database schema, migrations, edge functions
- **Tools**: `mcp1_execute_sql`, `mcp1_list_tables`, `mcp1_search_docs`

### akg (Architectural Knowledge Graph)
- **Type**: stdio (bun process)
- **Purpose**: Architecture-aware queries and validation
- **Tools**:
  - `akg_layer_rules` - Get layer import rules
  - `akg_node_info` - Get node details
  - `akg_check_import` - **Validate imports before writing**
  - `akg_invariant_status` - Check invariants
  - `akg_diagram` - Generate Mermaid diagrams
  - `akg_path_find` - Find dependency paths
  - `akg_cache_status` - Cache management

## File Structure

```
.windsurf/
├── README.md                  # This file
├── cascade.json               # Cascade settings
├── rules/
│   ├── core-guardrails.md     # Always On - Critical rules
│   ├── akg-architecture.md    # Always On - AKG layer rules
│   └── svelte-components.md   # Glob: *.svelte - Svelte 5 patterns
└── workflows/
    ├── build-component.md     # /build-component
    ├── verify-task.md         # /verify-task
    └── akg-query.md           # /akg subcommands
```

## Integration with Claude Code

This configuration enables smooth handoff between Claude Code CLI (backend/API work) and Windsurf/Cascade (UI component work):

1. **Shared state**: Both agents read/write to `.claude/state/` files
2. **Shared memory**: Both access the same MCP memory server
3. **Shared database**: Both query Supabase via MCP
4. **Shared architecture**: Both use AKG for architectural validation
5. **Coordinated tasks**: Task dependencies tracked in `current-phase.json`

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
pnpm biome:check    # Lint (or biome:fix to auto-fix)
pnpm web:vitest     # Tests
pnpm akg:check      # Architectural invariants
```

All-in-one:
```bash
pnpm check && pnpm biome:check && pnpm web:vitest && pnpm akg:check
```

## Layer Architecture (AKG Enforced)

```
routes      → components, stores, services, types, wasm
components  → components, types (NOT stores, services)
stores      → services, types, supabase (NOT components, routes)
services    → types, supabase, wasm (NOT components, routes, stores)
types       → types only
supabase    → types only
wasm        → types only
```

**Always use `akg_check_import` before adding imports!**

## Modern Patterns (2025)

- **Svelte 5 runes** - `$state`, `$derived`, `$effect` (not stores)
- **Biome** - Modern linter/formatter (not Prettier)
- **Vitest** - Fast test runner
- **MCP** - Shared context protocol across agents
- **AKG** - Architectural knowledge graph for layer enforcement
- **State-driven** - Task tracking in JSON files

## References

- Full project docs: `WINDSURF.md` or `CLAUDE.md`
- Agentic guardrails: `.claude/AGENT-GUARDRAILS.md`
- Conventions: `.claude/CONVENTIONS.md`
- UI/UX design: `docs/UI-UX-DESIGN-REPORT.md`
- Workflow docs: `.claude/workflow-orchestration.md`
- AKG docs: `docs/architecture/akg/`
