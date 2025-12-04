# Supabase MCP Authentication Setup

**Status**: ✅ Configured
**Date**: 2025-12-03
**Authentication Method**: Personal Access Token (PAT) via gopass

## What Was Changed

### 1. Token Storage (gopass)
```bash
# Token stored at:
dicee/supabase/mcp-token

# Verify:
gopass show -o dicee/supabase/mcp-token
```

### 2. Windsurf MCP Config
**File**: `~/.codeium/windsurf/mcp_config.json`

**Before** (browser OAuth - prompted every session):
```json
"dicee-supabase": {
  "serverUrl": "https://mcp.supabase.com/mcp?...",
  "description": "..."
}
```

**After** (PAT via gopass - no prompts):
```json
"dicee-supabase": {
  "type": "http",
  "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg&read_only=false&features=database,docs,edge-functions",
  "headers": {
    "Authorization": "Bearer $(gopass show -o dicee/supabase/mcp-token)"
  },
  "description": "Dicee Supabase database access - uses gopass for PAT auth"
}
```

### 3. Claude Code MCP Config
**File**: `.mcp.json`

**Updated** to match Windsurf pattern:
```json
"supabase": {
  "type": "http",
  "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg&read_only=false&features=database,docs,edge-functions",
  "headers": {
    "Authorization": "Bearer $(gopass show -o dicee/supabase/mcp-token)"
  }
}
```

### 4. Documentation Updated
**File**: `.claude/gopass-structure.yaml`

Added to `supabase.credentials`:
```yaml
- path: "dicee/supabase/mcp-token"
  value: "[STORED]"
  description: "Personal Access Token for MCP server authentication (Windsurf/Claude Code)"
  sensitive: true
  usage: "Enables persistent auth for MCP clients without browser OAuth"
```

## How It Works

1. **MCP client starts** (Windsurf or Claude Code)
2. **Reads config** with `$(gopass show -o dicee/supabase/mcp-token)` command
3. **Executes gopass** to retrieve token
4. **Sends token** in Authorization header to Supabase MCP server
5. **Authentication succeeds** - no browser prompt needed

## Verification Steps

### Test in Windsurf

1. **Close Windsurf** completely
2. **Restart Windsurf**
3. **Open dicee project**
4. **Check Cascade plugins** - dicee-supabase should show as connected
5. **No browser prompt** should appear for authentication

### Test in Claude Code CLI

```bash
# List available MCP servers
claude mcp list

# Should show:
# - memory (stdio)
# - supabase (http) - connected
```

### Verify Token Retrieval

```bash
# Test the gopass command directly
gopass show -o dicee/supabase/mcp-token

# Should output: sbp_[rest of token]
```

## Troubleshooting

### "Authentication failed" error

1. Verify token is stored:
   ```bash
   gopass show dicee/supabase/mcp-token
   ```

2. Check token is valid at:
   https://supabase.com/dashboard/account/tokens

3. Regenerate if expired

### "Command not found: gopass"

Windsurf/Claude Code needs gopass in PATH:
```bash
which gopass
# Should output: /opt/homebrew/bin/gopass (or similar)
```

### Still prompting for auth

1. Check the MCP config syntax (no typos in path)
2. Restart the MCP client completely
3. Verify gopass command works from terminal

## Security Notes

- **Token scope**: All scopes (required for MCP)
- **Storage**: Local gopass (encrypted)
- **Read-only mode**: Disabled (allows writes for development)
- **Project scoped**: Yes (duhsbuyxyppgbkwbbtqg only)

## Token Rotation

When rotating the token:

1. Generate new token at: https://supabase.com/dashboard/account/tokens
2. Update gopass:
   ```bash
   gopass insert -f dicee/supabase/mcp-token
   ```
3. Restart Windsurf/Claude Code
4. No config changes needed

## References

- Supabase MCP Docs: https://supabase.com/docs/guides/ai/mcp
- Gopass Structure: `.claude/gopass-structure.yaml`
- Windsurf MCP Docs: (See user's Cascade documentation)
