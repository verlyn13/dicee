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

### 1. Read Before Edit

Before modifying any file:
1. Read `.claude/CONVENTIONS.md` for naming patterns
2. Check 2-3 similar components for existing patterns
3. Match existing patterns exactly

### 2. Event Handler Naming (CRITICAL)

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

### 3. Three Strikes Rule

If you encounter the same error 3 times:
1. Stop and summarize the issue
2. List what you've tried
3. Ask for guidance

### 4. Verify Before Completing

Always run before marking work complete:
```bash
pnpm check        # TypeScript + Svelte
pnpm biome:check  # Lint
pnpm web:vitest   # Tests
```

## Project Context

- **Stack**: SvelteKit 2, Svelte 5 runes, TypeScript, Biome
- **Design**: Neo-Brutalist (see `docs/UI-UX-DESIGN-REPORT.md`)
- **State**: Svelte 5 runes (`$state`, `$derived`, `$effect`)
- **Testing**: Vitest with Testing Library

## References

- Full conventions: `.claude/CONVENTIONS.md`
- Agent guardrails: `.claude/AGENT-GUARDRAILS.md`
- Project docs: `CLAUDE.md`
