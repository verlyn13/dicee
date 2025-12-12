# Dicee Project – Codex CLI Playbook

_Last updated: 2025-12-12 • Model: ChatGPT 5.2 / Codex CLI v0.71.0_

## Mission
Codex CLI is our fast-execution agent for boilerplate-heavy tasks (CRUD APIs, Supabase helpers, integration tests). It runs the latest ChatGPT models, benefiting from deeper planning, larger scratchpads, and native MCP support. This playbook mirrors the guardrails established for Claude Code and Windsurf while focusing on Codex's strengths.

## Quick Start

```bash
# 1. Verify Codex CLI is installed
codex --version

# 2. Generate ~/.codex/config.toml from this repo template
./scripts/setup-codex-cli.sh

# 3. Launch Codex CLI from repo root
codex
```

Codex automatically loads:
- `.codex/rules/` (always-on guardrails)
- `.codex/workflows/` (phase-specific flows)
- `.claude/state/*` (shared tasks, blockers, handoffs)
- MCP servers from `.mcp.json` (memory + Supabase + AKG)

## Session Startup

**CRITICAL**: Before starting work, ensure MCP servers are operational:

```bash
# Start with /awaken to initialize session
/awaken

# Or manually check MCP status
codex mcp list  # All 3 servers should show connected
```

## Approval & Sandbox Modes
- `approval_mode = "never"` – trust the agent to operate autonomously but obey Three Strikes
- `sandbox_mode = "danger-full-access"` – identical to Claude CLI setup; destructive commands require explicit user confirmation
- Hooks log every session/tool invocation to `.claude/state/tool-log.jsonl`

## Configuration Highlights
| Feature | Setting | Benefit |
|---------|---------|---------|
| Planner | `gpt-5-mini` with 12-step cap | Forces explicit plan before edits |
| Scratchpad | 16k tokens | Rich reasoning transcripts for review |
| Analysis budget | 32k tokens | Handles probability proofs / Supabase query reviews |
| Auto-plan | Enabled | Aligns with agentic workflow orchestration doc |
| Slash commands | `/status`, `/task`, `/verify`, `/handoff`, `/awaken`, `/tidyup` | Shared muscle memory with Claude |
| Workflows | `/phase-manager`, `/verify-backend` | Phase-specific guidance |

### GPT-5.2 defaults (Codex CLI v0.71.0)
- Default model: `gpt-5.2` (knowledge cutoff Aug 2025)
- Planner: `gpt-5-mini`; Reviewer/Auditor: `gpt-5.2-pro`
- Reasoning effort: `none` by default — bump to `medium`/`high`/`xhigh` for deep refactors
- Verbosity: `medium` default — lower for terse SQL/codegen, raise for walkthroughs
- Tool calls: keep preambles on (explain before calling) and favor MCP tools over guesses

## Task Protocol
1. **Awaken**: Start session with `/awaken` to load context and verify MCP
2. **Read before edit**: Open all referenced files for the task
3. **Plan**: Run `plan` command to outline ≤12 steps
4. **Execute**: Use MCP for schema/context; keep diffs tight and grouped
5. **Verify**: Run quality checks (see below)
6. **Update state**: Modify `.claude/state/current-phase.json` + handoff doc
7. **Tidyup**: End session with `/tidyup` to persist state and handoff

## Quality Checks

```bash
pnpm check          # TypeScript + Svelte
pnpm biome:check    # Lint (or biome:fix to auto-fix)
pnpm web:vitest     # Tests (use -- <args> for specific tests)
pnpm akg:check      # Architectural invariants
```

All-in-one quality gate:
```bash
./scripts/quality-gate.sh
```

## Shared Resources
- **Guardrails**: `.claude/AGENT-GUARDRAILS.md` (Three Strikes, escalation)
- **Conventions**: `.claude/CONVENTIONS.md` (naming patterns)
- **Workflow orchestration**: `.claude/workflow-orchestration.md`
- **State files**: `.claude/state/` directory
- **Phase archives**: `.claude/state/archives/phases/` (historical phases)
- **MCP config**: `.mcp.json` (memory + Supabase + AKG)
- **Windsurf rules**: `.windsurf/rules/` for cross-agent alignment

