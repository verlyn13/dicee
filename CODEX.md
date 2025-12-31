# Dicee Project – Codex CLI Playbook

_Last updated: 2025-12-17 • Codex CLI with GPT models_

## Mission

Codex CLI handles boilerplate-heavy tasks: CRUD APIs, Cloudflare DO helpers, integration tests. Focus on deterministic backend work where GPT's reasoning efficiency shines.

**Production**: https://gamelobby.jefahnierocks.com

## Quick Start

```bash
codex                              # Launch from repo root
```

Codex loads:
- `.mcp.json` (memory + AKG + Cloudflare MCP servers)
- `.claude/state/*` (shared tasks, blockers, handoffs)

## Critical Rules

### Three Strikes Rule
If you fail 3 times at the same operation → **STOP and ask human**.

### Task Protocol
1. Read handoff: `.claude/state/session-handoff.md`
2. Check state: `.claude/state/current-phase.json`
3. Read before edit
4. Execute task
5. Verify: `pnpm check && pnpm biome:check`
6. Update state
7. Write handoff notes

## MCP Tools

> **Reference**: `docs/PROJECT-MCP-CONFIG.md` - Full MCP Tool Decision Matrix

| Tool | Purpose |
|------|---------|
| `context7` | Library docs (SvelteKit, Zod, Cloudflare) |
| `cloudflare-docs` | Cloudflare documentation |
| `cloudflare-observability` | Worker logs for debugging |
| `cloudflare-builds` | Build status and logs |
| `akg` | Architecture validation |
| `memory` | Project state persistence |

### Auto-Invoke
- **Writing imports** → `akg_check_import`
- **Library questions** → `context7.get-library-docs`
- **Debugging gamelobby** → `cloudflare-observability`

## Layer Architecture (AKG)

**Validate imports with `akg_check_import` before adding!**

```
routes      → components, stores, services, types, wasm
components  → components, types (NOT stores)
stores      → services, types (NOT components)
services    → types, wasm (NOT stores)
```

## Quality Checks

```bash
pnpm check          # TypeScript + Svelte
pnpm biome:check    # Lint
pnpm web:vitest     # Tests
pnpm akg:check      # Architectural invariants
```

Full quality gate:
```bash
./scripts/quality-gate.sh
```

## Testing

Co-locate tests:
```
packages/cloudflare-do/src/
├── GameRoom.ts
└── __tests__/
    └── GameRoom.test.ts
```

Run:
```bash
pnpm web:vitest -- <pattern>
```

## Escalation Matrix

| Scenario | Action |
|----------|--------|
| 3 failed attempts | Stop, ask human |
| Schema/migration changes | Ask human first |
| Architectural decisions | Use AKG, ask if uncertain |
| UI beyond boilerplate | Reassign to Windsurf |

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/status` | Current phase/tasks |
| `/task [id]` | Pick up task |
| `/verify [id]` | Verify completion |
| `/akg` | Architecture queries |

## Handoff

When pausing:
1. Update `.claude/state/session-handoff.md`
2. Note completed work
3. List remaining steps
4. Specify which agent should continue

## References

- Guardrails: `.claude/AGENT-GUARDRAILS.md`
- Conventions: `.claude/CONVENTIONS.md`
- MCP Decision Matrix: `docs/PROJECT-MCP-CONFIG.md`
- Workflow: `.claude/workflow-orchestration.md`
