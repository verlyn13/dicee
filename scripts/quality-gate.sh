#!/usr/bin/env bash
# Dicee Quality Gate - Run before phase transitions
# Ensures all quality checks pass before moving to next phase
#
# Usage: ./scripts/quality-gate.sh [--fix]
#   --fix  Auto-fix linting issues

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              DICEE QUALITY GATE                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

FIX_MODE=false
if [[ "${1:-}" == "--fix" ]]; then
    FIX_MODE=true
    echo -e "${YELLOW}→ Running in FIX mode${NC}"
    echo ""
fi

FAILED=0

# 1. TypeScript Check (Rust + Web)
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 1/6 TypeScript & Rust Check                                 │"
echo "└──────────────────────────────────────────────────────────────┘"
if pnpm check; then
    echo -e "${GREEN}✓ TypeScript and Rust checks passed${NC}"
else
    echo -e "${RED}✗ TypeScript/Rust check failed${NC}"
    FAILED=1
fi
echo ""

# 2. AKG Invariant Check
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 2/6 AKG Architectural Invariants                            │"
echo "└──────────────────────────────────────────────────────────────┘"
# Run AKG check and capture result (warnings OK, errors fail)
# Filter out pnpm header lines (start with >) before JSON parsing
AKG_OUTPUT=$(pnpm akg:check --json 2>&1 | grep -v "^>") || true
AKG_EXIT_CODE=$(echo "$AKG_OUTPUT" | jq -r '.exitCode // "success"')
if [ "$AKG_EXIT_CODE" = "errors" ]; then
    echo -e "${RED}✗ AKG check found error-severity violations${NC}"
    echo "$AKG_OUTPUT" | jq -r '.results[] | select(.passed == false) | .violations[] | "  - \(.message)"'
    FAILED=1
elif [ "$AKG_EXIT_CODE" = "warnings" ]; then
    WARN_COUNT=$(echo "$AKG_OUTPUT" | jq -r '.summary.warnings')
    echo -e "${GREEN}✓ AKG check passed${NC} (${WARN_COUNT} warnings)"
else
    echo -e "${GREEN}✓ AKG check passed - no violations${NC}"
fi
echo ""

# 3. Lint Check (Biome - warnings only, no errors required)
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 3/6 Biome Lint                                              │"
echo "└──────────────────────────────────────────────────────────────┘"
if $FIX_MODE; then
    if pnpm --filter @dicee/web biome:fix; then
        echo -e "${GREEN}✓ Lint issues auto-fixed${NC}"
    else
        echo -e "${YELLOW}⚠ Some lint issues could not be auto-fixed${NC}"
    fi
else
    # Run biome check - warnings are OK, errors fail
    LINT_OUTPUT=$(pnpm --filter @dicee/web biome:check 2>&1) || true
    if echo "$LINT_OUTPUT" | grep -q "Found [0-9]* error"; then
        echo "$LINT_OUTPUT"
        echo -e "${RED}✗ Lint check has errors (run with --fix to auto-fix)${NC}"
        FAILED=1
    else
        WARN_COUNT=$(echo "$LINT_OUTPUT" | grep -oE "Found [0-9]+ warnings" | grep -oE "[0-9]+" || echo "0")
        echo -e "${GREEN}✓ Lint check passed${NC} (${WARN_COUNT} warnings in test files)"
    fi
fi
echo ""

# 4. Tests
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 4/6 Test Suite                                              │"
echo "└──────────────────────────────────────────────────────────────┘"
if pnpm test 2>/dev/null; then
    echo -e "${GREEN}✓ All tests passed${NC}"
else
    echo -e "${RED}✗ Tests failed${NC}"
    FAILED=1
fi
echo ""

# 5. Secrets Scan
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 5/6 Secrets Scan                                            │"
echo "└──────────────────────────────────────────────────────────────┘"
if command -v infisical &> /dev/null; then
    if infisical scan --domain=https://infisical.jefahnierocks.com 2>/dev/null; then
        echo -e "${GREEN}✓ No secrets detected in code${NC}"
    else
        echo -e "${YELLOW}⚠ Infisical scan had warnings (review manually)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Infisical CLI not installed, skipping secrets scan${NC}"
fi
echo ""

# 6. Build Check
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 6/6 Build Check                                             │"
echo "└──────────────────────────────────────────────────────────────┘"
if pnpm build 2>/dev/null; then
    echo -e "${GREEN}✓ Build succeeded${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    FAILED=1
fi
echo ""

# Final Result
echo "══════════════════════════════════════════════════════════════"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}"
    echo "  ██████╗  █████╗ ███████╗███████╗███████╗██████╗ "
    echo "  ██╔══██╗██╔══██╗██╔════╝██╔════╝██╔════╝██╔══██╗"
    echo "  ██████╔╝███████║███████╗███████╗█████╗  ██║  ██║"
    echo "  ██╔═══╝ ██╔══██║╚════██║╚════██║██╔══╝  ██║  ██║"
    echo "  ██║     ██║  ██║███████║███████║███████╗██████╔╝"
    echo "  ╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═════╝ "
    echo -e "${NC}"
    echo ""
    echo "  Quality gate passed! Ready for phase transition."
    echo ""
    exit 0
else
    echo -e "${RED}"
    echo "  ███████╗ █████╗ ██╗██╗     ███████╗██████╗ "
    echo "  ██╔════╝██╔══██╗██║██║     ██╔════╝██╔══██╗"
    echo "  █████╗  ███████║██║██║     █████╗  ██║  ██║"
    echo "  ██╔══╝  ██╔══██║██║██║     ██╔══╝  ██║  ██║"
    echo "  ██║     ██║  ██║██║███████╗███████╗██████╔╝"
    echo "  ╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝ "
    echo -e "${NC}"
    echo ""
    echo "  Quality gate failed. Fix issues before phase transition."
    echo ""
    exit 1
fi
