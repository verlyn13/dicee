#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/dicee-operator-metadata.sh"

usage() {
	cat <<'EOF' >&2
Usage:
  ./scripts/with-dicee-supabase-mcp.sh -- <command> [args...]
EOF
	exit 1
}

[[ $# -ge 2 ]] || usage
[[ "${1:-}" == "--" ]] || usage
shift

dicee_require_op

exec env \
	SUPABASE_PROJECT_REF="$DICEE_SUPABASE_PROJECT_REF" \
	SUPABASE_MCP_TOKEN="$(dicee_op_read "$DICEE_OP_ITEM_SUPABASE_MCP" token)" \
	"$@"
