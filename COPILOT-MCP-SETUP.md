# GitHub Copilot CLI MCP Setup

Dicee no longer ships a repo script that edits `~/.copilot/mcp-config.json`.

## Supported Pattern

1. Open `.copilot-mcp.json` in this repo.
2. Manually merge the servers you want into your own `~/.copilot/mcp-config.json`.
3. Keep the repo-owned command paths pointed at this checkout.

## What `.copilot-mcp.json` Provides

- `memory`
- `akg`

Deployment and quality-gate workflows are still handled by `scripts/copilot-mcp-wrapper.sh`.

## Secure Operator Prerequisites

Before running deploy-oriented commands:

```bash
direnv allow
./scripts/check-1password-setup.sh
./scripts/with-dicee-cloudflare.sh -- wrangler whoami
```

The wrapper script now resolves Cloudflare credentials from 1Password on demand. Dicee does not require project-local GitHub or Context7 tokens.

## References

- `docs/MCP-SETUP.md`
- `.copilot-mcp-README.md`
- `.copilot-mcp.json`
