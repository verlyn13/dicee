#!/usr/bin/env bash
#
# Setup Windsurf Configuration
#
# This script moves the temporary Windsurf configuration files to their
# correct locations in .windsurf/
#
# Run this script from the project root:
#   ./scripts/setup-windsurf-config.sh
#
# Or with bash explicitly:
#   bash scripts/setup-windsurf-config.sh
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

TEMP_CONFIG="$PROJECT_ROOT/temp-windsurf-config"
WINDSURF_DIR="$PROJECT_ROOT/.windsurf"

echo -e "${BLUE}=== Windsurf Configuration Setup ===${NC}"
echo ""

# Check if temp config exists
if [[ ! -d "$TEMP_CONFIG" ]]; then
    echo -e "${RED}Error: temp-windsurf-config directory not found${NC}"
    echo "Expected at: $TEMP_CONFIG"
    exit 1
fi

# Create backup of existing config
if [[ -d "$WINDSURF_DIR" ]]; then
    BACKUP_DIR="$PROJECT_ROOT/.windsurf-backup-$(date +%Y%m%d-%H%M%S)"
    echo -e "${YELLOW}Backing up existing .windsurf to $BACKUP_DIR${NC}"
    cp -r "$WINDSURF_DIR" "$BACKUP_DIR"
fi

# Ensure .windsurf directories exist
echo -e "${BLUE}Creating directory structure...${NC}"
mkdir -p "$WINDSURF_DIR/rules"
mkdir -p "$WINDSURF_DIR/workflows"

# Copy rules
echo -e "${BLUE}Copying rules...${NC}"
for file in "$TEMP_CONFIG/rules"/*.md; do
    if [[ -f "$file" ]]; then
        filename=$(basename "$file")
        echo "  → rules/$filename"
        cp "$file" "$WINDSURF_DIR/rules/$filename"
    fi
done

# Copy workflows
echo -e "${BLUE}Copying workflows...${NC}"
for file in "$TEMP_CONFIG/workflows"/*.md; do
    if [[ -f "$file" ]]; then
        filename=$(basename "$file")
        echo "  → workflows/$filename"
        cp "$file" "$WINDSURF_DIR/workflows/$filename"
    fi
done

# Copy root files
echo -e "${BLUE}Copying root configuration files...${NC}"
if [[ -f "$TEMP_CONFIG/README.md" ]]; then
    echo "  → README.md"
    cp "$TEMP_CONFIG/README.md" "$WINDSURF_DIR/README.md"
fi

if [[ -f "$TEMP_CONFIG/cascade.json" ]]; then
    echo "  → cascade.json"
    cp "$TEMP_CONFIG/cascade.json" "$WINDSURF_DIR/cascade.json"
fi

# Preserve existing documentation files (don't overwrite)
echo -e "${BLUE}Preserving existing documentation...${NC}"
PRESERVED_FILES=(
    "AGENTIC-SYSTEM-TEST-REPORT.md"
    "COMMAND-EXECUTION-ISSUE.md"
    "MCP-FINAL-FIX.md"
    "MCP-SETUP-GUIDE.md"
    "MCP-STATUS.md"
    "OAUTH-BROKEN-USE-PAT.md"
    "SUPABASE-MCP-FIX.md"
)

for doc in "${PRESERVED_FILES[@]}"; do
    if [[ -f "$WINDSURF_DIR/$doc" ]]; then
        echo "  ✓ Preserved: $doc"
    fi
done

# Clean up temp directory
echo ""
echo -e "${YELLOW}Cleaning up temporary files...${NC}"
rm -rf "$TEMP_CONFIG"
echo "  → Removed temp-windsurf-config/"

# Summary
echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Windsurf configuration installed to .windsurf/"
echo ""
echo "Files installed:"
echo "  .windsurf/"
echo "  ├── README.md"
echo "  ├── cascade.json"
echo "  ├── rules/"
echo "  │   ├── core-guardrails.md"
echo "  │   ├── svelte-components.md"
echo "  │   └── akg-architecture.md"
echo "  └── workflows/"
echo "      ├── build-component.md"
echo "      ├── verify-task.md"
echo "      └── akg-query.md"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Restart Windsurf to pick up new configuration"
echo "2. Verify MCP servers are connected: Check Cascade panel"
echo "3. Test with: /build-component or /akg layer components"
echo ""

if [[ -d "$BACKUP_DIR" ]]; then
    echo -e "${YELLOW}Note: Previous config backed up to:${NC}"
    echo "  $BACKUP_DIR"
    echo ""
fi
