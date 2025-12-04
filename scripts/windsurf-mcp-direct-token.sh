#!/usr/bin/env bash
set -euo pipefail

# Use direct PAT token in Windsurf config (no OAuth, no env vars)
# This is the most reliable method when OAuth is broken

echo "🔧 Configuring Windsurf MCP with direct PAT token..."

# Get token from gopass
if ! command -v gopass &> /dev/null; then
    echo "❌ Error: gopass not found"
    exit 1
fi

TOKEN=$(gopass show -o dicee/supabase/mcp-token 2>/dev/null || echo "")
if [ -z "$TOKEN" ]; then
    echo "❌ Error: Token not found at dicee/supabase/mcp-token"
    echo ""
    echo "Please create a Supabase Personal Access Token:"
    echo "1. Visit: https://supabase.com/dashboard/account/tokens"
    echo "2. Click 'Generate new token'"
    echo "3. Name it: 'Windsurf MCP'"
    echo "4. Select ALL scopes"
    echo "5. Copy the token"
    echo "6. Store it: gopass insert dicee/supabase/mcp-token"
    exit 1
fi

echo "✅ Token retrieved from gopass"

# Create config directory
MCP_CONFIG_DIR="$HOME/.codeium/windsurf"
MCP_CONFIG_FILE="$MCP_CONFIG_DIR/mcp_config.json"

mkdir -p "$MCP_CONFIG_DIR"

# Create config with direct token
cat > "$MCP_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "dicee-memory": {
      "command": "node",
      "args": [
        "/Users/verlyn13/Development/personal/dicee/node_modules/@modelcontextprotocol/server-memory/dist/index.js"
      ],
      "env": {
        "MEMORY_FILE_PATH": "/Users/verlyn13/Development/personal/dicee/.claude/state/memory.jsonl"
      },
      "description": "Shared memory server for dicee project"
    },
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg",
      "headers": {
        "Authorization": "Bearer ${TOKEN}"
      }
    }
  }
}
EOF

echo "✅ Created $MCP_CONFIG_FILE with direct token"
echo ""
echo "⚠️  Security note:"
echo "   - Token is stored in: $MCP_CONFIG_FILE"
echo "   - This file is in your home directory (not version controlled)"
echo "   - File permissions: $(ls -l "$MCP_CONFIG_FILE" | awk '{print $1}')"
echo ""
echo "✅ Configuration complete!"
echo ""
echo "Next steps:"
echo "1. Quit Windsurf completely (Cmd+Q)"
echo "2. Restart Windsurf"
echo "3. Open dicee project"
echo "4. NO OAuth prompts should appear"
echo "5. Supabase MCP should just work"
echo ""
echo "To verify config:"
echo "  cat $MCP_CONFIG_FILE | jq ."
