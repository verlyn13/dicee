#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/dicee-operator-metadata.sh"

dicee_require_command npx
dicee_require_op

token="$(dicee_op_read "$DICEE_OP_ITEM_SUPABASE_MCP" token)"
url="https://mcp.supabase.com/mcp?project_ref=${DICEE_SUPABASE_PROJECT_REF}&read_only=false&features=database,docs,functions"

exec npx -y mcp-remote "$url" --header "Authorization: Bearer ${token}"
