# Dicee MCP Configuration Guide

> **Last Updated**: 2026-04-16
> **Purpose**: Tool-selection guidance and auth model for project MCP servers

## Priority Order

1. Project MCP servers: `supabase`, `memory`, `akg`, `cloudflare-*`
2. Global/user-baseline tools: `context7`, GitHub
3. Web search only when MCP or primary docs are insufficient

## Task → Tool Mapping

| Task | Primary Tool |
|------|--------------|
| Database tables, SQL, migrations | `supabase` |
| Cloudflare docs | `cloudflare-docs` |
| Cloudflare logs and metrics | `cloudflare-observability` |
| Cloudflare build state | `cloudflare-builds` |
| KV/R2/D1 and bindings | `cloudflare-bindings` |
| Cloudflare GraphQL analytics | `cloudflare-graphql` |
| Import validation | `akg_check_import` |
| Project memory/state | `memory` |
| Library and framework docs | global `context7` |

## Auth Model

### Project-Managed Auth

Dicee owns project-local auth wiring for:

- Supabase MCP
- Cloudflare MCP servers

Those servers are launched through repo wrapper commands that read 1Password at process startup:

- `scripts/mcp-wrappers/supabase-wrapper.sh`
- `scripts/mcp-wrappers/cloudflare-wrapper.sh`

### Global / User-Baseline Auth

Dicee does **not** provide project-local tokens for:

- Context7
- GitHub

Configure those globally in your own tool environment if you use them.

## Configuration Files

| Client | Config |
|--------|--------|
| Claude Code | `.mcp.json` |
| Cursor | `.cursor/mcp.json` |
| Windsurf | Manual global config using `docs/MCP-SETUP.md` |
| Copilot CLI | Manual global config using `.copilot-mcp.json` and `docs/MCP-SETUP.md` |

`direnv` only loads non-secret project state:

- `PROJECT_NAME`
- `DICEE_PROJECT_ROOT`
- `DICEE_ENV`
- `DICEE_MCP_ENABLED`
- `ENABLE_TOOL_SEARCH`

## Verification

```bash
direnv allow
./scripts/check-1password-setup.sh
claude mcp list
pnpm akg:test
```

## References

- `docs/MCP-SETUP.md`
- `.claude/local-secret-bootstrap.yaml`
- `scripts/lib/dicee-operator-metadata.sh`
