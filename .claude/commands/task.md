# Work on a Task

Pick up and work on a specific task from the current phase.

## Usage

`/task [task-id]` - Start working on a specific task (e.g., `/task profile-1`)
`/task next` - Pick up the next available task
`/task` - Show available tasks

## Instructions

### If no argument or showing tasks:

1. Read `.claude/state/current-phase.json`
2. List tasks with their status, assigned agent, and dependencies
3. Highlight which tasks are available (dependencies met, not blocked)

### If starting a task:

1. **Read the task details** from current-phase.json

2. **Check prerequisites**:
   - Are all dependency tasks complete?
   - Is this task assigned to me (or unassigned)?
   - Is there a blocker?

3. **If prerequisites not met**: Report and suggest which task to do instead

4. **If prerequisites met**:

   a. **Read the AGENT-GUARDRAILS.md first**:
   ```markdown
   REMINDER: Three Strikes Rule is active.
   - 3 failed attempts at same goal = STOP and ask human
   - Read before edit
   - Verify after every change
   ```

   b. **Update task status** to "in-progress" in current-phase.json

   c. **Display the task card**:
   ```markdown
   ## Starting Task: [task-id]

   **Title**: [title]
   **File**: [file path]
   **Agent Level**: [opus/any]
   **Retry Count**: [0/3]

   ### Steps to Complete
   1. [Step 1]
   2. [Step 2]
   ...

   ### Verification Required
   - Tests: [command or N/A]
   - TypeScript: [yes/no]
   - Lint: [yes/no]

   ### References
   - Design: [designRef if any]
   - Dependencies: [list completed dependencies]

   ---

   Beginning work on step 1...
   ```

   d. **Execute each step** in order

   e. **After each step**: Verify before proceeding

   f. **On completion**: Run `/verify [task-id]`

### Error Handling

If any step fails:
1. Increment the retry count
2. Try again with a different approach
3. After 3 failures: STOP and report

```markdown
## I Need Human Help

**Task**: [task-id]
**Step**: [which step failed]
**Attempts**: 3/3

**What I tried**:
1. [Approach 1 and result]
2. [Approach 2 and result]
3. [Approach 3 and result]

Please advise.
```

Execute this command now.
