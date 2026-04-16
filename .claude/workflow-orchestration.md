# Dicee Workflow Orchestration

## Principles

- Use project MCP tools first for Dicee-specific systems.
- Keep runtime/app secrets in Infisical.
- Keep local operator/bootstrap secrets in 1Password.
- Do not persist secret values into shells or user-global config files.

## MCP Sources

Project-managed:

- `.mcp.json`
- `.cursor/mcp.json`

Manual/global:

- Windsurf template in `docs/templates/windsurf-mcp-config.template.json`
- Copilot template in `.copilot-mcp.json`
- Context7 and GitHub via global user config

## Session State

Shared repo state lives under `.claude/state/`.

- `current-phase.json`
- `session-handoff.md`
- `blockers.json`
- `decisions.json`
- `memory.jsonl`

Archive snapshots under `.claude/state/archives/` are historical only.

## Secret Entry Points

```bash
./scripts/check-1password-setup.sh
./scripts/with-dicee-infisical-auth.sh dev -- <command>
./scripts/with-dicee-cloudflare.sh -- <command>
./scripts/with-dicee-supabase-mcp.sh -- <command>
infisical run --env=dev -- <command>
```

## Quality Gate

```bash
pnpm check
pnpm biome:check
pnpm web:vitest -- <pattern>
pnpm akg:check
./scripts/quality-gate.sh
```
