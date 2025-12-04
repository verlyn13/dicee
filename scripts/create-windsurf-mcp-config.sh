#!/usr/bin/env bash
set -euo pipefail

# Create Windsurf MCP config with direct token (simpler but less secure)
# Use this if environment variable method doesn't work

echo "🔧 Creating Windsurf MCP config with direct token..."

# Get the token
if ! command -v gopass &> /dev/null; then
    echo "❌ Error: gopass not found"
    exit 1
fi

TOKEN=$(gopass show -o dicee/supabase/mcp-token 2>/dev/null || echo "")
if [ -z "$TOKEN" ]; then
    echo "❌ Error: Token not found at dicee/supabase/mcp-token"
    exit 1
fi

# Create config directory
MCP_CONFIG_DIR="$HOME/.codeium/windsurf"
MCP_CONFIG_FILE="$MCP_CONFIG_DIR/mcp_config.json"

mkdir -p "$MCP_CONFIG_DIR"

# Create config with actual token value
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
    "dicee-supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg&read_only=false&features=database,docs,edge-functions",
      "headers": {
        "Authorization": "Bearer ${TOKEN}"
      },
      "description": "Dicee Supabase database access via PAT (direct token)"
    }
  }
}
EOF

echo "✅ Created $MCP_CONFIG_FILE"
echo ""
echo "⚠️  Security note: Token is stored directly in config file"
echo "   File location: $MCP_CONFIG_FILE"
echo "   This file is in your home directory (not version controlled)"
echo ""
echo "Next steps:"
echo "1. Completely quit and restart Windsurf"
echo "2. Open the dicee project"
echo "3. Check Cascade > Plugins to verify 'dicee-supabase' is connected"
