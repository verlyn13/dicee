# Dicee Project - Claude Code Instructions

## CRITICAL: Agent Guardrails (READ FIRST)

**Before doing ANY work, read `.claude/AGENT-GUARDRAILS.md`**

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

### Slash Commands
- `/status` - Show current phase and tasks
- `/task [id]` - Pick up and work on a task
- `/verify [id]` - Verify task completion
- `/handoff` - Generate session handoff notes
- `/quality` - Run quality gate

---

## Project Overview
Dicee is a dice probability engine and web application. See `docs/` for architecture RFCs and milestone plans.

## Tech Stack
- **Frontend**: SvelteKit (Svelte 5 with runes)
- **Engine**: Rust/WASM probability calculations
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Realtime**: PartyKit (multiplayer/collaboration infrastructure)
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
  cli-reference.yaml          # CLI tool reference (Supabase/Vercel/PartyKit/Infisical)
  environment-strategy.yaml   # Environment, secrets, and agent guardrails
  gopass-structure.yaml       # Local credential storage architecture
  typescript-biome-strategy.md # TypeScript patterns and Biome 2.3 config
  auth-strategy.yaml        # Authentication architecture and identity linking
  workflow-orchestration.md # MCP-first workflow and agent orchestration
  commands/                 # Slash commands for workflow management
    status.md               # /status - Show current phase
    task.md                 # /task - Pick up and work on a task
    verify.md               # /verify - Verify task completion
    handoff.md              # /handoff - Generate handoff notes
    quality.md              # /quality - Run quality gate
    phase.md                # /phase - Update phase status
  state/                    # Session state (git-ignored)
    current-phase.json      # Active phase and tasks
    session-handoff.md      # Handoff notes
    blockers.json           # Active blockers
    decisions.json          # Architectural decisions
scripts/
  setup-gopass-credentials.sh  # Initialize gopass structure
  quality-gate.sh           # Quality gate checks before phase transition
  dicee-env.fish            # Fish function for Infisical credential loading
  dicee-cf.fish             # Fish function for Cloudflare credential loading
  hooks/                    # Claude Code lifecycle hooks
    session-init.sh         # Session start: load state, show phase
    session-finalize.sh     # Session end: persist state
    log-tool-use.sh         # PostToolUse: log operations
    pre-compact-archive.sh  # PreCompact: archive before compaction
