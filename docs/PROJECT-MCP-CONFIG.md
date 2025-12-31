# Dicee MCP Configuration Guide

> **Last Updated**: 2025-12-17
> **Purpose**: MCP tool selection guidance for all agents

---

## MCP Tool Decision Matrix

**CRITICAL FOR ALL AGENTS**: This defines WHICH MCP tools to use for WHICH tasks.

### Priority Order

```
1. PROJECT-SPECIFIC MCP TOOLS
   └── supabase, memory, akg, cloudflare-*

2. LIBRARY DOCUMENTATION (Context7)
   └── SvelteKit, Cloudflare, Zod, Rust, etc.

3. WEB SEARCH (Brave/Firecrawl)
   └── Only when MCP tools fail
```

### Task → Tool Mapping

| Task | Primary MCP Tool | Notes |
|------|------------------|-------|
| **Library/API docs** | `context7` | NEVER web search for library docs |
| **Database tables** | `supabase` | Profiles, stats, game history |
| **Migrations** | `supabase` | Schema changes, type generation |
| **User data queries** | `supabase` | Persistent user data |
| **Cloudflare docs** | `cloudflare-docs` | CF-specific questions |
| **Worker logs** | `cloudflare-observability` | Debug `gamelobby` worker |
| **Build status** | `cloudflare-builds` | Check deployment failures |
| **KV/R2/D1** | `cloudflare-bindings` | Manage CF resources |
| **CF analytics** | `cloudflare-graphql` | Zone analytics |
| **Import validation** | `akg_check_import` | ALWAYS before adding imports |
| **Layer rules** | `akg_layer_rules` | Check what a layer can import |
| **Project memory** | `memory` | Persistent cross-session state |
| **Complex reasoning** | `sequential-thinking` | Multi-step problems |

### Auto-Invoke Rules

| Trigger | Auto-Invoke |
|---------|-------------|
| Writing an import | `akg_check_import` |
| SvelteKit/Cloudflare question | `context7.get-library-docs` |
| Debugging production | `cloudflare-observability` |
| Build failure | `cloudflare-builds` |
| Multi-step planning | `sequential-thinking` |

### Context7 Library IDs

| Library | Context7 ID |
|---------|-------------|
| SvelteKit | `/sveltejs/kit` |
| Svelte 5 | `/sveltejs/svelte` |
| Zod | `/colinhacks/zod` |
| CF Workers | `/cloudflare/workers-types` |
| Vitest | `/vitest-dev/vitest` |
| Biome | `/biomejs/biome` |

**DO NOT**:
- Web search for library docs
- Guess API signatures
- Assume library behavior without Context7

---

## Agent-Specific Tools

| Agent | Primary MCP Tools |
|-------|-------------------|
| **Claude Code CLI** | `akg`, `cloudflare-*`, `memory`, `context7` |
| **Cursor** | `akg`, `context7`, `cloudflare-*`, `memory` |
| **Windsurf/Cascade** | `akg`, `context7`, `memory` |
| **Codex CLI** | `akg`, `memory`, `context7` |
| **Copilot CLI** | `cloudflare-*`, `akg` |

---

## Configuration Files

### Claude Code CLI
- **Config**: `.mcp.json` (project root)
- Auto-discovers when entering project directory

### Cursor
- **Config**: `.cursor/mcp.json`
- Loads when opening project

### Windsurf/Copilot/Codex
- **Config**: User-level + direnv wrappers
- Uses `scripts/mcp-wrappers/` with `DICEE_MCP_ENABLED` flag

---

## MCP Servers

| Server | Purpose |
|--------|---------|
| `supabase` | Database, migrations, types (persistent user data) |
| `memory` | Project knowledge graph |
| `akg` | Architecture validation (Dicee-specific) |
| `context7` | Library documentation (global) |
| `cloudflare-docs` | CF documentation |
| `cloudflare-observability` | Worker logs/metrics |
| `cloudflare-builds` | Build status |
| `cloudflare-bindings` | KV/R2/D1 management |
| `cloudflare-graphql` | Analytics queries |
| `cloudflare-logpush` | Logpush jobs |

### Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `SUPABASE_MCP_TOKEN` | gopass → `.envrc` | Supabase MCP auth |
| `DICEE_MCP_ENABLED` | `.envrc` | Enable project MCP wrappers |
| `DICEE_PROJECT_ROOT` | `.envrc` | Project root for wrappers |
| `CONTEXT7_API_KEY` | Global | Context7 auth |

---

## Verification

```bash
# Claude Code CLI
claude mcp list

# Test AKG
pnpm akg:test

# Test memory
# Use MCP tool to create/search entities
```

---

## Troubleshooting

**Servers not appearing**: Restart tool, check `direnv allow .`

**AKG not responding**: `pnpm akg:discover`

**Cloudflare OAuth**: Complete browser OAuth flow

---

## References

- AKG docs: `docs/architecture/akg/`
- Guardrails: `.claude/AGENT-GUARDRAILS.md`
- Workflow: `.claude/workflow-orchestration.md`
