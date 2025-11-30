# Dicee

Educational Probability Platform for Yahtzee

## Overview

Dicee transforms Yahtzee from a casual dice game into an educational instrument for teaching probability, expected value, and optimal decision-making.

## Status

**Phase:** Documentation-first
**Implementation:** Not started

## Architecture

- **Computation:** WASM (Rust) for instant probability calculations (<50ms)
- **Backend:** TypeScript for decision orchestration, Python for Monte Carlo validation
- **Frontend:** Svelte 5 (planned)
- **Design:** Neo-brutalist, accessibility-first
- **Data:** Event-sourced, PostgreSQL primary store

## RFCs

Architectural specifications live in `docs/rfcs/`:

| RFC | Title | Status |
|-----|-------|--------|
| [001](docs/rfcs/rfc-001-statistical-engine.md) | Statistical Engine Architecture | Draft |
| [002](docs/rfcs/rfc-002-ui-ux-canvas.md) | UI/UX Canvas & Design System | Draft |
| [003](docs/rfcs/rfc-003-data-contracts.md) | Data Contracts & Event Schema | Draft |

See [ROADMAP.md](ROADMAP.md) for planned RFCs and implementation phases.

## License

MIT