```

## CLI Tools Reference

**CRITICAL**: For Supabase, Vercel, PartyKit, Infisical, and Wrangler CLI commands, always consult `.claude/cli-reference.yaml` first. This file contains accurate, version-specific command documentation generated from actual `--help` output. Do NOT rely on training data for these CLIs as they evolve rapidly.

### Current CLI Versions
- Supabase CLI: 2.62.10
- Vercel CLI: 48.12.1
- PartyKit CLI: 0.0.115
- Infisical CLI: 0.43.35
- Wrangler CLI: 4.51.0

### Infisical Project Configuration
- **Instance**: https://infisical.jefahnierocks.com (self-hosted)
- **Project**: dicee (slug: dicee-dsmc)
- **Project ID**: b15c7b9c-4e1f-447a-a326-4c382b6db706
- **Environments**: dev, staging, prod

### Supabase Project Configuration
- **Project Ref**: duhsbuyxyppgbkwbbtqg
- **Project URL**: https://duhsbuyxyppgbkwbbtqg.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/duhsbuyxyppgbkwbbtqg
- **Auth Callback**: https://duhsbuyxyppgbkwbbtqg.supabase.co/auth/v1/callback
- **Local API**: http://127.0.0.1:54321
- **Local Studio**: http://127.0.0.1:54323

### Google Cloud Project (OAuth)
- **Project Name**: dicee
- **Project ID**: dicee-480100
- **Project Number**: 1071795876982
- **Console**: https://console.cloud.google.com/welcome?project=dicee-480100
- **Credentials**: https://console.cloud.google.com/apis/credentials?project=dicee-480100

### Cloudflare Configuration
- **Account ID**: 13eb584192d9cefb730fde0cfd271328
- **Zone ID**: 8d5f44e67ab4b37e47b034ff48b03099
- **Domain**: jefahnierocks.com
- **Subdomain**: dicee.jefahnierocks.com
- **Services**: Workers, Pages, D1 (SQLite), KV, R2

### Quick Reference

#### Supabase - Local Development
```bash
supabase start              # Start local dev environment
supabase status             # Check service status
supabase stop               # Stop containers
supabase db reset           # Reset local database
supabase gen types --local  # Generate TypeScript types
```

#### Supabase - Remote Operations
```bash
supabase link --project-ref <ref>  # Link to remote project
supabase db push                    # Push migrations to remote
supabase functions deploy           # Deploy edge functions
supabase secrets set KEY=VALUE      # Set secrets
```

#### Vercel - Deployment
```bash
vercel link           # Link to Vercel project
vercel pull           # Pull env vars and settings
vercel               # Deploy to preview
vercel --prod        # Deploy to production
vercel env list      # List environment variables
```

#### PartyKit - Real-time Development
```bash
partykit dev                  # Start local dev server
partykit dev --port 1999      # Custom port
partykit dev --live           # With live reload
partykit deploy               # Deploy to PartyKit platform
partykit deploy --preview dev # Deploy to preview environment
partykit tail                 # Stream live logs
```

#### PartyKit - Environment & Management
```bash
partykit env list             # List environment variables
partykit env add SECRET_KEY   # Add env var (prompts for value)
partykit list                 # List deployed projects
partykit info                 # Get project info
```

#### Wrangler - Workers Development
```bash
wrangler login                # Browser-based OAuth login
wrangler whoami               # Verify authentication
wrangler dev                  # Start local dev server
wrangler dev --remote         # Use remote resources
wrangler deploy               # Deploy to production
wrangler deploy --env staging # Deploy to staging
```

#### Wrangler - D1/KV/R2 Storage
```bash
wrangler d1 list                                # List D1 databases
wrangler d1 execute DB_NAME --file schema.sql   # Run migrations
wrangler kv namespace list                      # List KV namespaces
wrangler r2 bucket list                         # List R2 buckets
wrangler pages deploy ./dist                    # Deploy Pages site
```

#### Wrangler - Secrets
```bash
wrangler secret put API_KEY   # Set secret (prompts for value)
wrangler secret list          # List all secrets
wrangler tail                 # Stream production logs
```

#### Infisical - Secret Management (Self-hosted)
```bash
# Always use --domain for self-hosted instance
infisical login --domain=https://infisical.jefahnierocks.com
infisical init                                    # Link project (creates .infisical.json)
infisical secrets --env=dev                       # List dev secrets
infisical secrets get API_KEY --env=prod          # Get specific secret
infisical secrets set KEY=value --env=dev         # Set a secret
```

#### Infisical - Run with Secrets
```bash
infisical run --env=dev -- npm run dev            # Inject secrets into process
infisical run --env=dev --watch -- npm run dev    # Auto-reload on changes
infisical export --env=dev -o .env.local          # Export to .env file
infisical scan                                    # Scan for leaked secrets
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
pnpm akg:discover              # Discover graph (138 nodes, 230 edges)
pnpm akg:discover --incremental # Only changed files (fast, for PRs)
pnpm akg:check                 # Run invariant checks (6 built-in)
pnpm akg:check --sarif         # SARIF output for GitHub Code Scanning
pnpm akg:check --json          # JSON output for agents/CI
pnpm akg:discover --watch      # Watch mode (developer use, not agents)
```

> Frontend unit tests must run through `pnpm web:vitest -- <args>` so SvelteKit injects its Vite plugin stack and agent logs capture the scoped test run.

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

### Rust
- `cargo fmt` for formatting
- `cargo clippy` for linting
- Target: `wasm32-unknown-unknown`

### Testing
- Vitest for unit tests
- Playwright for E2E tests
- Test files co-located with source (`*.test.ts`)
- Svelte component mocks should export `.svelte` fixtures or re-use production components; avoid class/function stand-ins that skip the compiler.

## Environment Variables

**Primary secret management**: Infisical (self-hosted)
- All secrets stored in Infisical project `dicee` (dicee-dsmc)
- Environments: `dev`, `staging`, `prod`
- Use `infisical run` to inject at runtime or `infisical export` for local files

Environment variables are managed through:
1. **Infisical**: Primary secret store (all environments) via `infisical secrets`
2. **Vercel**: Deployment env vars synced from Infisical via `vercel env`
3. **Supabase**: Edge function secrets via `supabase secrets`
4. **PartyKit**: Real-time service secrets via `partykit env`
5. **Local**: `.env.local` file (git-ignored) - export from Infisical

Required variables:
- `PUBLIC_SUPABASE_URL` - Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `PUBLIC_PARTYKIT_HOST` - PartyKit server URL (when deployed)
- `INFISICAL_CLIENT_ID` - For machine identity auth (CI/CD)
- `INFISICAL_CLIENT_SECRET` - For machine identity auth (CI/CD)

## Credential Management (gopass)

Machine identity credentials are stored in gopass under `dicee/` prefix.
See `.claude/gopass-structure.yaml` for full architecture.

### Gopass Structure
```
dicee/
├── infisical/
│   ├── instance-url              # https://infisical.jefahnierocks.com
│   ├── project-id                # b15c7b9c-4e1f-447a-a326-4c382b6db706
│   ├── project-slug              # dicee-dsmc
│   ├── dev/
│   │   ├── client-id             # Universal Auth client ID
│   │   └── client-secret         # Universal Auth client secret
│   ├── staging/
│   │   ├── client-id
│   │   └── client-secret
│   └── prod/
│       ├── client-id
│       └── client-secret
├── cloudflare/
│   ├── account-id                # 13eb584192d9cefb730fde0cfd271328
│   ├── zone-id                   # 8d5f44e67ab4b37e47b034ff48b03099
│   ├── domain                    # jefahnierocks.com
│   ├── subdomain                 # dicee.jefahnierocks.com
│   └── api-token                 # Wrangler CLI API token
└── github/
    └── pat                       # Fine-grained PAT
