#!/usr/bin/env bash
# Dicee Memory MCP Server - direnv-gated wrapper for Windsurf/Copilot/Codex
# Only starts when DICEE_MCP_ENABLED=true (set by .envrc in project)

set -euo pipefail

# Exit silently if not in Dicee project
if [ "${DICEE_MCP_ENABLED:-false}" != "true" ]; then
    exit 0
fi

# Navigate to Dicee project root (where .envrc set the flag)
cd "${DICEE_PROJECT_ROOT:?DICEE_PROJECT_ROOT not set}"

# Set memory file path
export MEMORY_FILE_PATH="$DICEE_PROJECT_ROOT/.claude/state/memory.jsonl"

# Start Memory MCP server
exec node "$DICEE_PROJECT_ROOT/node_modules/@modelcontextprotocol/server-memory/dist/index.js"
