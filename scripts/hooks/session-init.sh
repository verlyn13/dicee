#!/usr/bin/env bash
# Session Initialization Hook
# Loads current project state at session start

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-/Users/verlyn13/Development/personal/dicee}"
AGENT_NAME="${AGENT_NAME:-claude-code}"
cd "$PROJECT_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE=".claude/state/tool-log.jsonl"

# Log session start to tool log (not memory.jsonl - owned by MCP)
echo "{\"type\":\"session_start\",\"timestamp\":\"$TIMESTAMP\",\"agent\":\"$AGENT_NAME\"}" >> "$LOG_FILE"

# Show current phase (to stderr so it appears in hook output)
if [ -f .claude/state/current-phase.json ]; then
    PHASE=$(jq -r '.currentPhase // "unknown"' .claude/state/current-phase.json 2>/dev/null || echo "unknown")
    echo "Session started | Phase: $PHASE" >&2
fi

# Check for blockers
if [ -f .claude/state/blockers.json ]; then
    BLOCKER_COUNT=$(jq '.blockers | length' .claude/state/blockers.json 2>/dev/null || echo "0")
    if [ "$BLOCKER_COUNT" -gt "0" ]; then
        echo "Warning: $BLOCKER_COUNT active blocker(s)" >&2
    fi
fi

exit 0
