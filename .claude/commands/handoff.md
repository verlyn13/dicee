# Generate Session Handoff

Create or update the session handoff document for the next agent.

## Instructions

1. Summarize what was accomplished this session by reviewing recent file changes

2. Update `.claude/state/session-handoff.md` with:
   - Current session info (agent, date, phase)
   - What was completed
   - What's in progress
   - Any blockers encountered
   - Next steps for the next agent
   - Important context/notes

3. Update `.claude/state/current-phase.json`:
   - Update task statuses
   - Set lastUpdated timestamp
   - Set lastAgent to "claude-code"

4. Confirm the handoff is ready

Use the existing handoff template format. Ask me what was accomplished if unclear.
