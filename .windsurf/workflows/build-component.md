# Build Component Workflow

**Command**: `/build-component`
**Purpose**: Create a new Svelte component following project patterns and AKG layer rules

## Steps

1. **Read task details**
   - Check `.claude/state/current-phase.json` for task details
   - Read the task's `file` path and `steps`
   - Note dependencies and design references

2. **Check dependencies**
   - If task has `dependencies`, verify those tasks are complete
   - Read any referenced files or components to understand patterns

3. **Validate layer placement with AKG**
   - Use `akg_layer_rules` to understand what the target layer can import
   - Example: If creating a component, know it can only import from `components` and `types`

4. **Read design specs** (if referenced)
   - Check `docs/UI-UX-DESIGN-REPORT.md` for component specifications
   - Note colors, spacing, typography requirements

5. **Create the component**
   - Use Svelte 5 runes syntax ($state, $derived, $effect)
   - Follow the structure in `.windsurf/rules/svelte-components.md`
   - **Before each import**: Use `akg_check_import` to validate
   - Import types from `$lib/types/database.ts`
   - Use design tokens from `$lib/styles/tokens.css`

6. **Create tests**
   - Co-locate in `__tests__/ComponentName.test.ts`
   - Test rendering, user interactions, edge cases
   - Mock Supabase client if needed

7. **Verify**
   ```bash
   pnpm check          # TypeScript check
   pnpm biome:check    # Lint check (auto-fix with biome:fix)
   pnpm web:vitest     # Run tests
   pnpm akg:check      # Verify no architectural violations
   ```

8. **Update state**
   - Mark task as complete in `.claude/state/current-phase.json`
   - Update retry count if there were failures

9. **Report**
   - Summarize what was created
   - Note any blockers or deviations from task specs
   - Mention next task if dependencies are clear

## AKG Integration

### Before Adding Any Import

```
akg_check_import:
  fromPath: "packages/web/src/lib/components/[new-component].svelte"
  toPath: "[target-module-path]"
```

### If Import is Forbidden

Do NOT add the import. Instead:
1. Pass data as props from parent
2. Use dependency injection pattern
3. Ask human for architectural guidance

### After Component Complete

Run `pnpm akg:check` to ensure no invariant violations were introduced.

## Three Strikes Rule

If any step fails 3 times, STOP and ask the human for guidance.

## Example: Creating a ScoreCard Component

```bash
# 1. Check layer rules
akg_layer_rules: layer="components"
# Result: mayImport=["components", "types"], mayNotImport=["stores", "services"]

# 2. Validate imports before writing
akg_check_import:
  fromPath: "packages/web/src/lib/components/game/ScoreCard.svelte"
  toPath: "packages/web/src/lib/types/index.ts"
# Result: allowed=true

# 3. Create component with validated imports only

# 4. Run verification
pnpm check && pnpm biome:check && pnpm web:vitest && pnpm akg:check
```