```

### Setup
```bash
# One-time setup (populates non-sensitive values)
./scripts/setup-gopass-credentials.sh

# Manually enter client secrets
gopass insert dicee/infisical/dev/client-secret
gopass insert dicee/infisical/staging/client-secret
gopass insert dicee/infisical/prod/client-secret
```

### Usage
```bash
# Fish shell functions (install first)
cp scripts/dicee-env.fish ~/.config/fish/functions/
cp scripts/dicee-cf.fish ~/.config/fish/functions/

# Load Infisical credentials for environment
dicee-env dev       # or: staging, prod
dicee-env --clear   # Clear credentials

# Load Cloudflare credentials
dicee-cf            # Load credentials and verify
dicee-cf --clear    # Clear credentials

# Direct retrieval (Infisical)
gopass show -o dicee/infisical/dev/client-id
gopass show -o dicee/infisical/dev/client-secret

# Infisical login with gopass
infisical login \
  --method=universal-auth \
  --client-id=$(gopass show -o dicee/infisical/dev/client-id) \
  --client-secret=$(gopass show -o dicee/infisical/dev/client-secret) \
  --domain=$(gopass show -o dicee/infisical/instance-url)

# Load Cloudflare credentials for Wrangler
export CLOUDFLARE_API_TOKEN=$(gopass show -o dicee/cloudflare/api-token)
export CLOUDFLARE_ACCOUNT_ID=$(gopass show -o dicee/cloudflare/account-id)
wrangler whoami  # Verify authentication
```

## Git Workflow
- Conventional commits: `type(scope): description`
- Branch naming: `type/short-description`
- PR required for main branch

## Environments

See `.claude/environment-strategy.yaml` for full architecture.

| Environment | Infisical | Vercel | Cloudflare | Purpose |
|-------------|-----------|--------|------------|---------|
| `dev` | dev | development | preview | Local development, feature work |
| `staging` | staging | preview | staging env | Pre-production testing, QA |
| `prod` | prod | production | production | Live users - **restricted** |

**Default to `dev`** for all local work. Never use `prod` without explicit deployment intent.

### Infisical Secret Paths
```
/           # Shared secrets (all services)
/web        # Frontend-specific
/engine     # Rust engine secrets
/shared     # Cross-service configuration
```

## Agent Guidelines

**Full guardrails documentation: `.claude/AGENT-GUARDRAILS.md`**

### Core Rules (MANDATORY)
1. **Three Strikes Rule** - 3 failed attempts = STOP and ask human
2. **Read before edit** - NEVER modify a file you haven't read this session
3. **Verify after change** - Run tests/typecheck after every edit
4. **Update state** - Keep `.claude/state/` files current
5. **Use CLI reference** - Consult `.claude/cli-reference.yaml` for CLI commands

### General
6. **Prefer minimal changes** - Don't over-engineer or add unnecessary features
7. **Follow existing patterns** - Match the codebase style and conventions
8. **Test changes** - Run relevant tests before completing tasks

### Secret Handling (CRITICAL)
9. **NEVER hardcode secrets** - Use Infisical for all application secrets
10. **NEVER log/print secrets** - Even in debug output
11. **NEVER commit .env files** - Only .env.example with placeholders
12. **Self-hosted Infisical** - Always use `--domain=https://infisical.jefahnierocks.com`
13. **Verify environment** - Check `$DICEE_ENV` before secret operations
14. **Use gopass for infra creds** - Machine identities, PATs stored locally

