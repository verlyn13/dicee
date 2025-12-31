#!/usr/bin/env bash
# Dicee AKG MCP Server - direnv-gated wrapper for Windsurf/Copilot/Codex
# Only starts when DICEE_MCP_ENABLED=true (set by .envrc in project)

set -euo pipefail

# Exit silently if not in Dicee project
if [ "${DICEE_MCP_ENABLED:-false}" != "true" ]; then
    exit 0
fi

# Navigate to Dicee project root (where .envrc set the flag)
cd "${DICEE_PROJECT_ROOT:?DICEE_PROJECT_ROOT not set}"

# Set AKG environment variables
export AKG_GRAPH_PATH="$DICEE_PROJECT_ROOT/docs/architecture/akg/graph/current.json"
export AKG_DIAGRAMS_PATH="$DICEE_PROJECT_ROOT/docs/architecture/akg/diagrams"
export AKG_PROJECT_ROOT="$DICEE_PROJECT_ROOT"

# Start AKG MCP server (requires bun)
exec bun run "$DICEE_PROJECT_ROOT/packages/web/src/tools/akg/mcp/server.ts"
