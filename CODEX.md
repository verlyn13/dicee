# Dicee Project – Codex CLI (ChatGPT 5.1) Playbook

_Last updated: 2025-12-03 • Codex CLI build: 2025.12.03 • Model: ChatGPT 5.1 Pro_

## Mission
Codex CLI is our fast-execution agent for boilerplate-heavy tasks (CRUD APIs, Supabase helpers, integration tests). It runs the latest ChatGPT 5.1 models, benefiting from deeper planning, larger scratchpads, and native MCP support. This playbook mirrors the guardrails established for Claude Code and Windsurf while focusing on Codex's strengths.

## Quick Start

```bash
# 1. Verify you're on the December 3, 2025 release (or newer)
codex --version  # expect 2025.12.03

# 2. Generate ~/.codex/config.toml from this repo template
./scripts/setup-codex-cli.sh

# 3. Launch Codex CLI from repo root
codex
```

Codex automatically loads:
- `.codex/rules/` (always-on guardrails)
- `.codex/workflows/` (phase-specific flows)
- `.claude/state/*` (shared tasks, blockers, handoffs)
- MCP servers from `.mcp.json` (memory + Supabase)

## Approval & Sandbox Modes
- `approval_mode = "never"` – trust the agent to operate autonomously but obey Three Strikes
- `sandbox_mode = "danger-full-access"` – identical to Claude CLI setup; destructive commands require explicit user confirmation even in autonomous mode
- Hooks log every session/tool invocation to `.claude/state/tool-log.jsonl`

## ChatGPT 5.1 Configuration Highlights
| Feature | Setting | Benefit |
|---------|---------|---------|
| Planner | `gpt-5.1-mini` with 12-step cap | Forces explicit plan before edits |
| Scratchpad | 16k tokens | Rich reasoning transcripts for review |
| Analysis budget | 32k tokens | Handles probability proofs / Supabase query reviews |
| Auto-plan | Enabled | Aligns with agentic workflow orchestration doc |
| Slash commands | `/status`, `/task`, `/verify`, `/handoff` | Shared muscle memory with Claude |
| Workflows | `/phase3-manager`, `/verify-profile-backend` | Phase-specific guidance |

## Task Protocol
1. **Read before edit**: open all referenced files for the task (profiles/stats libs, Svelte components, migrations).
2. **Plan**: run `/phase3-manager` or `plan` command to outline ≤12 steps.
3. **Execute**: use MCP for schema/context; keep diffs tight and grouped.
4. **Verify**: run `pnpm check`, `pnpm biome:check`, backend `pnpm test -- <scope>`, frontend `pnpm web:vitest -- <args>`, and `pnpm web:sync` whenever route/types change.
5. **Update state**: modify `.claude/state/current-phase.json` + handoff doc.
6. **Handoff**: use `/handoff` command to summarize progress/blockers.

## Shared Resources
- **Guardrails**: `.claude/AGENT-GUARDRAILS.md` (Three Strikes, escalation)
- **Workflow orchestration**: `.claude/workflow-orchestration.md`
- **State files**: `.claude/state/` directory
- **MCP config**: `.mcp.json` (memory + Supabase)
- **UI Rules**: `.windsurf/rules/` for cross-agent alignment

## MCP Servers
| Name | Transport | Purpose |
|------|-----------|---------|
| `memory` | stdio | Persists knowledge graph in `.claude/state/memory.jsonl` |
| `supabase` | HTTP | Query schema, migrations, edge functions for project ref `duhsbuyxyppgbkwbbtqg` |

Both are registered in the Codex config template so ChatGPT 5.1 can call them without extra setup.

## Workflows
- `/phase3-manager`: orchestrates planning + execution for Profile phase backend tasks.
- `/verify-profile-backend`: enforces verification and state updates before marking tasks complete.

Add more workflows under `.codex/workflows/`; Codex auto-discovers them via config.

## Frontend Testing Playbook
- Run UI/unit specs from the repo root with `pnpm web:vitest -- <file-or-pattern>` so Vitest executes inside `@dicee/web` with the SvelteKit Vite plugin stack enabled.
- Regenerate `.svelte-kit` types with `pnpm web:sync` instead of bare `pnpm exec svelte-kit sync`; the script keeps the command scoped to the correct workspace.
- If a component must be stubbed, create a Svelte `.svelte` fixture (or reuse the real component) rather than exporting plain classes/functions that bypass the compiler.
- Log meaningful console output only when tests cover error paths; suppress noisy logs elsewhere to keep agent transcripts readable.

## Agent Hand-off Expectations
- Always append to `.claude/state/session-handoff.md` when pausing
- Include command outputs for build/test steps (summarized, not raw logs)
- Note remaining steps + whether Windsurf or Claude should pick up next

## Troubleshooting
- **Codex CLI fails to start**: rerun `./scripts/setup-codex-cli.sh --dry-run` to inspect rendered config
- **Hooks not firing**: ensure `AGENT_NAME=codex-cli` is set in config hook env sections
- **MCP auth failure**: refresh Supabase MCP token in `gopass` (`dicee/supabase/mcp-token`)
- **Planner stuck**: temporarily disable `auto_plan` in `~/.codex/config.toml`, then re-enable after issue resolved

## Escalation Matrix
| Scenario | Action |
|----------|--------|
| 3 failed attempts on same step | Stop, log attempts, ping human |
| Schema/migration edits required | Escalate to Claude or human before proceeding |
| New secrets needed | Update Infisical via human-owned flow |
| UI work beyond boilerplate | Reassign to Windsurf/Cascade |

Codex should remain focused on deterministic backend work where ChatGPT 5.1's reasoning efficiency shines.
