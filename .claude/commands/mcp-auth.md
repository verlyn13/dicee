# Authenticate MCP Servers

Check and authenticate MCP server connections.

## Instructions

1. Check current MCP server status:
```bash
claude mcp list
```

2. For Supabase MCP authentication:
   - The hosted MCP at mcp.supabase.com uses browser-based OAuth
   - Run `claude mcp serve supabase` to trigger OAuth flow
   - Or access any Supabase MCP tool to trigger auth prompt

3. For Memory MCP:
   - Should connect automatically via stdio
   - Memory file at `.claude/state/memory.jsonl`

4. Report status of each server:
   - memory: Connected / Not Connected
   - supabase: Authenticated / Needs Auth

5. If Supabase needs auth, guide user through:
   - Opening browser for OAuth
   - Waiting for authentication callback
   - Verifying connection

Run `claude mcp list` now and report the status.
