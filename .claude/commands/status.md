# Show Project Status

Display the current project phase, tasks, and any blockers.

## Instructions

Read and display the project status from state files:

1. Read `.claude/state/current-phase.json`:
   - Show current phase name and status
   - List completed phases
   - Show next tasks for current phase

2. Read `.claude/state/blockers.json`:
   - Show any active blockers

3. Read `.claude/state/session-handoff.md`:
   - Show last agent and timestamp
   - Show any important notes

Format output clearly as:
```
## Project Status

**Current Phase**: [name] ([status])
**Completed**: [list of completed phases]
**Last Agent**: [agent] at [time]

### Current Phase Tasks
- [ ] task 1
- [ ] task 2
...

### Blockers
[any active blockers or "None"]

### Notes
[key notes from handoff]
```

Execute this now - read the state files and display the status.