## MCP Servers
| Name | Transport | Purpose |
|------|-----------|---------|
| `memory` | stdio | Persists knowledge graph in `.claude/state/memory.jsonl` |
| `supabase` | HTTP | Query schema, migrations, edge functions for project ref `duhsbuyxyppgbkwbbtqg` |
| `akg` | stdio (bun) | Architectural knowledge graph - layer validation, import checking |

All servers are registered in `.mcp.json` and should auto-connect.

### MCP Authentication

**Supabase MCP** requires a token from gopass:
```bash
# Load token before starting Codex (fish shell)
set -x SUPABASE_MCP_TOKEN (gopass show -o dicee/supabase/mcp-token)

# Or use the dicee-codex function if available
dicee-codex
```

## Workflows
- `/phase-manager`: Orchestrates planning + execution for current phase tasks
- `/verify-backend`: Enforces verification and state updates before marking tasks complete

Add more workflows under `.codex/workflows/`; Codex auto-discovers them via config.

## Phase State Management

Current phase tracking uses a slimmed-down `current-phase.json`:
- **Active phase only**: Only phase-11-ux-enhancement with full details
- **Archived phases**: Historical data in `.claude/state/archives/phases/`
- **References**: `completedPhases`, `deferredPhases`, `supersededPhases` arrays

To view archived phase details:
```bash
cat .claude/state/archives/phases/README.md  # Index
cat .claude/state/archives/phases/phase-8-do-migration.json  # Specific phase
```

## Frontend Testing Playbook
- Run UI/unit specs from the repo root with `pnpm web:vitest -- <file-or-pattern>` so Vitest executes inside `@dicee/web` with the SvelteKit Vite plugin stack enabled
- Regenerate `.svelte-kit` types with `pnpm web:sync`
- If a component must be stubbed, create a Svelte `.svelte` fixture rather than plain classes/functions
- Log meaningful console output only when tests cover error paths

## Agent Hand-off Expectations
- Always append to `.claude/state/session-handoff.md` when pausing
- Include command outputs for build/test steps (summarized, not raw logs)
- Note remaining steps + whether Windsurf or Claude should pick up next
- Use `/tidyup` to ensure clean handoff state

## Troubleshooting
- **Codex CLI fails to start**: Rerun `./scripts/setup-codex-cli.sh --dry-run` to inspect rendered config
- **Hooks not firing**: Ensure `AGENT_NAME=codex-cli` is set in config hook env sections
- **MCP auth failure**: Refresh Supabase MCP token in `gopass` (`dicee/supabase/mcp-token`)
- **AKG server not responding**: Run `pnpm akg:discover` to rebuild the graph
- **Planner stuck**: Temporarily disable `auto_plan` in `~/.codex/config.toml`

## Escalation Matrix
| Scenario | Action |
|----------|--------|
| 3 failed attempts on same step | Stop, log attempts, ping human |
| Schema/migration edits required | Escalate to Claude or human before proceeding |
| New secrets needed | Update Infisical via human-owned flow |
| UI work beyond boilerplate | Reassign to Windsurf/Cascade |
| Architectural decisions | Use AKG MCP tools to validate, escalate if uncertain |

Codex should remain focused on deterministic backend work where ChatGPT's reasoning efficiency shines.

## Slash Commands Reference

| Command | Purpose |
|---------|---------|
| `/awaken` | Initialize session, load context, verify MCP servers |
| `/tidyup` | Clean up session, persist state, prepare handoff |
| `/status` | Show current phase and tasks |
| `/task` | Pick up and work on a task |
| `/verify` | Verify task completion |
| `/handoff` | Generate session handoff notes |
| `/quality` | Run full quality gate |
| `/health` | Quick diagnostic check of dev environment |
| `/akg` | Architecture queries (layer, node, import, diagram) |

## Layer Architecture (AKG Enforced)

```
routes      → components, stores, services, types, wasm
components  → components, types (NOT stores, services)
stores      → services, types, supabase (NOT components, routes)
services    → types, supabase, wasm (NOT components, routes, stores)
types       → types only
supabase    → types only
wasm        → types only
```

**Always validate imports with AKG before adding them!**
