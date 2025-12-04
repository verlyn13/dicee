# Windsurf MCP Setup Guide

**Goal**: Get Supabase MCP working reliably in Windsurf/Cascade without repeated OAuth prompts

## The Problem

- **OAuth method**: Prompts repeatedly, unreliable
- **Shell substitution**: `$(gopass show ...)` doesn't work in Windsurf configs
- **Solution**: Use environment variables or direct token

## Quick Start (Choose One Method)

### Method 1: Environment Variable (Recommended)

**Pros**: Secure, token not in config file, works across restarts
**Cons**: Requires shell configuration

```bash
# Run the setup script
./scripts/setup-windsurf-mcp.sh

# Then:
# 1. Restart your terminal
# 2. Quit and restart Windsurf
# 3. Verify in Cascade > Plugins
```

### Method 2: Direct Token (Simpler)

**Pros**: Simple, no shell config needed
**Cons**: Token stored in config file (still in home directory, not version controlled)

```bash
# Run the config creator
./scripts/create-windsurf-mcp-config.sh

# Then:
# 1. Quit and restart Windsurf
# 2. Verify in Cascade > Plugins
```

## What Gets Configured

Both methods create: `~/.codeium/windsurf/mcp_config.json`

With two MCP servers:
1. **dicee-memory** (stdio) - Shared knowledge graph
2. **dicee-supabase** (http) - Database access via PAT

## Verification Steps

### 1. Check Config File Exists
```bash
cat ~/.codeium/windsurf/mcp_config.json
```

### 2. Check Environment Variable (Method 1 only)
```bash
echo $SUPABASE_MCP_TOKEN
# Should output: sbp_[token]
```

### 3. In Windsurf
1. Open Windsurf Settings (bottom right corner)
2. Go to: Cascade > Plugins
3. Look for "dicee-supabase" - should show as connected
4. Click "Manage plugins" to see available tools

### 4. Test in Cascade
Ask Cascade:
```
Can you list the tables in my Supabase database?
```

Should see tools like:
- `list_tables`
- `execute_sql`
- `generate_typescript_types`
- etc.

## Troubleshooting

### "dicee-supabase not found in plugins"

**Check 1**: Config file location
```bash
ls -la ~/.codeium/windsurf/mcp_config.json
```

**Check 2**: Windsurf completely restarted
- Quit Windsurf (Cmd+Q)
- Relaunch from Applications or terminal

**Check 3**: JSON syntax valid
```bash
jq . ~/.codeium/windsurf/mcp_config.json
```

### "Authentication failed" error

**Check 1**: Token is valid
```bash
gopass show dicee/supabase/mcp-token
```

**Check 2**: Token not expired
- Visit: https://supabase.com/dashboard/account/tokens
- Verify token exists and has all scopes

**Check 3**: Environment variable set (Method 1)
```bash
echo $SUPABASE_MCP_TOKEN
```

If empty, restart terminal or run:
```bash
source ~/.zshrc  # or ~/.bashrc
```

### "Still getting OAuth prompts"

This means Windsurf is not reading your config properly:

1. **Verify config location**:
   ```bash
   # Should be in home directory, not project
   ls ~/.codeium/windsurf/mcp_config.json
   ```

2. **Check for conflicting configs**:
   ```bash
   # Remove any project-level Windsurf MCP configs
   rm -f .windsurf/mcp_config.json  # if exists
   ```

3. **Try direct token method** (Method 2)

### Environment variable not working

If Method 1 doesn't work, Windsurf may not be picking up environment variables:

**Option A**: Launch Windsurf from terminal
```bash
# Export variable first
export SUPABASE_MCP_TOKEN=$(gopass show -o dicee/supabase/mcp-token)

# Then launch
open -a Windsurf
```

**Option B**: Use Method 2 (direct token)

## Security Notes

### Method 1 (Environment Variable)
- Token loaded from gopass at shell startup
- Not stored in any config file
- Requires gopass to be installed and working
- Token in memory only while shell is running

### Method 2 (Direct Token)
- Token stored in `~/.codeium/windsurf/mcp_config.json`
- File is in home directory (not version controlled)
- File permissions should be 600 (user read/write only)
- Still more secure than OAuth that doesn't work

### Token Rotation

When you need to rotate the token:

1. Generate new token: https://supabase.com/dashboard/account/tokens
2. Update gopass:
   ```bash
   gopass insert -f dicee/supabase/mcp-token
   ```
3. Re-run setup script:
   ```bash
   ./scripts/setup-windsurf-mcp.sh  # or create-windsurf-mcp-config.sh
   ```
4. Restart Windsurf

## Comparison: Claude Code vs Windsurf

| Feature | Claude Code | Windsurf |
|---------|-------------|----------|
| Config location | `.mcp.json` (project) | `~/.codeium/windsurf/mcp_config.json` (global) |
| Shell commands | ✅ `$(command)` | ❌ Not supported |
| Env variables | ✅ `${VAR}` | ✅ `${VAR}` |
| OAuth | ✅ Reliable | ⚠️ Prompts repeatedly |
| PAT auth | ✅ Works | ✅ Works (with env var or direct) |

## Available Supabase MCP Tools

Once connected, you'll have access to:

### Database Tools
- `list_tables` - List all tables in database
- `execute_sql` - Run SQL queries
- `apply_migration` - Apply schema migrations
- `generate_typescript_types` - Generate types from schema

### Development Tools
- `create_branch` - Create database branch
- `merge_branch` - Merge branch to main
- `reset_branch` - Reset branch state

### Edge Functions
- `list_functions` - List edge functions
- `deploy_function` - Deploy edge function
- `invoke_function` - Test function

### Documentation
- `search_docs` - Search Supabase docs
- `get_doc` - Get specific doc page

## References

- Windsurf MCP Docs: `temp-windsurf-config.md`
- Supabase MCP Docs: https://supabase.com/docs/guides/ai/mcp
- Fix guide: `.windsurf/SUPABASE-MCP-FIX.md`
- Original setup: `.claude/SUPABASE-MCP-SETUP.md`
