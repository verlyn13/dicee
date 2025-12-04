# Update Phase Status

Update the current phase status. Provide an action: `complete`, `block [reason]`, or `start [phase-name]`.

## Usage

- `/phase complete` - Mark current phase as complete, show next phase
- `/phase block [reason]` - Mark phase as blocked with reason
- `/phase start phase-3` - Start working on a specific phase

## Instructions

Based on the action provided:

### `complete`
1. Run quality gate first (`./scripts/quality-gate.sh`)
2. If passes, update `.claude/state/current-phase.json`:
   - Set current phase status to "complete"
   - Set completedAt timestamp
   - Move to next phase
3. Update `.claude/state/decisions.json` with completion decision
4. Announce phase transition

### `block [reason]`
1. Update `.claude/state/current-phase.json` status to "blocked"
2. Add blocker to `.claude/state/blockers.json`
3. Report the blocker and ask for guidance

### `start [phase-name]`
1. Verify previous phases are complete
2. Update currentPhase in state
3. Show tasks for the new phase

If no action provided, show current phase status and available actions.
