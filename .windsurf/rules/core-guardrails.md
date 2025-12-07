# Core Guardrails

**Scope**: Always On
**Priority**: Critical

## Quick Reference

```
DICEE NAMING QUICK REF:
- Component files: PascalCase.svelte
- Callback props: onVerb (onRoll, onScore, onClose)  ← camelCase!
- DOM events: lowercase (onclick, onkeydown)         ← Svelte 5
- Handlers: handleVerb (handleRoll, handleKeyDown)
- Booleans: is/has/can prefix (isLoading, canScore)
- CSS classes: kebab-case (.game-container)
- CSS vars: --category-name (--color-accent)
- Imports: svelte → $app → $lib → relative → types
```

## Critical Rules

### 1. Three Strikes Rule (MANDATORY)

If you encounter the same error 3 times:
1. **STOP immediately**
2. List what you've tried
3. Ask for guidance
4. Do NOT try a 4th time

### 2. Read Before Edit

Before modifying any file:
1. Read `.claude/CONVENTIONS.md` for naming patterns
2. Check 2-3 similar components for existing patterns
3. Match existing patterns exactly

### 3. Use AKG Before Imports

**ALWAYS** use `akg_check_import` before adding import statements:
```
Before: import { game } from '$lib/stores/game.svelte';
Check:  akg_check_import(fromPath, toPath)
```

### 4. Event Handler Naming (CRITICAL)

| Context | Convention | Example |
|---------|------------|---------|
| **Native DOM events** (Svelte 5) | lowercase | `onclick`, `onkeydown` |
| **Component callback props** | camelCase | `onRoll`, `onClose`, `onScore` |
| **Internal handlers** | handleVerb | `handleRoll`, `handleKeyDown` |

```svelte
<!-- CORRECT -->
<button onclick={handleClick}>Roll</button>
<DiceTray onRoll={handleRoll} onToggleKeep={handleToggle} />

<!-- WRONG - Don't use lowercase for component props -->
<DiceTray onroll={handleRoll} />  <!-- ❌ -->
```

### 5. Verify Before Completing

Always run before marking work complete:
```bash
pnpm check        # TypeScript + Svelte
pnpm biome:check  # Lint
pnpm web:vitest   # Tests
```

## Layer Architecture (AKG Enforced)

```
routes      → components, stores, services, types, wasm
components  → components, types (NOT stores, services)
stores      → services, types, supabase (NOT components, routes)
services    → types, supabase, wasm (NOT components, routes, stores)
```

Use `akg_layer_rules` to check allowed imports for any layer.

## Project Context

- **Stack**: SvelteKit 2, Svelte 5 runes, TypeScript, Biome
- **Design**: Neo-Brutalist (see `docs/UI-UX-DESIGN-REPORT.md`)
- **State**: Svelte 5 runes (`$state`, `$derived`, `$effect`)
- **Testing**: Vitest with Testing Library
- **Architecture**: AKG-enforced layer boundaries

## MCP Tools Available

| Tool | Purpose |
|------|---------|
| `akg_check_import` | Validate import before writing |
| `akg_layer_rules` | Get layer import rules |
| `akg_node_info` | Get file's architectural role |
| `akg_invariant_status` | Check architecture health |
| `mcp0_search_nodes` | Search memory knowledge graph |
| `mcp1_execute_sql` | Query Supabase database |
| `mcp1_list_tables` | List database tables |

## References

- Full conventions: `.claude/CONVENTIONS.md`
- Agent guardrails: `.claude/AGENT-GUARDRAILS.md`
- Project docs: `WINDSURF.md` or `CLAUDE.md`
- AKG docs: `docs/architecture/akg/`
