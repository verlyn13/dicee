# Dicee Project - Codex CLI Playbook

## Focus

Codex is best suited for backend, integration, and boilerplate-heavy work in Dicee.

- Durable Objects
- Supabase-adjacent integration logic
- test additions and maintenance
- operational wrappers and config cleanup

## Startup Checklist

1. Read `.claude/AGENT-GUARDRAILS.md`.
2. Read `.claude/CONVENTIONS.md`.
3. Verify the project MCP config in `.mcp.json`.
4. Run `./scripts/check-1password-setup.sh` before secret-backed operator tasks.

## Secret Handling

Dicee uses a split model:

- Infisical: runtime and application secrets
- 1Password: local bootstrap/operator secrets
- `scripts/lib/dicee-operator-metadata.sh`: non-secret metadata

Approved 1Password workstation flow:

- sign into the 1Password desktop app for `my.1password.com`
- enable `Settings > Developer > Integrate with 1Password CLI`
- verify readiness with `op vault get Dev --account my.1password.com >/dev/null`

Use wrappers instead of shell exports:

```bash
./scripts/with-dicee-infisical-auth.sh dev -- infisical login --method=universal-auth --domain=https://infisical.jefahnierocks.com
./scripts/with-dicee-cloudflare.sh -- wrangler whoami
```

GitHub and Context7 are expected from the user’s global Codex/tool configuration. Dicee no longer provisions project-local tokens for them.

## MCP Servers

Project-managed in `.mcp.json`:

- `memory`
- `akg`
- `supabase`
- `cloudflare-*`

Project-local Supabase and Cloudflare auth is resolved by repo wrapper commands at process launch. No secrets are exported by `direnv`.

## Quality Checks

```bash
pnpm check
pnpm biome:check
pnpm web:vitest -- <pattern>
pnpm akg:check
```

Use `./scripts/quality-gate.sh` before considering a task complete.
