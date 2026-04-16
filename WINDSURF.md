# Dicee Project - Windsurf/Cascade Instructions

## Before Working

1. Read `.windsurf/rules/core-guardrails.md`.
2. Read `.claude/CONVENTIONS.md` before editing project files.
3. Run `direnv allow` from the repo root so non-secret project state is available.
4. Run `./scripts/check-1password-setup.sh` before Cloudflare or Supabase MCP work.

## Project Overview

Dicee uses:

- SvelteKit on Cloudflare Pages
- Cloudflare Durable Objects for realtime multiplayer
- Supabase for auth and persistent data
- Infisical for runtime/app secrets
- 1Password for local operator/bootstrap secrets

## Secure Local Bootstrap

Approved 1Password workstation flow:

- sign into the 1Password desktop app for `my.1password.com`
- enable `Settings > Developer > Integrate with 1Password CLI`
- verify readiness with `op vault get Dev --account my.1password.com >/dev/null`

Use command-scoped wrappers only:

```bash
./scripts/with-dicee-cloudflare.sh -- wrangler whoami
./scripts/with-dicee-infisical-auth.sh dev -- infisical login --method=universal-auth --domain=https://infisical.jefahnierocks.com
./scripts/with-dicee-supabase-mcp.sh -- bash -lc 'printf "token ready\n"'
```

Do not append tokens to shell startup files and do not use repo scripts to write into `~/.codeium/windsurf/mcp_config.json`.

## MCP Configuration

- Cursor and Claude use the checked-in project configs.
- Windsurf must be configured manually using the template and instructions in `docs/MCP-SETUP.md`.
- Supabase and Cloudflare auth in Windsurf must point at the repo wrapper commands, not environment-variable token interpolation.
- Context7 and GitHub auth are global/user-baseline concerns, not Dicee project-local secrets.

## Common Commands

```bash
pnpm dev
pnpm build
pnpm test
pnpm web:vitest -- <pattern>
pnpm check
pnpm biome:check
pnpm akg:check
```

Use `scripts/copilot-mcp-wrapper.sh` for the repo’s existing deploy/check shortcuts. The wrapper now calls the Cloudflare 1Password launcher internally.
