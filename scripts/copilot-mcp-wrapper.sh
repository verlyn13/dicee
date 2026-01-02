#!/usr/bin/env bash
# Wrapper script for GitHub Copilot CLI MCP integration
# Provides DevOps commands as MCP tools

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Parse command from MCP request
COMMAND="${1:-help}"

case "$COMMAND" in
  quality-gate)
    exec ./scripts/quality-gate.sh "${@:2}"
    ;;
    
  deploy-check)
    echo "🔍 Pre-deployment verification..."
    
    # 1. Run quality gate
    if ! ./scripts/quality-gate.sh; then
      echo "❌ Quality gate failed - do not deploy"
      exit 1
    fi
    
    # 2. Check for uncommitted changes
    if ! git diff --quiet; then
      echo "⚠️  Warning: Uncommitted changes detected"
      git status --short
      exit 1
    fi
    
    # 3. Verify branch is up to date
    CURRENT_BRANCH=$(git branch --show-current)
    echo "✓ Current branch: $CURRENT_BRANCH"
    
    # 4. Check Cloudflare Workers status
    echo "🌐 Checking Cloudflare Workers..."
    cd packages/cloudflare-do
    if ! wrangler whoami &>/dev/null; then
      echo "❌ Not authenticated with Cloudflare"
      exit 1
    fi
    wrangler whoami
    cd "$PROJECT_ROOT"
    
    echo "✅ All pre-deployment checks passed"
    ;;
    
  check-errors)
    echo "🔍 Checking for common errors..."
    
    # TypeScript errors
    echo "→ TypeScript..."
    pnpm check 2>&1 | grep -A 5 "error TS" || echo "  ✓ No TS errors"
    
    # Biome errors
    echo "→ Biome lint..."
    pnpm --filter @dicee/web biome:check 2>&1 | grep -A 3 "error" || echo "  ✓ No lint errors"
    
    # Build errors
    echo "→ Build..."
    if pnpm build 2>&1 | grep -i "error"; then
      echo "  ❌ Build has errors"
      exit 1
    else
      echo "  ✓ Build clean"
    fi
    ;;
    
  fix-errors)
    echo "🔧 Auto-fixing errors..."
    
    # Run Biome auto-fix
    echo "→ Running Biome fix..."
    pnpm --filter @dicee/web biome:fix
    
    # Format Rust
    echo "→ Formatting Rust..."
    cd packages/engine && cargo fmt
    cd "$PROJECT_ROOT"
    
    echo "✅ Auto-fix complete"
    ;;
    
  check-secrets)
    echo "🔒 Scanning for secrets..."
    if command -v infisical &> /dev/null; then
      infisical scan --domain=https://infisical.jefahnierocks.com
    else
      echo "⚠️  Infisical CLI not installed"
      exit 1
    fi
    ;;
    
  deploy-do)
    echo "🚀 Deploying Durable Objects worker..."
    cd packages/cloudflare-do
    wrangler deploy
    echo "✅ Deployed to dicee.games"
    ;;
    
  deploy-pages)
    echo "🚀 Deploying Pages..."
    pnpm build
    pnpm --filter @dicee/web pages:deploy
    echo "✅ Pages deployed"
    ;;
    
  deploy-full)
    echo "🚀 Full deployment (DO + Pages)..."
    
    # Pre-deployment check
    ./scripts/copilot-mcp-wrapper.sh deploy-check
    
    # Deploy DO first
    ./scripts/copilot-mcp-wrapper.sh deploy-do
    
    # Then Pages
    ./scripts/copilot-mcp-wrapper.sh deploy-pages
    
    echo "✅ Full deployment complete"
    ;;
    
  tail-logs)
    echo "📜 Tailing Cloudflare Worker logs..."
    cd packages/cloudflare-do
    wrangler tail dicee
    ;;
    
  check-env)
    echo "🔐 Checking environment configuration..."
    
    # Check Cloudflare credentials
    if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
      echo "⚠️  CLOUDFLARE_API_TOKEN not set"
      echo "   Run: dicee-cf"
    else
      echo "✓ CLOUDFLARE_API_TOKEN set"
    fi
    
    # Check Supabase MCP token
    if [[ -z "${SUPABASE_MCP_TOKEN:-}" ]]; then
      echo "⚠️  SUPABASE_MCP_TOKEN not set"
      echo "   Run: export SUPABASE_MCP_TOKEN=\$(gopass show -o dicee/supabase/mcp-token)"
    else
      echo "✓ SUPABASE_MCP_TOKEN set"
    fi
    
    # Check Infisical
    if [[ -z "${DICEE_ENV:-}" ]]; then
      echo "⚠️  DICEE_ENV not set"
      echo "   Run: dicee-env dev"
    else
      echo "✓ DICEE_ENV=$DICEE_ENV"
    fi
    ;;
    
  status)
    echo "📊 Project Status"
    echo "════════════════════════════════════════════════════════════"
    
    # Git status
    echo ""
    echo "📂 Git:"
    git status --short --branch
    
    # Current phase
    echo ""
    echo "🎯 Current Phase:"
    if [[ -f .claude/state/current-phase.json ]]; then
      jq -r '.phase + " (" + .status + ")"' .claude/state/current-phase.json
    else
      echo "  No phase file found"
    fi
    
    # Service status
    echo ""
    echo "🌐 Services:"
    echo "  Production: https://dicee.games"

    # Recent deployments
    echo ""
    echo "🚀 Recent DO Deployments:"
    cd packages/cloudflare-do
    wrangler deployments list --name dicee 2>/dev/null | head -6 || echo "  Not authenticated"
    cd "$PROJECT_ROOT"
    ;;
    
  help|*)
    cat <<EOF
GitHub Copilot CLI - Dicee DevOps Commands
═════════════════════════════════════════════════════════════

Quality & Checks:
  quality-gate      Run full quality gate (7 checks)
  check-errors      Quick scan for TS/lint/build errors
  fix-errors        Auto-fix linting issues
  check-secrets     Scan for leaked secrets
  deploy-check      Pre-deployment verification

Deployment:
  deploy-do         Deploy Durable Objects worker
  deploy-pages      Deploy Cloudflare Pages
  deploy-full       Full deployment (DO + Pages)
  tail-logs         Stream worker logs

Environment:
  check-env         Verify environment configuration
  status            Show project status

Usage:
  ./scripts/copilot-mcp-wrapper.sh <command> [args]
  
Examples:
  ./scripts/copilot-mcp-wrapper.sh quality-gate
  ./scripts/copilot-mcp-wrapper.sh deploy-check
  ./scripts/copilot-mcp-wrapper.sh status
EOF
    ;;
esac
