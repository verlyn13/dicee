# Build Component Workflow

**Command**: `/build-component`
**Purpose**: Create a new Svelte component following project patterns

## Steps

1. **Read task details**
   - Check `.claude/state/current-phase.json` for task details
   - Read the task's `file` path and `steps`
   - Note dependencies and design references

2. **Check dependencies**
   - If task has `dependencies`, verify those tasks are complete
   - Read any referenced files or components to understand patterns

3. **Read design specs** (if referenced)
   - Check `docs/UI-UX-DESIGN-REPORT.md` for component specifications
   - Note colors, spacing, typography requirements

4. **Create the component**
   - Use Svelte 5 runes syntax ($state, $derived, $effect)
   - Follow the structure in `.windsurf/rules/svelte-components.md`
   - Import types from `$lib/types/database.ts`
   - Use API functions from `$lib/supabase/profiles.ts` or `$lib/supabase/stats.ts`

5. **Create tests**
   - Co-locate in `__tests__/ComponentName.test.ts`
   - Test rendering, user interactions, edge cases
   - Mock Supabase client if needed

6. **Verify**
   ```bash
   pnpm check          # TypeScript check
   pnpm biome:fix      # Auto-fix linting
   pnpm test           # Run tests
   ```

7. **Update state**
   - Mark task as complete in `.claude/state/current-phase.json`
   - Update retry count if there were failures

8. **Report**
   - Summarize what was created
   - Note any blockers or deviations from task specs
   - Mention next task if dependencies are clear

## Three Strikes Rule

If any step fails 3 times, STOP and ask the human for guidance.
