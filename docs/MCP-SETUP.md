# MCP Setup for Dicee

Dicee now uses:

- project-managed MCP configs for Claude Code and Cursor
- manual copy/paste templates for Windsurf and Copilot
- 1Password-backed wrapper commands for project-local secret auth

## Project-Managed Config

These files are versioned and should work after `direnv allow` plus `./scripts/check-1password-setup.sh`:

- `.mcp.json`
- `.cursor/mcp.json`

They provide:

- `memory`
- `akg`
- `supabase`
- `cloudflare-*`

Supabase and Cloudflare auth are resolved by wrapper commands at process launch. Dicee no longer exports MCP bearer tokens into the shell.

## Global / Manual Setup

### Windsurf

Copy the template in `docs/templates/windsurf-mcp-config.template.json` into your Windsurf global MCP config and replace `/absolute/path/to/dicee` with your local repo path.

### Copilot CLI

Use `.copilot-mcp.json` as the repo-owned template, replace `/absolute/path/to/dicee` with your local checkout path, and merge it into your own `~/.copilot/mcp-config.json` manually if you want those project tools available globally.

## Prerequisites

Approved 1Password workstation flow:

- be signed into the 1Password desktop app for `my.1password.com`
- enable `Settings > Developer > Integrate with 1Password CLI`
- verify readiness with `op vault get Dev --account my.1password.com >/dev/null`

```bash
direnv allow
./scripts/check-1password-setup.sh
```

Optional global auth, managed outside Dicee:

- Context7
- GitHub

## Security Rules

- Do not add secret exports to `.envrc`.
- Do not append tokens to `~/.zshrc`, `~/.bashrc`, or `~/.bash_profile`.
- Do not write bearer tokens into `~/.codeium/windsurf/mcp_config.json`.
- Do not use repo scripts to mutate global MCP config files.

## Verification

```bash
claude mcp list
pnpm akg:test
./scripts/with-dicee-cloudflare.sh -- wrangler whoami
```

If Windsurf or Copilot cannot see project tools, re-check the manual config paths and make sure the copied config points at the repo wrapper scripts.
