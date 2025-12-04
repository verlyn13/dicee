# Windsurf MCP: OAuth is Broken - Use Direct PAT Instead

**Date**: 2025-12-03 16:41
**Issue**: Windsurf OAuth flow prompts repeatedly and doesn't cache credentials
**Root Cause**: Windsurf MCP OAuth implementation is broken/incomplete
**Solution**: Use direct Personal Access Token in config

## The Problem

### What We Tried (All Failed)

1. **Simple OAuth URL** (Official Supabase method)
   - Config: `{"url": "https://mcp.supabase.com/..."}`
   - Result: ❌ Prompted **4+ times** to authenticate
   - Issue: Windsurf doesn't cache OAuth tokens properly

2. **PAT with Environment Variable**
   - Config: `{"headers": {"Authorization": "Bearer ${SUPABASE_MCP_TOKEN}"}}`
   - Result: ❌ Windsurf doesn't load environment variables
   - Issue: Env vars not available to Windsurf process

3. **PAT with Shell Substitution**
   - Config: `{"headers": {"Authorization": "Bearer $(gopass show ...)"}}`
   - Result: ❌ Shell commands not executed
   - Issue: Windsurf doesn't support shell command substitution

### What Works

**Direct PAT Token in Config**
- Config: `{"headers": {"Authorization": "Bearer sbp_actual_token_here"}}`
- Result: ✅ **No OAuth prompts, just works**
- Trade-off: Token in config file (but still secure - in home directory)

## Current Configuration

**File**: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "dicee-memory": {
      "command": "node",
      "args": [
        "/Users/verlyn13/Development/personal/dicee/node_modules/@modelcontextprotocol/server-memory/dist/index.js"
      ],
      "env": {
        "MEMORY_FILE_PATH": "/Users/verlyn13/Development/personal/dicee/.claude/state/memory.jsonl"
      }
    },
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg",
      "headers": {
        "Authorization": "Bearer [YOUR_ACTUAL_TOKEN_HERE]"
      }
    }
  }
}
```

## How to Apply This Fix

Run the script:
```bash
./scripts/windsurf-mcp-direct-token.sh
```

This will:
1. Get token from gopass
2. Create config with direct token value
3. No OAuth prompts needed

Then:
1. Quit Windsurf (Cmd+Q)
2. Restart Windsurf
3. Open dicee project
4. **No authentication prompts**
5. Supabase MCP just works

## Security Considerations

### Is This Secure?

**Yes, for local development:**

✅ **File location**: `~/.codeium/windsurf/mcp_config.json` (home directory)
✅ **Not version controlled**: File is outside project directory
✅ **User-only access**: File permissions restrict to your user account
✅ **Token source**: Retrieved from encrypted gopass store
✅ **Scope**: Token is scoped to dicee project only

### Comparison to Other Methods

| Method | Security | Reliability | Complexity |
|--------|----------|-------------|------------|
| OAuth (broken) | ⭐⭐⭐⭐⭐ | ❌ Doesn't work | Low |
| Env var | ⭐⭐⭐⭐ | ❌ Not loaded | Medium |
| Shell command | ⭐⭐⭐⭐ | ❌ Not executed | Medium |
| **Direct token** | ⭐⭐⭐⭐ | ✅ **Works** | **Low** |

### Token Rotation

When you need to rotate the token:

1. Generate new token: https://supabase.com/dashboard/account/tokens
2. Update gopass:
   ```bash
   gopass insert -f dicee/supabase/mcp-token
   ```
3. Re-run script:
   ```bash
   ./scripts/windsurf-mcp-direct-token.sh
   ```
4. Restart Windsurf

## Why This Shouldn't Be This Complicated

You're right - this is unnecessarily complex. Here's what **should** work but doesn't:

### Expected Behavior (Industry Standard)

1. **OAuth with token caching** ✅ Works in: Claude Desktop, Cursor, VS Code
2. **Environment variables** ✅ Works in: Most IDEs, Claude Code CLI
3. **Shell command substitution** ✅ Works in: Claude Code CLI

### Actual Windsurf Behavior

1. **OAuth** ❌ Prompts repeatedly, doesn't cache
2. **Environment variables** ❌ Not loaded into Windsurf process
3. **Shell commands** ❌ Not executed in config files

### The Gap

Windsurf's MCP implementation is **incomplete**:
- OAuth flow exists but token caching is broken
- Config parsing doesn't support env vars or shell commands
- Only direct string values work reliably

This forces us to use the **least elegant but most reliable** solution: direct token in config.

## Comparison: Claude Code vs Windsurf

| Feature | Claude Code CLI | Windsurf/Cascade |
|---------|----------------|------------------|
| OAuth caching | ✅ Works | ❌ Broken |
| Env vars `${VAR}` | ✅ Works | ❌ Not loaded |
| Shell `$(cmd)` | ✅ Works | ❌ Not executed |
| Direct token | ✅ Works | ✅ **Works** |
| Config location | `.mcp.json` (project) | `~/.codeium/windsurf/mcp_config.json` |

**Conclusion**: For Windsurf, we're forced to use direct tokens until they fix OAuth caching.

## Future Improvements

When Windsurf fixes their MCP implementation, we can switch to:

**Preferred**: OAuth with proper token caching
```json
{
  "supabase": {
    "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg"
  }
}
```

**Alternative**: Environment variable support
```json
{
  "supabase": {
    "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg",
    "headers": {
      "Authorization": "Bearer ${SUPABASE_MCP_TOKEN}"
    }
  }
}
```

Until then: **Direct token is the only reliable method**.

## References

- Script: `scripts/windsurf-mcp-direct-token.sh`
- Supabase MCP: https://supabase.com/docs/guides/ai/mcp
- Windsurf MCP Docs: `temp-windsurf-config.md`
- Token management: `.claude/gopass-structure.yaml`
