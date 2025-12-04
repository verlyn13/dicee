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

# 1. TypeScript Check
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 1/5 TypeScript Check                                        │"
echo "└──────────────────────────────────────────────────────────────┘"
if pnpm typecheck 2>/dev/null; then
    echo -e "${GREEN}✓ TypeScript check passed${NC}"
else
    echo -e "${RED}✗ TypeScript check failed${NC}"
    FAILED=1
fi
echo ""

# 2. Lint Check
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 2/5 Biome Lint                                              │"
echo "└──────────────────────────────────────────────────────────────┘"
if $FIX_MODE; then
    if pnpm lint:fix 2>/dev/null; then
        echo -e "${GREEN}✓ Lint issues auto-fixed${NC}"
    else
        echo -e "${YELLOW}⚠ Some lint issues could not be auto-fixed${NC}"
    fi
else
    if pnpm lint 2>/dev/null; then
        echo -e "${GREEN}✓ Lint check passed${NC}"
    else
        echo -e "${RED}✗ Lint check failed (run with --fix to auto-fix)${NC}"
        FAILED=1
    fi
fi
echo ""

# 3. Tests
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 3/5 Test Suite                                              │"
echo "└──────────────────────────────────────────────────────────────┘"
if pnpm test 2>/dev/null; then
    echo -e "${GREEN}✓ All tests passed${NC}"
else
    echo -e "${RED}✗ Tests failed${NC}"
    FAILED=1
fi
echo ""

# 4. Secrets Scan
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 4/5 Secrets Scan                                            │"
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

# 5. Build Check
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│ 5/5 Build Check                                             │"
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
