# Dicee

Dice probability engine and web application for learning probability through Yahtzee-style gameplay.

**Production:** https://dicee.jefahnierocks.com

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | SvelteKit (Svelte 5 runes), TypeScript |
| Engine | Rust → WASM (~45KB), exact probability calculations |
| Auth/DB | Supabase (Auth, PostgreSQL, Edge Functions) |
| Realtime | Cloudflare Durable Objects (WebSocket multiplayer) |
| Hosting | Vercel (frontend), Cloudflare (DNS, edge services) |
| Secrets | Infisical (self-hosted) |

## Project Structure

```
packages/
├── engine/        # Rust probability engine (wasm-pack)
├── web/           # SvelteKit frontend
└── cloudflare-do/ # Durable Objects multiplayer (replacing partykit/)
docs/
├── rfcs/       # Design documents
├── m1/         # Milestone planning
└── architecture/akg/  # Architectural Knowledge Graph
.claude/
├── commands/   # Slash commands (/status, /akg, /quality)
├── state/      # Session state (git-ignored)
└── AGENT-GUARDRAILS.md
```

## Development

```bash
# Prerequisites: Node 24+ (via mise), Rust, pnpm
pnpm install
pnpm dev              # Start dev server (localhost:5173)
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Biome lint
pnpm format           # Biome format
```

### Engine (Rust/WASM)

```bash
cd packages/engine
cargo test            # 120 tests
cargo build --release --target wasm32-unknown-unknown
wasm-pack build --target web
```

### Quality Gate

```bash
./scripts/quality-gate.sh   # 7 checks before phase transitions
pnpm akg:check              # Architectural invariants (5 rules)
```

## Agentic Development Infrastructure

This project uses MCP-first workflow orchestration for AI-assisted development.

### MCP Servers

| Server | Purpose |
|--------|---------|
| memory | Knowledge graph for persistent project state |
| supabase | Database, migrations, types, edge functions |
| akg | Architectural Knowledge Graph (layer rules, invariants) |

### AKG (Architectural Knowledge Graph)

Static analysis tool enforcing architectural invariants:

```bash
pnpm akg:discover     # Build graph (150 nodes, 267 edges)
pnpm akg:check        # Run 5 invariants
pnpm akg:mermaid      # Generate diagrams
```

**Invariants:** `wasm_single_entry`, `store_no_circular_deps`, `layer_component_isolation`, `service_layer_boundaries`, `store_file_naming`

### Slash Commands

| Command | Purpose |
|---------|---------|
| `/status` | Current phase and tasks |
| `/akg check` | Run architectural invariants |
| `/quality` | Full quality gate |
| `/handoff` | Generate session notes |

### Workflow State

- `.claude/state/current-phase.json` - Phase tracking
- `.claude/state/session-handoff.md` - Agent handoff notes
- `.claude/AGENT-GUARDRAILS.md` - Mandatory agent rules

## Configuration

### Environment Variables

```bash
# .env.local (git-ignored)
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=xxx
PUBLIC_WORKER_HOST=gamelobby.jefahnierocks.com
```

### CLI Tools

- Supabase CLI 2.62.10
- Vercel CLI 48.12.1
- Wrangler CLI 4.51.0
- Infisical CLI 0.43.35

See `.claude/cli-reference.yaml` for command documentation.

## Tests

- **Rust:** 120 tests (unit, integration, property-based, doc tests)
- **Frontend:** 1099 tests (Vitest, component mocks)
- **E2E:** Playwright (critical flows)

## License

MIT
