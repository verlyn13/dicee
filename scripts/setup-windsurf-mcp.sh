#!/usr/bin/env bash
set -euo pipefail

# Setup Windsurf MCP for Supabase with PAT authentication
# This script configures environment variables and MCP config

echo "🔧 Setting up Windsurf MCP for Supabase..."

# Step 1: Get the token from gopass
echo "📝 Retrieving token from gopass..."
if ! command -v gopass &> /dev/null; then
    echo "❌ Error: gopass not found. Please install gopass first."
    exit 1
fi

TOKEN=$(gopass show -o dicee/supabase/mcp-token 2>/dev/null || echo "")
if [ -z "$TOKEN" ]; then
    echo "❌ Error: Token not found at dicee/supabase/mcp-token"
    echo "   Please store your Supabase PAT first:"
    echo "   gopass insert dicee/supabase/mcp-token"
    exit 1
fi

echo "✅ Token retrieved successfully"

# Step 2: Determine shell config file
SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_CONFIG="$HOME/.bash_profile"
else
    echo "⚠️  Warning: Could not find shell config file"
    echo "   Please manually add to your shell config:"
    echo "   export SUPABASE_MCP_TOKEN=\$(gopass show -o dicee/supabase/mcp-token)"
    SHELL_CONFIG=""
fi

# Step 3: Add environment variable to shell config
if [ -n "$SHELL_CONFIG" ]; then
    if grep -q "SUPABASE_MCP_TOKEN" "$SHELL_CONFIG"; then
        echo "✅ SUPABASE_MCP_TOKEN already in $SHELL_CONFIG"
    else
        echo "" >> "$SHELL_CONFIG"
        echo "# Supabase MCP Token for Windsurf/Cascade" >> "$SHELL_CONFIG"
        echo "export SUPABASE_MCP_TOKEN=\$(gopass show -o dicee/supabase/mcp-token 2>/dev/null || echo \"\")" >> "$SHELL_CONFIG"
        echo "✅ Added SUPABASE_MCP_TOKEN to $SHELL_CONFIG"
    fi
fi

# Step 4: Create/update Windsurf MCP config
MCP_CONFIG_DIR="$HOME/.codeium/windsurf"
MCP_CONFIG_FILE="$MCP_CONFIG_DIR/mcp_config.json"

echo "📝 Creating Windsurf MCP config..."
mkdir -p "$MCP_CONFIG_DIR"

# Create the config with environment variable substitution
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
    "dicee-supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg&read_only=false&features=database,docs,edge-functions",
      "headers": {
        "Authorization": "Bearer ${SUPABASE_MCP_TOKEN}"
      },
      "description": "Dicee Supabase database access via PAT"
    }
  }
}
EOF

echo "✅ Created $MCP_CONFIG_FILE"

# Step 5: Export for current session
export SUPABASE_MCP_TOKEN="$TOKEN"
echo "✅ Exported SUPABASE_MCP_TOKEN for current session"

# Step 6: Instructions
echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Restart your terminal (or run: source $SHELL_CONFIG)"
echo "2. Completely quit and restart Windsurf"
echo "3. Open the dicee project in Windsurf"
echo "4. Check Cascade > Plugins to verify 'dicee-supabase' is connected"
echo ""
echo "To verify the token is set:"
echo "  echo \$SUPABASE_MCP_TOKEN"
echo ""
echo "To test in Windsurf, ask Cascade:"
echo "  'Can you list the tables in my Supabase database?'"
