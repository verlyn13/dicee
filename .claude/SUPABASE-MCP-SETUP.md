# Supabase MCP Setup

Dicee’s Supabase MCP auth is now project-local and 1Password-backed.

## Source of Truth

- 1Password item: `dicee-supabase-mcp`
- field: `token`

## Launch Path

Project configs call:

- `scripts/mcp-wrappers/supabase-wrapper.sh`

That wrapper reads the token from 1Password at process launch and starts `mcp-remote` for the Dicee Supabase project ref.

## Verification

```bash
./scripts/check-1password-setup.sh
claude mcp list
```

## Security Notes

- Dicee no longer exports `SUPABASE_MCP_TOKEN` from `.envrc`
- Dicee no longer writes the token into `~/.codeium/windsurf/mcp_config.json`
- Dicee no longer uses the legacy local secret flow for MCP auth
