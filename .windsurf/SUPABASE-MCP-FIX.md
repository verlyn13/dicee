# Supabase MCP Authentication Fix for Windsurf

**Problem**: OAuth method prompts repeatedly; PAT with shell substitution doesn't work
**Solution**: Use environment variable substitution that Windsurf supports

## Option 1: Environment Variable (Recommended)

### Step 1: Set Environment Variable

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
# Supabase MCP Token (loaded from gopass)
export SUPABASE_MCP_TOKEN=$(gopass show -o dicee/supabase/mcp-token)
```

Then reload:
```bash
source ~/.zshrc  # or ~/.bashrc
```

### Step 2: Update Windsurf MCP Config

File: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
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
```

### Step 3: Restart Windsurf

**Important**: Completely quit and restart Windsurf for environment variables to be picked up.

## Option 2: Direct Token (Less Secure)

If environment variables don't work, you can put the token directly in the config:

```json
{
  "mcpServers": {
    "dicee-supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg&read_only=false&features=database,docs,edge-functions",
      "headers": {
        "Authorization": "Bearer sbp_YOUR_ACTUAL_TOKEN_HERE"
      },
      "description": "Dicee Supabase database access via PAT"
    }
  }
}
```

**Security Note**: The `mcp_config.json` file should be in your home directory (`~/.codeium/windsurf/`), which is not version controlled.

## Option 3: Streamable HTTP with OAuth (Alternative)

According to Supabase docs, they support automatic OAuth with dynamic client registration:

```json
{
  "mcpServers": {
    "dicee-supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg&read_only=false&features=database,docs,edge-functions"
    }
  }
}
```

This should trigger OAuth **once** and cache the credentials. If it's prompting repeatedly, there may be a token caching issue.

## Verification

After configuration, verify in Windsurf:

1. Open Windsurf Settings (bottom right)
2. Navigate to: Cascade > Plugins
3. Look for "dicee-supabase" or "supabase" 
4. Should show as "Connected" with green indicator
5. Click "Manage plugins" to see available tools

Or ask Cascade:
```
Can you list the tables in my Supabase database?
```

## Troubleshooting

### Token Not Found
```bash
# Verify gopass has the token
gopass show dicee/supabase/mcp-token

# Should output: sbp_[long token string]
```

### Environment Variable Not Set
```bash
# Check if variable is set
echo $SUPABASE_MCP_TOKEN

# Should output the token value
```

### Windsurf Not Picking Up Environment Variables

Windsurf needs to be launched from a shell that has the environment variables set:

```bash
# Close Windsurf completely, then launch from terminal:
open -a Windsurf
```

Or add to your shell profile and restart your computer.

### Still Getting OAuth Prompts

If OAuth keeps prompting, check:
1. Token cache location: `~/.codeium/windsurf/` (may have oauth token files)
2. Clear any cached OAuth tokens
3. Try the PAT method instead

## Key Differences: Claude Code vs Windsurf

| Feature | Claude Code CLI | Windsurf/Cascade |
|---------|----------------|------------------|
| Shell commands | ✅ `$(command)` works | ❌ Not supported |
| Env variables | ✅ `${VAR}` works | ✅ `${VAR}` works |
| OAuth caching | ✅ Reliable | ⚠️ May prompt repeatedly |
| Config location | `.mcp.json` (project) | `~/.codeium/windsurf/mcp_config.json` (global) |

## References

- Windsurf MCP Docs: See `temp-windsurf-config.md`
- Supabase MCP Docs: https://supabase.com/docs/guides/ai/mcp
- Original setup: `.claude/SUPABASE-MCP-SETUP.md`
