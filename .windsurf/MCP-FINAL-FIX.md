# Windsurf MCP - Final Fix (Simple URL Method)

**Date**: 2025-12-03 16:34
**Issue**: Previous config used complex auth headers; Supabase docs show simpler method
**Solution**: Use simple `url` field only - OAuth handled automatically by Supabase

## What Changed

### Before (Complex - Didn't Work)
```json
{
  "supabase": {
    "type": "http",
    "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg",
    "headers": {
      "Authorization": "Bearer ${SUPABASE_MCP_TOKEN}"
    }
  }
}
```

### After (Simple - Official Method)
```json
{
  "supabase": {
    "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg"
  }
}
```

## Why This Works

According to official Supabase MCP documentation:
- Supabase MCP server uses **dynamic client registration**
- OAuth authentication is handled **automatically**
- No need for manual PAT or auth headers
- First use will prompt for authentication **once**
- Credentials are cached for future sessions

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
      },
      "description": "Shared memory server for dicee project"
    },
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg"
    }
  }
}
```

## Next Steps

1. **Quit Windsurf completely** (Cmd+Q)
2. **Restart Windsurf**
3. **Open dicee project**
4. **Check Plugins**: Windsurf Settings > Cascade > Plugins
5. **First use**: When you ask Cascade to use Supabase, you'll get an OAuth prompt
6. **Authenticate once**: Login to Supabase in browser
7. **Done**: Credentials cached for future sessions

## Testing

After restart, ask Cascade:
```
Can you list the tables in my Supabase database?
```

Expected behavior:
- First time: OAuth browser window opens
- Login to Supabase
- Grant permissions
- Return to Windsurf
- Tool executes successfully
- Future uses: No prompt needed

## Comparison: Methods Tried

| Method | Status | Issue |
|--------|--------|-------|
| OAuth with `serverUrl` | ❌ Failed | Repeated prompts |
| PAT with shell command `$(gopass)` | ❌ Failed | Shell substitution not supported |
| PAT with env var `${SUPABASE_MCP_TOKEN}` | ❌ Failed | Windsurf didn't pick up env var |
| Simple `url` field (official) | ✅ Should work | Matches Supabase docs exactly |

## Key Insight

The official Supabase documentation for Windsurf/Cursor shows the **simplest possible config**:
- Just the `url` field
- No `type`, no `headers`, no auth
- OAuth is handled automatically by the MCP protocol
- This is the **recommended production method**

## References

- Official Supabase MCP for this project: https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg
- Supabase MCP Docs: https://supabase.com/docs/guides/ai/mcp
- Windsurf MCP Docs: `temp-windsurf-config.md`

## Cleanup

The environment variable setup is no longer needed for Windsurf (but still works for Claude Code):

```bash
# Optional: Remove from ~/.zshrc if you want
# The line: export SUPABASE_MCP_TOKEN=$(gopass show -o dicee/supabase/mcp-token 2>/dev/null || echo "")
```

Claude Code CLI still uses the `.mcp.json` with PAT method, which is fine.
