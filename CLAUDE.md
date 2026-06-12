# Dicee Project - Claude Code Instructions

## Session Startup

1. Read `.claude/AGENT-GUARDRAILS.md` and `.claude/CONVENTIONS.md`.
2. Use the project MCP config in `.mcp.json`.
3. Run `./scripts/check-1password-setup.sh` before secret-backed operator work.
4. Verify MCP connectivity with `claude mcp list`.

Context7 and GitHub are global/user-baseline tools, not Dicee project-local secrets.

## Project Overview

Dicee is a SvelteKit + Cloudflare + Supabase monorepo for dice-based multiplayer gameplay.

- Frontend: SvelteKit (Svelte 5) on Cloudflare Pages
- Realtime: Cloudflare Durable Objects
- Persistent data and auth: Supabase
- Runtime/app secrets: Infisical
- Local operator/bootstrap secrets: 1Password

## Key Commands

```bash
pnpm dev
pnpm build
pnpm test
pnpm web:vitest -- <pattern>
pnpm check
pnpm biome:check
pnpm akg:check
```

Cloudflare operator commands should run through the repo wrapper:

```bash
./scripts/with-dicee-cloudflare.sh -- wrangler whoami
./scripts/with-dicee-cloudflare.sh -- wrangler deploy
```

Infisical machine auth should also be command-scoped:

```bash
./scripts/with-dicee-infisical-auth.sh dev -- infisical login --method=universal-auth --domain=https://infisical.jefahnierocks.com
infisical run --env=dev -- pnpm dev
```

## Secret Model

### Runtime / App Secrets

Infisical remains the source of truth for runtime and application secrets.

- Use `infisical run --env=<env> -- <command>` for local runtime injection.
- Keep runtime-only secrets in Infisical, Cloudflare secrets, or GitHub Actions secrets as appropriate.

### Local Operator / Bootstrap Secrets

1Password is the source of truth for local bootstrap secrets that used to come from the legacy local secret store.

- Account: `my.1password.com`
- Vault: `Dev`
- Contract: `.claude/local-secret-bootstrap.yaml`
- Readiness check: `op vault get Dev --account my.1password.com >/dev/null`
- Approved auth model: sign into the 1Password desktop app and enable `Settings > Developer > Integrate with 1Password CLI`

Use the wrappers in `scripts/`:

- `with-dicee-infisical-auth.sh`
- `with-dicee-cloudflare.sh`
- `with-dicee-supabase-mcp.sh`
- `with-dicee-elevenlabs-local.sh`

### Non-Secret Metadata

Non-secret operator metadata is versioned in `scripts/lib/dicee-operator-metadata.sh`.

- Infisical instance URL, project ID, project slug, org name
- Infisical identity names and IDs
- Cloudflare account ID and domain
- Supabase project ref
- Project names like `dicee-web` and `dicee-audio`

### Guardrails

- Never persist secret values into shell startup files.
- Never write bearer tokens into user-level config files.
- Never commit `.env` files with real secrets.
- Do not reintroduce the legacy local secret flow or long-lived shell-secret exports.

## Meta-Inventory Manifest

`project.yaml` at the repo root is this project's interop header for the
meta-inventory hub. Contract: meta-inventory
`docs/decisions/0002-project-intelligence-spec.md` §D3 (local clone:
`~/Repos/verlyn13/meta-inventory`).

- Maintain it as part of normal work: update `status.local_phase` and
  `status.as_of` (quoted ISO-8601 string) when project status changes.
- `authority.status_of_record` is `.claude/state/current-phase.json`; keep
  that file current.
- When a hub directive asks to verify live state, the return must contain a
  first-hand readback — URL + HTTP status + timestamp from a command run in
  the current session. Never cite hub records (KB entries, prior audits)
  back as confirmation; that is circular evidence and will be rejected.
- Canonical public URL: `https://dicee.games`. `gamelobby.jefahnierocks.com`
  is an alias of the same deployment (verified byte-identical 2026-06-12).

## MCP Notes

Project-local MCP auth works like this:

- Supabase: `scripts/mcp-wrappers/supabase-wrapper.sh`
- Cloudflare: `scripts/mcp-wrappers/cloudflare-wrapper.sh`
- Memory and AKG: local stdio servers

For Windsurf or Copilot global MCP config, use the manual templates documented in `docs/MCP-SETUP.md`. Dicee does not provide scripts that write into `~/.codeium`, `~/.copilot`, or shell rc files.