### Environment Safety
15. **Default to dev** - Unless explicitly working on staging/prod
16. **Confirm before prod** - Always verify environment for deployments
17. **Scan before commit** - Run `infisical scan` to detect leaked secrets

### Credential Retrieval Patterns
```bash
# Safe: Use gopass for infrastructure credentials
gopass show -o dicee/infisical/dev/client-id
gopass show -o dicee/cloudflare/api-token

# Safe: Use infisical for application secrets
infisical secrets get API_KEY --env=dev --plain

# Safe: Inject secrets at runtime
infisical run --env=dev -- <command>

# Safe: Load Cloudflare credentials for wrangler
export CLOUDFLARE_API_TOKEN=$(gopass show -o dicee/cloudflare/api-token)

# UNSAFE: Never echo/print secret values
# UNSAFE: Never interpolate secrets into logged strings
```

## MCP-First Workflow

This project uses Model Context Protocol for persistent state and tool access.
See `.claude/workflow-orchestration.md` for complete specification.

### MCP Servers Configured

| Server | Purpose | Transport |
|--------|---------|-----------|
| **memory** | Knowledge Graph for persistent project state | stdio (local) |
| **supabase** | Database, migrations, types, edge functions | HTTP (hosted) |
| **github** | PRs, issues, commits (global config) | stdio (local) |

#### Supabase MCP Authentication

The Supabase MCP uses token-based authentication loaded from gopass. **Start Claude Code with the `dicee-claude` function** to ensure the token is available:

```bash
# Start Claude Code with Supabase MCP token pre-loaded
dicee-claude

# The function loads SUPABASE_MCP_TOKEN from gopass before starting
# Token stored at: dicee/supabase/mcp-token
```

**Setup (one-time)**:
```bash
# Store your Supabase PAT in gopass
gopass insert dicee/supabase/mcp-token

# Fish function is at ~/.config/fish/functions/dicee-claude.fish
```

**Check status**: `claude mcp list`
- `✓ Connected` = Token loaded successfully
- `⚠ Needs authentication` = Started without `dicee-claude`, restart with it

Configuration in `.mcp.json`:
```json
{
  "supabase": {
    "type": "http",
    "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg&read_only=false&features=database,docs,functions",
    "headers": {
      "Authorization": "Bearer ${SUPABASE_MCP_TOKEN}"
    }
  }
}
```

### Slash Commands

| Command | Purpose |
|---------|---------|
| `/status` | Show current phase and tasks |
| `/handoff` | Generate handoff notes for next agent |
| `/quality` | Run quality gate checks |
| `/phase` | Update phase status |
| `/mcp-auth` | Check and authenticate MCP servers |

