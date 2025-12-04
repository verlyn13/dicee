# Verify Task Workflow

**Command**: `/verify-task`
**Purpose**: Verify a task is complete and meets quality standards

## Steps

1. **Read task details**
   ```bash
   cat .claude/state/current-phase.json
   ```
   - Find the task by ID
   - Check its `verification` requirements

2. **Run verification checks**

   For all tasks:
   ```bash
   pnpm check          # TypeScript + Svelte check
   pnpm biome:check    # Linting
   ```

   If task has `verification.tests`:
   ```bash
   pnpm test -- [test-pattern]
   ```

   If task has `verification.build`:
   ```bash
   pnpm build
   ```

3. **Manual verification** (if specified)
   - Check `verification.visual` requirements
   - Verify `verification.manual` steps
   - Report what was manually checked

4. **Update task status**
   - If all checks pass: mark task as complete
   - If checks fail: increment retry count
   - Update `.claude/state/current-phase.json`

5. **Report results**
   - ✅ List passed checks
   - ❌ List failed checks (if any)
   - Summary of what was verified

## Three Strikes Rule

If verification fails 3 times:
- STOP retrying
- Document the failures
- Ask human for guidance
