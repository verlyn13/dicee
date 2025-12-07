# Dicee Agentic Workflow Orchestration

> **Version**: 2.3.0
> **Last Updated**: 2025-12-07
> **Context**: MCP-first agentic development with Opus 4.5, multi-agent orchestration
> **Project Status**: All phases complete, production live at https://dicee.jefahnierocks.com
> **Active**: AKG MCP Server with 7 tools for architecture-aware development
> **Guardrails**: See [AGENT-GUARDRAILS.md](./AGENT-GUARDRAILS.md) for mandatory rules

---

## CRITICAL: Three Strikes Rule

**ALL AGENTS must follow the Three Strikes Rule:**
- If you fail at the same operation 3 times, **STOP and ask the human**
- This is non-negotiable and applies to all agents regardless of capability level
- See [AGENT-GUARDRAILS.md](./AGENT-GUARDRAILS.md) for full details

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [MCP Server Configuration](#mcp-server-configuration)
3. [Session State Management](#session-state-management)
4. [Agent Roles & Capabilities](#agent-roles--capabilities)
5. [Task State Schema](#task-state-schema)
6. [Handoff Protocol](#handoff-protocol)
7. [Quality Gates](#quality-gates)
8. [Workflow Commands](#workflow-commands)
9. [Guardrails & Error Handling](#guardrails--error-handling)

---

## Architecture Overview

### MCP-First Philosophy

The Model Context Protocol provides the backbone for:
- **Persistent memory** across sessions (Knowledge Graph)
- **External tool access** (Supabase, GitHub)
- **Structured state tracking** (project phases, tasks, blockers)
- **Agent interoperability** (shared context between CLI tools)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Human Orchestrator                              │
│   - High-level direction and approval                               │
│   - Context switching between agents                                 │
│   - Quality gate sign-off                                           │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    MCP Server Layer                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │   Memory    │ │  Supabase   │ │   GitHub    │ │     AKG     │   │
│  │  (KG State) │ │  (Official) │ │ (Built-in)  │ │  (Active)   │   │
│  │             │ │             │ │             │ │             │   │
│  │ • Tasks     │ │ • SQL       │ │ • PRs       │ │ • Layers    │   │
│  │ • Phases    │ │ • Types     │ │ • Issues    │ │ • Nodes     │   │
│  │ • Blockers  │ │ • Migrations│ │ • Commits   │ │ • Imports   │   │
│  │ • Decisions │ │ • Branching │ │ • Reviews   │ │ • Invariant │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     │                           │                           │
     ▼                           ▼                           ▼
┌───────────────┐    ┌───────────────────┐    ┌─────────────────┐
│  Claude Code  │    │    Windsurf/      │    │   Gemini CLI    │
│  CLI (Opus)   │    │    Cascade        │    │                 │
│               │    │                   │    │                 │
│ • Architec-   │    │ • UI components   │    │ • Research      │
│   ture        │    │ • Visual design   │    │ • Long context  │
│ • Complex     │    │ • Svelte/CSS      │    │ • Second        │
│   reasoning   │    │ • Hot reload      │    │   opinion       │
│ • Integration │    │ • Real-time       │    │ • High volume   │
│ • Debugging   │    │   tracking        │    │   operations    │
└───────────────┘    └───────────────────┘    └─────────────────┘
        │                                             │
        │         ┌───────────────────┐               │
        └────────►│   Codex CLI       │◄──────────────┘
                  │                   │
                  │ • Boilerplate     │
                  │ • Pattern         │
                  │   replication     │
                  │ • Simple CRUD     │
                  │ • Sandboxed exec  │
                  └───────────────────┘
```

---

## MCP Server Configuration

### Project-Level Configuration (`.mcp.json`)

**Important**: The memory server must be installed locally (not via npx) to ensure
environment variables are properly passed. The npx approach strips env vars.

```bash
# Install memory server as project dependency
pnpm add -D @modelcontextprotocol/server-memory
```

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": [
        "./node_modules/@modelcontextprotocol/server-memory/dist/index.js"
      ],
      "env": {
        "MEMORY_FILE_PATH": "/Users/verlyn13/Development/personal/dicee/.claude/state/memory.jsonl"
      }
    },
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=duhsbuyxyppgbkwbbtqg&read_only=false&features=database,docs,edge-functions"
    }
  }
}
```

### Global Configuration (`~/.config/claude-code/mcp_servers.json`)

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "$(gopass show -o github/dev-tools-token)"
      },
      "description": "GitHub integration - uses gopass for secure token retrieval"
    }
  }
}
```

### Memory Server Setup

```bash
# Install as project dependency (REQUIRED - don't use npx)
pnpm add -D @modelcontextprotocol/server-memory

# Create state directory
mkdir -p .claude/state

# Initialize memory file
touch .claude/state/memory.jsonl

# Add to .gitignore (state is session-specific)
echo ".claude/state/" >> .gitignore
```

**Note**: Using `npx` for the memory server will cause `ENOENT` errors because npx
isolates environment variables. Always use the local node_modules installation.

### AKG MCP Server (ACTIVE)

The AKG MCP server provides architecture-aware queries for agents. It's configured
in `.mcp.json` and enabled in `.claude/settings.local.json`.

**Configuration** (`.mcp.json`):
```json
{
  "mcpServers": {
    "akg": {
      "command": "bun",
      "args": ["run", "./packages/web/src/tools/akg/mcp/server.ts"],
      "env": {
        "AKG_GRAPH_PATH": "./docs/architecture/akg/graph/current.json",
        "AKG_DIAGRAMS_PATH": "./docs/architecture/akg/diagrams"
      }
    }
  }
}
```

**Available Tools** (7 total):

| Tool | Purpose | Agent Use Case |
|------|---------|----------------|
| `akg_layer_rules` | Get allowed/forbidden imports | "Can I import X here?" |
| `akg_node_info` | Get node type, layer, edges | "What is this file?" |
| `akg_check_import` | Validate a proposed import | Pre-flight check before writing |
| `akg_invariants` | Run architectural invariant checks | Quality gate awareness |
| `akg_diagram` | Generate Mermaid diagrams | Architecture visualization |
| `akg_path_exists` | Find dependency path | Impact analysis |
| `akg_cache_status` | Cache management | Reload graph after discovery |

**Slash Command**: Use `/akg` for quick architecture queries.

**CLI Commands**:
```bash
pnpm akg:discover   # Regenerate graph from source
pnpm akg:check      # Run invariant checks
pnpm akg:mermaid    # Generate all diagrams
pnpm akg:test       # Test MCP server
```

**Diagram Types**:
- `layer-overview` - Layer architecture
- `component-dependencies` - Component import graph
- `store-relationships` - Store dependency graph
- `dataflow` - Data flow through layers

**See**: `docs/architecture/akg/` for full documentation

---

## Session State Management

### State Persistence Strategy

1. **Knowledge Graph Memory** - Long-term project state
   - Project phases and completion status
   - Architectural decisions with rationale
   - Blockers and research findings
   - Task dependencies and priorities

2. **File-Based Checkpoints** - Human-readable snapshots
   - `.claude/state/current-phase.json` - Active phase details
   - `.claude/state/session-handoff.md` - Agent handoff notes
   - `.claude/state/blockers.json` - Current blockers

3. **Git History** - Code evolution tracking
   - Conventional commits for traceability
   - PR descriptions for context
   - Branch state for parallel work

### State Files Structure

```
.claude/
├── state/
│   ├── memory.jsonl          # MCP Memory server storage
│   ├── current-phase.json    # Active phase and tasks
│   ├── session-handoff.md    # Handoff notes for next agent
│   ├── blockers.json         # Active blockers
│   └── decisions.json        # Architectural decisions log
├── workflow-orchestration.md  # This document
├── auth-strategy.yaml        # Auth specification
├── environment-strategy.yaml # Environment configuration
├── gopass-structure.yaml     # Credential architecture
└── cli-reference.yaml        # CLI tool reference
```

---

## Agent Roles & Capabilities

### Claude Code CLI (Opus 4.5) - Primary

**SWE-bench**: 72.7% | **Context**: 200K tokens | **Cost**: API pricing

**Best For**:
- Architecture and system design
- Complex reasoning and debugging
- Multi-file refactoring
- Integration work
- Test infrastructure
- MCP orchestration

**Extended Thinking Modes**:
| Command | Budget | Use When |
|---------|--------|----------|
| "think" | Standard | Normal analysis |
| "think hard" | Medium | Complex problems |
| "think harder" | High | Architecture decisions |
| "ultrathink" | 31,999 tokens | Critical system design |

**When to Use**:
- Starting new phases
- Resolving complex blockers
- Database schema design
- Authentication flows
- API design
- Test architecture

### Windsurf/Cascade - UI Specialist

**SWE-bench**: N/A | **Context**: IDE-aware | **Cost**: Free tier

**Best For**:
- Svelte 5 component development
- CSS and visual styling
- Real-time hot reload iteration
- Responsive design implementation
- Animation polish

**When to Use**:
- Building UI components from designs
- CSS debugging
- Visual polish passes
- Component refactoring

### Gemini CLI - Research & High-Volume

**SWE-bench**: N/A | **Context**: 1M tokens | **Cost**: 1000 req/day free

**Best For**:
- Long document analysis
- Research compilation
- Second opinions on architecture
- High-volume simple operations
- Documentation synthesis

**When to Use**:
- Reading through large codebases
- Comparing library options
- Validating decisions
- Generating documentation

### Codex CLI - Efficient Implementation

**SWE-bench**: 69.1% | **Context**: Variable | **Cost**: Open source

**Best For**:
- Boilerplate generation
- Pattern replication
- Simple CRUD operations
- Sandboxed code execution

**When to Use**:
- Repetitive code patterns
- File scaffolding
- Simple migrations
- Test boilerplate

---

## Task State Schema

### Project State (stored in MCP Memory)

```typescript
interface ProjectState {
  // Current phase
  phase: {
    id: 'planning' | 'foundation' | 'auth' | 'profiles' | 'lobby' | 'multiplayer' | 'telemetry' | 'deployment';
    status: 'not-started' | 'in-progress' | 'blocked' | 'review' | 'complete';
    startedAt: string;  // ISO timestamp
    completedAt?: string;  // ISO timestamp
    blockedReason?: string;
  };

  // Tasks within current phase
  tasks: {
    id: string;
    title: string;
    status: 'pending' | 'in-progress' | 'blocked' | 'complete';
    assignedAgent: 'claude-code' | 'windsurf' | 'gemini' | 'codex' | 'human';
    dependencies: string[];  // Task IDs
    blockedReason?: string;
    completedAt?: string;
  }[];

  // Architectural decisions
  decisions: {
    id: string;
    title: string;
    decision: string;
    rationale: string;
    alternatives: string[];
    decidedAt: string;
    decidedBy: 'human' | 'claude-code';
  }[];

  // Active blockers
  blockers: {
    id: string;
    description: string;
    category: 'research' | 'design' | 'external' | 'technical';
    researchNeeded?: string;
    createdAt: string;
    resolvedAt?: string;
    resolution?: string;
  }[];

  // Service configurations
  services: {
    supabase: {
      configured: boolean;
      projectRef: string;
      migrations: string[];
      functions: string[];
    };
    vercel: {
      linked: boolean;
      domains: string[];
    };
    partykit: {
      configured: boolean;
      deployed: boolean;
    };
    infisical: {
      configured: boolean;
      environments: string[];
    };
  };
}
```

### Current Phase File (`.claude/state/current-phase.json`)

```json
{
  "phase": "auth",
  "status": "in-progress",
  "startedAt": "2025-12-02T10:00:00Z",
  "tasks": [
    {
      "id": "auth-1",
      "title": "Install Supabase packages",
      "status": "complete",
      "assignedAgent": "claude-code"
    },
    {
      "id": "auth-2",
      "title": "Create hooks.server.ts",
      "status": "in-progress",
      "assignedAgent": "claude-code"
    },
    {
      "id": "auth-3",
      "title": "Build auth UI components",
      "status": "pending",
      "assignedAgent": "windsurf",
      "dependencies": ["auth-2"]
    }
  ],
  "activeBlockers": [],
  "lastUpdated": "2025-12-02T14:30:00Z",
  "lastAgent": "claude-code"
}
```

---

## Handoff Protocol

### Session Start Protocol

When starting a new Claude Code session:

1. **Read State Files**:
   ```bash
   # Check current phase and tasks
   cat .claude/state/current-phase.json

   # Check for handoff notes
   cat .claude/state/session-handoff.md

   # Check blockers
   cat .claude/state/blockers.json
   ```

2. **Sync with MCP Memory**:
   - Query Knowledge Graph for context
   - Load recent decisions and rationale
   - Review any pending research

3. **Announce Session**:
   ```markdown
   ## Session Start: [Agent Name]

   **Date**: [ISO timestamp]
   **Phase**: [Current phase]
   **Task**: [What I'm working on]
   **Previous Agent**: [Who was here last]
   ```

### Session End Protocol

Before ending a session:

1. **Update State Files**:
   ```bash
   # Update current phase
   # (programmatically update .claude/state/current-phase.json)
   ```

2. **Write Handoff Notes** (`.claude/state/session-handoff.md`):
   ```markdown
   # Session Handoff

   ## Last Session
   - **Agent**: Claude Code (Opus 4.5)
   - **Date**: 2025-12-02T15:00:00Z
   - **Phase**: auth

   ## Completed This Session
   - [x] Installed @supabase/supabase-js and @supabase/ssr
   - [x] Created hooks.server.ts with session validation

   ## In Progress
   - [ ] auth.svelte.ts store (80% complete, needs upgrade flow)

   ## Blockers
   - None

   ## Next Steps
   1. Complete auth.svelte.ts with anonymous upgrade
   2. Create auth callback route
   3. Hand off to Windsurf for UI components

   ## Notes for Next Agent
   - Using Svelte 5 runes pattern for auth state
   - Never use getSession() on server, use getClaims()
   - PlayNowButton component already exists (packages/web/src/lib/components/auth/PlayNowButton.svelte)
   ```

3. **Commit Work** (if applicable):
   ```bash
   git add .
   git commit -m "chore(auth): [description of work]"
   ```

### Agent-to-Agent Handoff

When switching between agents (e.g., Claude Code → Windsurf):

1. **Update handoff file** with specific context
2. **List files to touch** and their purpose
3. **Specify design constraints** (tokens, patterns)
4. **Include relevant code snippets** for reference

Example handoff to Windsurf:
```markdown
## Handoff to Windsurf

**Task**: Build GoogleButton component

**Files to Create**:
- `packages/web/src/lib/components/auth/GoogleButton.svelte`

**Design Requirements** (from UI-UX-DESIGN-REPORT.md):
- Full-width on mobile, max-width 320px on desktop
- Height: 56px (comfortable touch target)
- Background: White (#FFFFFF)
- Border: 2px solid black
- Google logo + "Continue with Google" text

**Code Pattern** (reference PlayNowButton.svelte):
```svelte
<script lang="ts">
import { auth } from '$lib/stores/auth.svelte';
// ...
</script>
```

**Integration**:
- Call `auth.signInWithGoogle()` on click
- Handle loading and error states
```

---

## Quality Gates

### Before Phase Transition

```bash
# Run all quality checks
pnpm run quality-gate

# Which runs:
# 1. pnpm test              - All tests passing
# 2. pnpm lint              - Biome clean
# 3. pnpm typecheck         - TypeScript strict mode
# 4. infisical scan         - No secrets in code
```

### Quality Gate Script (`scripts/quality-gate.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Dicee Quality Gate ==="

# 1. TypeScript
echo "→ Running TypeScript check..."
pnpm typecheck

# 2. Lint
echo "→ Running Biome lint..."
pnpm lint

# 3. Tests
echo "→ Running tests..."
pnpm test

# 4. Secrets scan
echo "→ Scanning for secrets..."
infisical scan --domain=https://infisical.jefahnierocks.com || true

# 5. Build check
echo "→ Running build..."
pnpm build

echo "=== Quality Gate PASSED ==="
```

### Phase Completion Checklist

| Check | Command | Required |
|-------|---------|----------|
| Tests pass | `pnpm test` | ✅ Yes |
| Lint clean | `pnpm lint` | ✅ Yes |
| Types pass | `pnpm typecheck` | ✅ Yes |
| No secrets | `infisical scan` | ✅ Yes |
| Docs updated | Manual check | ✅ Yes |
| State files updated | Manual check | ✅ Yes |
| Human review | Manual approval | ✅ Yes |

---

## Workflow Commands

### Quick Reference

```bash
# Session start
cat .claude/state/current-phase.json
cat .claude/state/session-handoff.md

# Check project status
claude mcp call memory query '{"query": "project state"}'

# Run quality gate
./scripts/quality-gate.sh

# Update phase status
# (use TodoWrite or update current-phase.json manually)

# End session
# 1. Update current-phase.json
# 2. Write session-handoff.md
# 3. Commit if changes made
```

### Slash Commands (`.claude/commands/`)

| Command | Purpose |
|---------|---------|
| `/status` | Show current phase and tasks |
| `/handoff` | Generate handoff notes |
| `/quality` | Run quality gate checks |
| `/phase` | Update phase status |
| `/task [id]` | Pick up and work on a task |
| `/verify [id]` | Verify task completion |

---

## Guardrails & Error Handling

### The Three Strikes Rule

Every agent must follow this rule:

```
If you fail at the same operation 3 times:
1. STOP immediately
2. Do not try a 4th time
3. Report to human with:
   - What you were trying to do
   - What you tried (all 3 attempts)
   - Your analysis of why it's failing
   - Request for guidance
```

### Task Retry Tracking

Tasks in `current-phase.json` include:
- `retryCount`: Current number of failures (starts at 0)
- `maxRetries`: Maximum allowed (default 3)

When a task operation fails:
1. Increment `retryCount`
2. If `retryCount >= maxRetries`: STOP and ask human
3. Otherwise: Try a different approach

### Agent Competency Levels

| Level | Agents | Can Do | Should Escalate |
|-------|--------|--------|-----------------|
| **opus** | Claude Code (Opus 4.5) | Architecture, complex logic, multi-file refactoring | Novel architecture patterns |
| **sonnet** | Claude Code (Sonnet) | Single-file edits, following guides | Complex debugging |
| **any** | Windsurf, Codex | UI components, boilerplate | Anything not in explicit instructions |

### Error Recovery Protocol

```
1. Read the FULL error message
2. Understand what went wrong (don't guess)
3. Make ONE targeted fix
4. Test the fix
5. If still failing after 3 attempts → STOP
```

### When to Ask Human

Always ask before:
- Deleting files
- Changing database schema
- Modifying auth/security code
- Making breaking API changes
- Installing new dependencies (ask first)
- After 3 failed attempts at anything

### State File Updates

After completing any task:
1. Update task status in `current-phase.json`
2. Update `retryCount` if applicable
3. Update `lastUpdated` timestamp
4. Write handoff notes if session ending

---

## References

- [MCP Memory Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
- [Supabase MCP](https://mcp.supabase.com)
- [Anthropic MCP Docs](https://docs.anthropic.com/en/docs/mcp)
- [UI/UX Design Report](../docs/UI-UX-DESIGN-REPORT.md)
- [Auth Implementation Plan](../docs/m1/auth-implementation-plan.md)
- [Auth Strategy](./auth-strategy.yaml)
