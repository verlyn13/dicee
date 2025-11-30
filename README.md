# Dicee

Educational Probability Platform for Yahtzee

## Overview

Dicee transforms Yahtzee from a casual dice game into an educational instrument for teaching probability, expected value, and optimal decision-making.

## Status

**Phase:** MVP Development
**Engine:** Rust/WASM probability core (complete)
**UI:** Svelte 5 with neo-brutalist design (in progress)

## Quick Start

```bash
# Prerequisites: Node 24+, Rust, pnpm
mise install  # or install manually

# Install dependencies
pnpm install

# Build WASM engine
pnpm run build:engine

# Start dev server
pnpm dev
```

## Development

```bash
pnpm dev          # Start dev server (http://localhost:5173)
pnpm build        # Build WASM + web app
pnpm check        # Run all checks (rust + web)
pnpm test         # Run Rust tests
pnpm format       # Format all code
pnpm lint         # Lint all code
```

## Architecture

```
packages/
├── engine/       # Rust → WASM probability engine
└── web/          # Svelte 5 frontend
```

- **Engine:** Rust compiled to WASM (~33KB), exact probability calculations
- **Frontend:** Svelte 5, neo-brutalist design, responsive
- **Build:** pnpm workspaces, wasm-pack, Vite

## RFCs

| RFC | Title | Status |
|-----|-------|--------|
| [001](docs/rfcs/rfc-001-statistical-engine.md) | Statistical Engine Architecture | Draft |
| [002](docs/rfcs/rfc-002-ui-ux-canvas.md) | UI/UX Canvas & Design System | Draft |
| [003](docs/rfcs/rfc-003-data-contracts.md) | Data Contracts & Event Schema | Draft |

See [ROADMAP.md](ROADMAP.md) for planned RFCs and implementation phases.

## License

MIT
