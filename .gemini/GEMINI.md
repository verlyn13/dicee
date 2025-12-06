# Dicee Project - Gemini CLI Context

## Project Overview

Dicee is a dice probability engine and web application for calculating and visualizing dice roll probabilities.

## Tech Stack

- **Frontend**: SvelteKit (Svelte 5 with runes)
- **Engine**: Rust/WASM probability calculations
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Realtime**: PartyKit (multiplayer/collaboration)
- **Edge**: Cloudflare (Workers, Pages, D1, KV, R2)
- **Secrets**: Infisical (self-hosted)
- **Package Manager**: pnpm (monorepo)

## Project Structure

```
packages/
  engine/     # Rust/WASM probability engine
  web/        # SvelteKit frontend
  partykit/   # Real-time collaboration server
docs/         # Architecture and planning docs
.claude/      # Claude Code config and state
scripts/      # Build and deployment scripts
```

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server
pnpm build            # Build all packages
pnpm test             # Run tests
pnpm check            # TypeScript + lint check
pnpm lint             # Lint all packages
pnpm format           # Format with Biome
```

## Code Standards

- **Biome 2.3+** for formatting and linting (NOT Prettier)
- **Svelte 5** runes syntax (`$state`, `$derived`, `$effect`)
- **Strict TypeScript** - No `any` types
- **Rust**: `cargo fmt` + `cargo clippy`

## Key Conventions

### TypeScript/Svelte
- Use `unknown` with type guards instead of `any`
- Const arrays for enums: `['A', 'B'] as const`
- Result pattern: `{ data: T | null; error: Error | null }`

### Naming
- Component files: `PascalCase.svelte`
- Callback props: `onVerb` (camelCase)
- Handlers: `handleVerb`
- Booleans: `is/has/can` prefix
- CSS classes: `kebab-case`

## Environment

- Default to `dev` environment for local work
- Secrets managed via Infisical
- Machine credentials in gopass under `dicee/` prefix

## Agent Role

Gemini CLI is best suited for:
- Research and long-context analysis
- High-volume operations
- Documentation review
- Code exploration

For architecture decisions and complex debugging, defer to Claude Code (Opus).

## Git Workflow

- Conventional commits: `type(scope): description`
- Branch naming: `type/short-description`
- PR required for main branch
