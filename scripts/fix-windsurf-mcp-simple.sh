#!/usr/bin/env bash
set -euo pipefail

# Fix Windsurf MCP config to use simple URL method (no auth headers)
# This matches the official Supabase documentation

echo "🔧 Updating Windsurf MCP config to simple URL method..."

MCP_CONFIG_DIR="$HOME/.codeium/windsurf"
MCP_CONFIG_FILE="$MCP_CONFIG_DIR/mcp_config.json"

mkdir -p "$MCP_CONFIG_DIR"

# Create the simplified config (OAuth will be handled automatically)
cat > "$MCP_CONFIG_FILE" << 'EOF'
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
      "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg"
    }
  }
}
EOF

echo "✅ Updated $MCP_CONFIG_FILE"
echo ""
echo "This configuration uses Supabase's automatic OAuth authentication."
echo "When you first use Supabase MCP tools, you'll be prompted to authenticate once."
echo ""
echo "Next steps:"
echo "1. Completely quit Windsurf (Cmd+Q)"
echo "2. Restart Windsurf"
echo "3. Open dicee project"
echo "4. Check Cascade > Plugins for 'supabase'"
echo "5. First use will trigger OAuth login (one time only)"
