# MCP Configuration Status

**Last Updated**: 2025-12-03 15:36
**Status**: ✅ Configured and Ready

## Configuration Summary

### ✅ dicee-memory (Working)
- **Type**: stdio
- **Status**: Active
- **Storage**: `.claude/state/memory.jsonl`
- **Available in**: Claude Code, Windsurf/Cascade

### ✅ dicee-supabase (Configured)
- **Type**: http
- **Auth Method**: Personal Access Token via environment variable
- **Project**: `duhsbuyxyppgbkwbbtqg`
- **Features**: database, docs, edge-functions
- **Read-only**: false
- **Status**: Configured, awaiting Windsurf restart

## What Was Done

1. ✅ Token stored in gopass: `dicee/supabase/mcp-token`
2. ✅ Environment variable added to `~/.zshrc`
3. ✅ Windsurf MCP config created: `~/.codeium/windsurf/mcp_config.json`
4. ✅ Both servers configured (memory + supabase)

## Next Steps to Complete Setup

### 1. Load Environment Variable
```bash
# In your current terminal:
source ~/.zshrc

# Verify it's set:
echo $SUPABASE_MCP_TOKEN
# Should output: sbp_db31f7...
```

### 2. Restart Windsurf
- **Completely quit** Windsurf (Cmd+Q or Windsurf > Quit)
- **Relaunch** Windsurf
- **Open** the dicee project

### 3. Verify in Windsurf
1. Click **Windsurf Settings** (bottom right corner)
2. Navigate to: **Cascade > Plugins**
3. Look for **"dicee-supabase"** in the list
4. Should show **green indicator** = Connected
5. Click **"Manage plugins"** to see available tools

### 4. Test Supabase MCP
Ask Cascade:
```
Can you list the tables in my Supabase database?
```

Expected tools available:
- `list_tables`
- `execute_sql`
- `apply_migration`
- `generate_typescript_types`
- `create_branch`
- `list_functions`
- And more...

## Diagnostic Commands

### Quick Health Check
```bash
./scripts/diagnose-mcp.sh
```

### Manual Checks
```bash
# Check environment variable
echo $SUPABASE_MCP_TOKEN

# Check config file
cat ~/.codeium/windsurf/mcp_config.json | jq .

# Check token in gopass
gopass show dicee/supabase/mcp-token

# Verify shell config
grep SUPABASE_MCP_TOKEN ~/.zshrc
```

## Troubleshooting

### "dicee-supabase not showing in Plugins"

1. **Verify environment variable is set**:
   ```bash
   echo $SUPABASE_MCP_TOKEN
   ```
   If empty, run: `source ~/.zshrc`

2. **Restart Windsurf completely**:
   - Quit (Cmd+Q)
   - Relaunch from Applications or terminal

3. **Check config syntax**:
   ```bash
   jq . ~/.codeium/windsurf/mcp_config.json
   ```

### "Authentication failed"

1. **Check token is valid**:
   ```bash
   gopass show dicee/supabase/mcp-token
   ```

2. **Verify token at Supabase**:
   https://supabase.com/dashboard/account/tokens

3. **Regenerate if needed**:
   ```bash
   # Generate new token at Supabase dashboard
   gopass insert -f dicee/supabase/mcp-token
   ./scripts/setup-windsurf-mcp.sh
   ```

### "Environment variable not set after restart"

Windsurf needs to be launched from a shell that has the variable:

**Option A**: Launch from terminal
```bash
source ~/.zshrc
open -a Windsurf
```

**Option B**: Restart your Mac (ensures all apps get new env vars)

**Option C**: Use direct token method instead
```bash
./scripts/create-windsurf-mcp-config.sh
```

## Configuration Files

### Windsurf MCP Config
**Location**: `~/.codeium/windsurf/mcp_config.json`
**Contains**: Both dicee-memory and dicee-supabase servers
**Auth**: Uses `${SUPABASE_MCP_TOKEN}` environment variable

### Shell Configuration
**Location**: `~/.zshrc`
**Added**: `export SUPABASE_MCP_TOKEN=$(gopass show -o dicee/supabase/mcp-token 2>/dev/null || echo "")`

### Claude Code Config
**Location**: `.mcp.json` (project root)
**Contains**: Same servers, uses shell substitution `$(gopass ...)`
**Status**: Already working for Claude Code CLI

## Security Notes

- ✅ Token stored encrypted in gopass
- ✅ Token loaded via environment variable (not in config file)
- ✅ Config file in home directory (not version controlled)
- ✅ Project scoped to dicee database only
- ⚠️ Read-only mode disabled (needed for development)

## Token Rotation

When rotating the Supabase token:

1. Generate new token: https://supabase.com/dashboard/account/tokens
2. Update gopass:
   ```bash
   gopass insert -f dicee/supabase/mcp-token
   ```
3. Reload shell:
   ```bash
   source ~/.zshrc
   ```
4. Restart Windsurf

No need to re-run setup script!

## References

- Setup Guide: `.windsurf/MCP-SETUP-GUIDE.md`
- Fix Documentation: `.windsurf/SUPABASE-MCP-FIX.md`
- Original Setup: `.claude/SUPABASE-MCP-SETUP.md`
- Windsurf Docs: `temp-windsurf-config.md`
- Supabase MCP: https://supabase.com/docs/guides/ai/mcp
