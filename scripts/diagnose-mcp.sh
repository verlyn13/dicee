#!/usr/bin/env bash

# Diagnostic script for Windsurf MCP setup
# Run this to check if everything is configured correctly

echo "🔍 Windsurf MCP Diagnostic Tool"
echo "================================"
echo ""

# Check 1: gopass
echo "1️⃣  Checking gopass..."
if command -v gopass &> /dev/null; then
    echo "   ✅ gopass found: $(which gopass)"
    
    if gopass show dicee/supabase/mcp-token &> /dev/null; then
        TOKEN=$(gopass show -o dicee/supabase/mcp-token)
        if [ -n "$TOKEN" ]; then
            echo "   ✅ Token found in gopass (${#TOKEN} characters)"
            echo "   ✅ Token starts with: ${TOKEN:0:10}..."
        else
            echo "   ❌ Token is empty"
        fi
    else
        echo "   ❌ Token not found at dicee/supabase/mcp-token"
    fi
else
    echo "   ❌ gopass not found"
fi
echo ""

# Check 2: Environment variable
echo "2️⃣  Checking environment variable..."
if [ -n "$SUPABASE_MCP_TOKEN" ]; then
    echo "   ✅ SUPABASE_MCP_TOKEN is set (${#SUPABASE_MCP_TOKEN} characters)"
    echo "   ✅ Starts with: ${SUPABASE_MCP_TOKEN:0:10}..."
else
    echo "   ⚠️  SUPABASE_MCP_TOKEN not set"
    echo "   This is OK if using direct token method"
fi
echo ""

# Check 3: Shell config
echo "3️⃣  Checking shell configuration..."
SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
fi

if [ -n "$SHELL_CONFIG" ]; then
    echo "   ✅ Shell config: $SHELL_CONFIG"
    if grep -q "SUPABASE_MCP_TOKEN" "$SHELL_CONFIG"; then
        echo "   ✅ SUPABASE_MCP_TOKEN found in config"
    else
        echo "   ⚠️  SUPABASE_MCP_TOKEN not in config"
        echo "   This is OK if using direct token method"
    fi
else
    echo "   ⚠️  Shell config not found"
fi
echo ""

# Check 4: Windsurf MCP config
echo "4️⃣  Checking Windsurf MCP config..."
MCP_CONFIG="$HOME/.codeium/windsurf/mcp_config.json"

if [ -f "$MCP_CONFIG" ]; then
    echo "   ✅ Config file exists: $MCP_CONFIG"
    
    # Check if valid JSON
    if jq . "$MCP_CONFIG" &> /dev/null; then
        echo "   ✅ Valid JSON"
        
        # Check for dicee-supabase
        if jq -e '.mcpServers."dicee-supabase"' "$MCP_CONFIG" &> /dev/null; then
            echo "   ✅ dicee-supabase server configured"
            
            # Check auth method
            if jq -e '.mcpServers."dicee-supabase".headers.Authorization' "$MCP_CONFIG" &> /dev/null; then
                AUTH=$(jq -r '.mcpServers."dicee-supabase".headers.Authorization' "$MCP_CONFIG")
                if [[ "$AUTH" == *'${SUPABASE_MCP_TOKEN}'* ]]; then
                    echo "   ✅ Using environment variable method"
                elif [[ "$AUTH" == *'sbp_'* ]]; then
                    echo "   ✅ Using direct token method"
                else
                    echo "   ⚠️  Unknown auth method: $AUTH"
                fi
            else
                echo "   ⚠️  No Authorization header found"
            fi
        else
            echo "   ❌ dicee-supabase not found in config"
        fi
        
        # Check for dicee-memory
        if jq -e '.mcpServers."dicee-memory"' "$MCP_CONFIG" &> /dev/null; then
            echo "   ✅ dicee-memory server configured"
        else
            echo "   ⚠️  dicee-memory not found in config"
        fi
    else
        echo "   ❌ Invalid JSON in config file"
    fi
else
    echo "   ❌ Config file not found"
    echo "   Expected: $MCP_CONFIG"
fi
echo ""

# Check 5: Project .mcp.json (Claude Code)
echo "5️⃣  Checking Claude Code config..."
PROJECT_MCP="/Users/verlyn13/Development/personal/dicee/.mcp.json"

if [ -f "$PROJECT_MCP" ]; then
    echo "   ✅ Project .mcp.json exists"
    if jq -e '.mcpServers.supabase' "$PROJECT_MCP" &> /dev/null; then
        echo "   ✅ Supabase configured for Claude Code"
    fi
else
    echo "   ⚠️  No .mcp.json in project"
fi
echo ""

# Summary
echo "📊 Summary"
echo "=========="
echo ""

ISSUES=0

if ! command -v gopass &> /dev/null; then
    echo "❌ gopass not installed"
    ((ISSUES++))
fi

if ! gopass show dicee/supabase/mcp-token &> /dev/null; then
    echo "❌ Token not in gopass"
    ((ISSUES++))
fi

if [ ! -f "$MCP_CONFIG" ]; then
    echo "❌ Windsurf MCP config missing"
    ((ISSUES++))
elif ! jq . "$MCP_CONFIG" &> /dev/null; then
    echo "❌ Windsurf MCP config invalid"
    ((ISSUES++))
elif ! jq -e '.mcpServers."dicee-supabase"' "$MCP_CONFIG" &> /dev/null; then
    echo "❌ dicee-supabase not configured"
    ((ISSUES++))
fi

if [ $ISSUES -eq 0 ]; then
    echo "✅ All checks passed!"
    echo ""
    echo "Next steps:"
    echo "1. Quit Windsurf completely (Cmd+Q)"
    echo "2. Restart Windsurf"
    echo "3. Open dicee project"
    echo "4. Check Cascade > Plugins for 'dicee-supabase'"
else
    echo "⚠️  Found $ISSUES issue(s)"
    echo ""
    echo "Run one of these to fix:"
    echo "  ./scripts/setup-windsurf-mcp.sh           # Environment variable method"
    echo "  ./scripts/create-windsurf-mcp-config.sh   # Direct token method"
fi
