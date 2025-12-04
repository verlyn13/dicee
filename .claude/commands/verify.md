# Verify Task Completion

Verify that a specific task is complete before marking it done.

## Usage

`/verify [task-id]` - Verify a specific task (e.g., `/verify profile-1`)
`/verify` - Verify the current in-progress task

## Instructions

1. **Identify the task** from `.claude/state/current-phase.json`
   - Read the task's `verification` field
   - Read the task's `steps` field

2. **Run verification checks**:
   - If `verification.tests` exists: Run the test command
   - If `verification.typecheck` is true: Run `pnpm typecheck`
   - If `verification.lint` is true: Run `pnpm lint`
   - If `verification.build` exists: Run the build command
   - If `verification.visual` exists: Note it needs manual check

3. **Check the file exists** at the specified `file` path

4. **Report results**:

```markdown
## Task Verification: [task-id]

**Task**: [title]
**File**: [file path]

### Checks
- [ ] File exists: [yes/no]
- [ ] Tests pass: [result or N/A]
- [ ] TypeScript clean: [result or N/A]
- [ ] Lint clean: [result or N/A]
- [ ] Build succeeds: [result or N/A]

### Steps Completed
- [x] Step 1
- [x] Step 2
- [ ] Step 3 (not done)

### Verdict
[PASSED - Ready to mark complete] or [FAILED - Issues found]

### Issues (if any)
- [List any problems found]
```

5. **If PASSED**: Offer to update task status to "complete"

6. **If FAILED**:
   - Increment `retryCount` in task
   - If `retryCount >= maxRetries`: Report "Three strikes - need human help"
   - Otherwise: Suggest specific fixes

Execute this verification now.
