# Dicee Project - Windsurf/Cascade Instructions

## CRITICAL: Agent Guardrails (READ FIRST)

**Before doing ANY work, read `.windsurf/rules/core-guardrails.md`**

### Three Strikes Rule (MANDATORY)
- If you fail at the same operation **3 times**, you must **STOP and ask the human**
- This applies to: build failures, test failures, file operations, API calls, anything
- Do NOT try a 4th time - escalate immediately

### Quick Rules
1. **Read before edit** - Never modify a file you haven't read this session
2. **Verify after change** - Run tests/typecheck after every edit
3. **Update state** - Update `.claude/state/current-phase.json` after completing tasks
4. **Ask when stuck** - When in doubt, ask the human
5. **Follow conventions** - Read `.claude/CONVENTIONS.md` for naming patterns

### Naming Conventions (Quick Reference)
```
Component files: PascalCase.svelte
Callback props:  onVerb (onRoll, onScore, onClose) ← camelCase!
DOM events:      lowercase (onclick, onkeydown)   ← Svelte 5
Handlers:        handleVerb (handleRoll)
Booleans:        is/has/can prefix (isLoading)
CSS classes:     kebab-case (.game-container)
```

See `.claude/CONVENTIONS.md` for full documentation.

---

## Project Overview
Dicee is a dice probability engine and web application for learning probability through Yahtzee-style gameplay.

**Production URL**: https://dicee.jefahnierocks.com

See `docs/` for architecture RFCs and milestone plans.

## Tech Stack
- **Frontend**: SvelteKit (Svelte 5 with runes)
- **Engine**: Rust/WASM probability calculations
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Realtime**: Cloudflare Durable Objects (multiplayer, hibernatable WebSockets)
- **Edge Compute**: Cloudflare (Workers, Pages, D1, KV, R2)
- **Secrets**: Infisical (self-hosted at infisical.jefahnierocks.com)
- **Deployment**: Vercel (frontend), Cloudflare (edge services)
- **Package Manager**: pnpm (monorepo)

## Project Structure
```
packages/
  engine/     # Rust/WASM probability engine
  web/        # SvelteKit frontend
docs/
  m1/         # Milestone 1 planning docs
.claude/
  AGENT-GUARDRAILS.md       # CRITICAL: Mandatory rules for all agents
  CONVENTIONS.md            # Naming conventions and code patterns
  cli-reference.yaml        # CLI tool reference (Supabase/Vercel/Wrangler/Infisical)
  environment-strategy.yaml # Environment, secrets, and agent guardrails
  gopass-structure.yaml     # Local credential storage architecture
  typescript-biome-strategy.md # TypeScript patterns and Biome 2.3 config
  auth-strategy.yaml        # Authentication architecture and identity linking
  workflow-orchestration.md # MCP-first workflow and agent orchestration
  state/                    # Session state (git-ignored)
    current-phase.json      # Active phase and tasks
    session-handoff.md      # Handoff notes
.windsurf/
  rules/                    # Cascade rules (always-on and glob-scoped)
  workflows/                # Cascade workflows (/build-component, etc.)
scripts/
  quality-gate.sh           # Quality gate checks before phase transition
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev              # Start dev server (web package)

# Build
pnpm build            # Build all packages

# Testing
pnpm test             # Run tests
pnpm test:e2e         # Run E2E tests
pnpm web:vitest       # Run Vitest inside @dicee/web (pass args after --)

# Tooling sync
pnpm web:sync         # Regenerate SvelteKit types in @dicee/web

# Linting
pnpm lint             # Lint all packages
pnpm format           # Format with Biome

# Architectural Knowledge Graph (AKG)
pnpm akg:discover              # Discover graph (136 nodes, 227 edges)
pnpm akg:discover --incremental # Only changed files (fast, for PRs)
pnpm akg:check                 # Run invariant checks (6 built-in)
pnpm akg:check --json          # JSON output for agents/CI
pnpm akg:mermaid               # Generate Mermaid diagrams from graph
```

> Frontend unit tests must run through `pnpm web:vitest -- <args>` so SvelteKit injects its Vite plugin stack.

## Code Standards

> Full documentation: `.claude/typescript-biome-strategy.md`

### TypeScript/Svelte
- **Biome 2.3+** for formatting and linting (NOT Prettier)
- Svelte 5 runes syntax (`$state`, `$derived`, `$effect`)
- Strict TypeScript mode enabled
- **No `any` types** - use `unknown` with type guards
- Const arrays for enum-like types: `['A', 'B'] as const`
- Result pattern for API: `{ data: T | null; error: Error | null }`

