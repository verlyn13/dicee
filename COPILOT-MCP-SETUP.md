# GitHub Copilot CLI MCP Configuration - Summary

## What Was Created

### 1. Configuration Files

**`.copilot-mcp.json`** - MCP server definitions for Copilot CLI
- `dicee-akg`: Architecture Knowledge Graph MCP server (7 tools)
- `dicee-devops`: DevOps commands wrapper (quality gates, deployment)

### 2. Scripts

**`scripts/copilot-mcp-wrapper.sh`** - DevOps command wrapper
Provides 11 commands for:
- Quality checks (quality-gate, check-errors, fix-errors, check-secrets)
- Deployment (deploy-do, deploy-pages, deploy-full, tail-logs, deploy-check)
- Environment (check-env, status)

**`scripts/setup-copilot-mcp.sh`** - One-time setup script
- Backs up existing Copilot config
- Merges Dicee servers without overwriting other projects
- Tests AKG server and wrapper script

### 3. Documentation

**`.copilot-mcp-README.md`** - Complete usage guide
- Setup instructions
- Available commands and tools
- Typical workflows
- Troubleshooting

## Key Differences from Claude Code MCP

| Aspect | Claude Code | Copilot CLI |
|--------|-------------|-------------|
| **Config Location** | `.mcp.json` (project) | `~/.copilot/mcp-config.json` (global) |
| **Config Schema** | Direct `mcpServers` object | Wrapped in `mcpServers` key |
| **Server Type** | `command` or `type: "http"` | `type: "local"` or `type: "http"` |
| **Tools Filter** | Not specified | `tools: ["*"]` |
| **Primary Use** | Development (architecture, coding) | DevOps (deployment, monitoring) |

## Architecture

```
GitHub Copilot CLI (Opus 4.5)
    ↓
~/.copilot/mcp-config.json
    ├── dicee-akg (MCP Server)
    │   ├── Tool: akg_layer_rules
    │   ├── Tool: akg_node_info
    │   ├── Tool: akg_check_import
    │   ├── Tool: akg_invariants
    │   ├── Tool: akg_diagram
    │   ├── Tool: akg_path_exists
    │   └── Tool: akg_cache_status
    │
    └── dicee-devops (Command Wrapper)
        └── scripts/copilot-mcp-wrapper.sh
            ├── quality-gate (7 checks)
            ├── deploy-check
            ├── deploy-full
            └── ... (8 more commands)
```

## Use Cases for Copilot CLI

### 1. Pre-Commit Error Checking
```bash
copilot
> "Check for errors before I commit"
```
Runs: `check-errors` → scans TS, lint, build errors

### 2. Pre-Deployment Validation
```bash
> "Run quality gate and verify deployment readiness"
```
Runs: `quality-gate` → `deploy-check` → reports status

### 3. Architecture Validation
```bash
> "Can I import authStore in DumbButton component?"
```
Uses: `akg_check_import` → validates layer rules

### 4. Production Deployment
```bash
> "Deploy to production"
```
Runs: `deploy-full` → quality-gate → deploy-do → deploy-pages

### 5. Error Fixing
```bash
> "Fix all linting errors"
```
Runs: `fix-errors` → Biome auto-fix + Rust format

## Agent Division of Labor

### Claude Code CLI (Primary)
- **Focus**: Architecture, complex logic, multi-file refactoring
- **MCP**: memory, supabase, github, akg (full 7 tools)
- **Use When**: Building features, debugging, integration work

### GitHub Copilot CLI (DevOps)
- **Focus**: Error checking, quality gates, deployment, monitoring
- **MCP**: dicee-akg (architecture queries), dicee-devops (commands)
- **Use When**: Pre-commit, pre-deployment, production ops

### Windsurf/Cascade
- **Focus**: UI components, Svelte, CSS
- **MCP**: None (IDE-based)
- **Use When**: Visual work, component building

## Installation

```bash
# 1. Navigate to project
cd /Users/verlyn13/Development/personal/dicee

# 2. Run setup script
./scripts/setup-copilot-mcp.sh

# 3. Verify
copilot
> "What architecture layers exist?"
```

## Environment Prerequisites

Before using deployment commands:

```bash
# Cloudflare credentials
dicee-cf

# Infisical environment
dicee-env dev  # or staging/prod

# Supabase MCP token (if needed)
export SUPABASE_MCP_TOKEN=$(gopass show -o dicee/supabase/mcp-token)
```

## Quality Gate (7 Checks)

The `quality-gate` command runs:

1. ✅ TypeScript & Rust type checking
2. ✅ AKG architectural invariants (6 invariants)
3. ✅ Biome lint (errors fail, warnings OK)
4. ✅ Test suite (all tests must pass)
5. ✅ Secrets scan (Infisical)
6. ✅ Build verification
7. ✅ AKG diagram staleness check

**Exit Codes:**
- `0` = All checks passed
- `1` = One or more checks failed

## AKG MCP Server (7 Tools)

When `dicee-akg` server is active in Copilot CLI:

| Tool | Query Type | Example |
|------|------------|---------|
| `akg_layer_rules` | Architecture rules | "What can import stores?" |
| `akg_node_info` | File metadata | "What layer is DiceDisplay?" |
| `akg_check_import` | Import validation | "Can I import this here?" |
| `akg_invariants` | Quality checks | "Are there violations?" |
| `akg_diagram` | Visualization | "Show layer structure" |
| `akg_path_exists` | Dependency trace | "Does X depend on Y?" |
| `akg_cache_status` | Cache management | "Reload graph" |

## Project Structure

```
dicee/
├── .copilot-mcp.json              # Server definitions
├── .copilot-mcp-README.md         # Usage documentation
├── scripts/
│   ├── copilot-mcp-wrapper.sh     # DevOps commands
│   └── setup-copilot-mcp.sh       # One-time setup
├── docs/architecture/akg/
│   ├── graph/current.json         # AKG graph (136 nodes)
│   └── diagrams/                  # Mermaid diagrams
└── packages/web/src/tools/akg/
    └── mcp/server.ts              # AKG MCP server implementation
```

## Next Steps

1. **Install**: Run `./scripts/setup-copilot-mcp.sh`
2. **Test**: Open Copilot CLI in project, ask architecture questions
3. **Use**: Integrate into pre-commit/pre-deploy workflows
4. **Monitor**: Use for production debugging and log tailing

## Troubleshooting

### Server Won't Start
```bash
# Regenerate AKG graph
pnpm akg:discover

# Test server manually
pnpm akg:test
```

### Commands Not Found
```bash
# Ensure you're in project root
cd /Users/verlyn13/Development/personal/dicee

# Verify wrapper is executable
chmod +x ./scripts/copilot-mcp-wrapper.sh
```

### Deployment Fails Auth
```bash
# Load Cloudflare credentials
dicee-cf

# Verify
wrangler whoami
```

## References

- `.claude/workflow-orchestration.md` - MCP architecture overview
- `.claude/AGENT-GUARDRAILS.md` - Agent rules and boundaries
- `docs/architecture/akg/` - AKG documentation
- `scripts/quality-gate.sh` - Quality gate implementation
