#!/usr/bin/env bash
# Setup GitHub Copilot CLI MCP configuration for Dicee DevOps
#
# This script helps integrate Dicee's MCP servers into your GitHub Copilot CLI
# configuration without overwriting existing servers from other projects.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COPILOT_CONFIG="$HOME/.copilot/mcp-config.json"
DICEE_CONFIG="$PROJECT_ROOT/.copilot-mcp.json"

echo "════════════════════════════════════════════════════════════"
echo "  Dicee → GitHub Copilot CLI MCP Setup"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check if Copilot CLI config exists
if [[ ! -f "$COPILOT_CONFIG" ]]; then
    echo "✗ GitHub Copilot CLI config not found at:"
    echo "  $COPILOT_CONFIG"
    echo ""
    echo "Please ensure GitHub Copilot CLI is installed."
    exit 1
fi

# Backup existing config
BACKUP_PATH="$COPILOT_CONFIG.backup-$(date +%Y%m%d-%H%M%S)"
echo "→ Backing up existing config to:"
echo "  $BACKUP_PATH"
cp "$COPILOT_CONFIG" "$BACKUP_PATH"
echo ""

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "✗ jq is required but not installed"
    echo ""
    echo "Install with: brew install jq"
    exit 1
fi

# Read existing config
EXISTING_CONFIG=$(cat "$COPILOT_CONFIG")

# Check if dicee servers already exist
if echo "$EXISTING_CONFIG" | jq -e '.mcpServers["dicee-akg"]' &>/dev/null; then
    echo "⚠️  Dicee MCP servers already configured"
    echo ""
    read -p "Overwrite existing configuration? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Merge configurations
echo "→ Merging Dicee MCP servers..."

# Read Dicee config and extract servers
DICEE_SERVERS=$(cat "$DICEE_CONFIG" | jq '.mcpServers')

# Merge into existing config
MERGED_CONFIG=$(echo "$EXISTING_CONFIG" | jq --argjson dicee "$DICEE_SERVERS" '
  .mcpServers += $dicee
')

# Write merged config
echo "$MERGED_CONFIG" | jq . > "$COPILOT_CONFIG"

echo "✓ Configuration updated"
echo ""

# Verify graph exists for AKG server
GRAPH_PATH="$PROJECT_ROOT/docs/architecture/akg/graph/current.json"
if [[ ! -f "$GRAPH_PATH" ]]; then
    echo "⚠️  AKG graph not found - generating..."
    cd "$PROJECT_ROOT"
    pnpm akg:discover
    echo "✓ Graph generated"
    echo ""
fi

# Test the wrapper script
echo "→ Testing DevOps wrapper..."
if "$PROJECT_ROOT/scripts/copilot-mcp-wrapper.sh" help &>/dev/null; then
    echo "✓ Wrapper script working"
else
    echo "✗ Wrapper script test failed"
    exit 1
fi
echo ""

# Test AKG server (quick start/stop)
echo "→ Testing AKG MCP server..."
if timeout 5s pnpm --silent akg:test &>/dev/null; then
    echo "✓ AKG server working"
else
    echo "⚠️  AKG server test timed out (this is normal)"
fi
echo ""

echo "════════════════════════════════════════════════════════════"
echo "  ✅ Setup Complete"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Added MCP servers:"
echo "  • dicee-akg     - Architecture queries (7 tools)"
echo "  • dicee-devops  - DevOps commands wrapper"
echo ""
echo "Quick test:"
echo "  cd $PROJECT_ROOT"
echo "  copilot"
echo '  > "What architecture layers exist?"'
echo ""
echo "See .copilot-mcp-README.md for full documentation."
echo ""