### Key Biome Rules (Error Level)
- `noExplicitAny` - No any types in production code
- `noUnusedImports` - Clean imports
- `noDoubleEquals` - Use `===`
- `useConst` - Immutability by default

### Testing
- Vitest for unit tests
- Playwright for E2E tests
- Test files co-located with source (`*.test.ts`)
- Svelte component mocks should export `.svelte` fixtures or re-use production components

## MCP Servers (Windsurf Configuration)

Windsurf/Cascade has access to these MCP servers:

| Server | Purpose | Status |
|--------|---------|--------|
| **dicee-memory** | Knowledge Graph for persistent project state | ✅ Active |
| **supabase** | Database, migrations, types, edge functions | ✅ Active |

### Memory Server
- **File**: `.claude/state/memory.jsonl`
- **Purpose**: Shared state across Claude Code and Cascade sessions
- **Tools**: `create_entities`, `add_observations`, `search_nodes`, `read_graph`

### Supabase MCP
- **Project Ref**: duhsbuyxyppgbkwbbtqg
- **Features**: database, docs, functions
- **Tools**: `execute_sql`, `apply_migration`, `list_tables`, `search_docs`

## AKG (Architectural Knowledge Graph)

The AKG MCP server provides architecture-aware queries. Use these tools:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `akg_layer_rules` | Get allowed/forbidden imports | Before adding imports |
| `akg_node_info` | Get node type, layer, edges | Understanding a file's role |
| `akg_check_import` | Validate a proposed import | **Always before writing imports** |
| `akg_invariant_status` | Run architectural checks | Quality gate awareness |
| `akg_diagram` | Generate Mermaid diagrams | Architecture visualization |
| `akg_path_find` | Find dependency path | Impact analysis |
| `akg_cache_status` | Cache management | After running akg:discover |

### Layer Architecture
```
routes      → components, stores, services, types, wasm
components  → components, types (NOT stores, services)
stores      → services, types, supabase (NOT components, routes)
services    → types, supabase, wasm (NOT components, routes, stores)
types       → types only
supabase    → types only
wasm        → types only (only engine.ts imports WASM)
```

## Agent Guidelines

### Core Rules (MANDATORY)
1. **Three Strikes Rule** - 3 failed attempts = STOP and ask human
2. **Read before edit** - NEVER modify a file you haven't read this session
3. **Verify after change** - Run tests/typecheck after every edit
4. **Update state** - Keep `.claude/state/` files current

### Windsurf/Cascade Best For
- UI component implementation
- CSS/styling work
- Svelte 5 component development
- Visual polish
- Hot reload iteration

### What NOT to Attempt
- Architecture decisions (escalate to Claude Code or human)
- Complex multi-file refactoring without explicit instructions
- Database schema changes without explicit approval
- Security-sensitive code changes
- Anything involving secrets or credentials

## Session Protocol

**Start of session**:
1. Read `.claude/state/current-phase.json`
2. Read `.claude/state/session-handoff.md`
3. Announce session start and task

**End of session**:
1. Update `current-phase.json` with progress
2. Write handoff notes to `session-handoff.md`
3. Commit work if applicable

## Quality Gate

Before marking work complete, run:
```bash
pnpm check          # TypeScript + Svelte
pnpm biome:check    # Lint check
pnpm web:vitest     # Run tests
```

Full quality gate:
```bash
./scripts/quality-gate.sh
```

## Supabase Project Configuration
- **Project Ref**: duhsbuyxyppgbkwbbtqg
- **Project URL**: https://duhsbuyxyppgbkwbbtqg.supabase.co
- **Local API**: http://127.0.0.1:54321
- **Local Studio**: http://127.0.0.1:54323

## Vercel Project Configuration
- **Project**: dicee
- **Production URL**: https://dicee.jefahnierocks.com
- **Adapter**: `@sveltejs/adapter-vercel` (Node 22.x runtime)

## Cloudflare Configuration
- **Account ID**: 13eb584192d9cefb730fde0cfd271328
- **Worker Name**: gamelobby
- **Durable Object Class**: GameRoom
- **Lobby URL**: gamelobby.jefahnierocks.com

## References

- Full project docs: `CLAUDE.md`
- Agent guardrails: `.claude/AGENT-GUARDRAILS.md`
- Conventions: `.claude/CONVENTIONS.md`
- Workflow orchestration: `.claude/workflow-orchestration.md`
- UI/UX design: `docs/UI-UX-DESIGN-REPORT.md`