### Hooks

Claude Code hooks are configured in `.claude/settings.json` for automated workflow management.

| Hook | Trigger | Action |
|------|---------|--------|
| `SessionStart` | Session begins | Load project state, show current phase |
| `SessionEnd` | Session ends | Update timestamps, persist state |
| `PostToolUse` | After Bash/Edit/Write | Log tool operations to memory |
| `PreCompact` | Before context compaction | Archive state files |

Hook scripts are in `scripts/hooks/`:
- `session-init.sh` - Initialize session, log to memory.jsonl
- `session-finalize.sh` - Finalize session, update timestamps
- `log-tool-use.sh` - Log tool operations
- `pre-compact-archive.sh` - Archive state before compaction

### State Files

```
.claude/state/
├── memory.jsonl          # MCP Memory server storage
├── current-phase.json    # Active phase and tasks
├── session-handoff.md    # Handoff notes for next agent
├── blockers.json         # Active blockers
└── decisions.json        # Architectural decisions log
```

### Session Protocol

**Start of session**:
1. Read `.claude/state/current-phase.json`
2. Read `.claude/state/session-handoff.md`
3. Announce session start and task

**End of session**:
1. Update `current-phase.json` with progress
2. Write handoff notes to `session-handoff.md`
3. Commit work if applicable

### Quality Gate

Before phase transitions, run:
```bash
./scripts/quality-gate.sh
```

Checks: TypeScript, Biome lint, tests, secrets scan, build

### Agent Roles

| Agent | Best For |
|-------|----------|
| **Claude Code (Opus 4.5)** | Architecture, complex logic, debugging, integration |
| **Windsurf/Cascade** | UI components, Svelte/CSS, visual polish |
| **Gemini CLI** | Research, long context, high-volume ops |
| **Codex CLI** | Boilerplate, pattern replication, simple CRUD |

### Architectural Knowledge Graph (AKG)

Static analysis tool for enforcing architectural invariants. Integrated into CI via GitHub Actions with SARIF output for Code Scanning.

**Agent Usage:**
```bash
# Discrete commands (agent-appropriate)
pnpm akg:discover              # Full discovery
pnpm akg:discover --incremental # Fast: only changed files
pnpm akg:check --json          # Structured output for parsing
pnpm akg:check --sarif         # SARIF for GitHub integration

# Developer tools (not for agents)
pnpm akg:discover --watch      # Live feedback during development
```

**Key Files:**
```
packages/web/src/tools/akg/
├── schema/           # Zod schemas (graph, invariant, config)
├── config/           # Config loader
├── discovery/        # ts-morph + Svelte compiler integration
├── query/            # Query engine, traversal, cycle detection
├── invariants/       # Registry, runner, 6 built-in invariants
├── output/           # SARIF 2.1.0 output generator
└── cli/              # discover.ts, check.ts
```

**Built-in Invariants (6):**
| ID | Severity | Description |
|----|----------|-------------|
| `wasm_single_entry` | Error | Only engine.ts imports WASM modules |
| `store_no_circular_deps` | Error | Stores must not have circular dependencies |
| `layer_component_isolation` | Warning | Dumb components shouldn't import stores |
| `service_layer_boundaries` | Error | Services shouldn't import UI layers |
| `store_file_naming` | Error | Store files must use .svelte.ts extension |
| `callback_prop_naming` | Warning | Callback props use onVerb pattern |

**Output:**
- Graph: `docs/architecture/akg/graph/current.json` (138 nodes, 230 edges)
- SARIF: `pnpm akg:check --sarif > results.sarif`
- CI: Runs automatically on every PR via `.github/workflows/ci.yml`

**Documentation:**
- `docs/architecture/akg/AUTHORING_INVARIANTS.md` - Custom invariant guide
- `docs/architecture/akg/WEEK_5_CI_INTEGRATION.md` - CI setup details

### Extended Thinking

| Keyword | Use Case |
|---------|----------|
| "think" | Normal analysis |
| "think hard" | Complex problems |
| "think harder" | Architecture decisions |
| "ultrathink" | Critical system design (31,999 tokens) |
