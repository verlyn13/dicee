#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/dicee-operator-metadata.sh"

usage() {
	cat <<'EOF' >&2
Usage:
  bash ./scripts/mcp-wrappers/cloudflare-wrapper.sh <docs|bindings|observability|builds|logpush|graphql>
EOF
	exit 1
}

[[ $# -eq 1 ]] || usage

endpoint="$1"
url=""

case "$endpoint" in
docs)
	url="https://docs.mcp.cloudflare.com/mcp"
	;;
bindings)
	url="https://bindings.mcp.cloudflare.com/mcp"
	;;
observability)
	url="https://observability.mcp.cloudflare.com/mcp"
	;;
builds)
	url="https://builds.mcp.cloudflare.com/mcp"
	;;
logpush)
	url="https://logs.mcp.cloudflare.com/mcp"
	;;
graphql)
	url="https://graphql.mcp.cloudflare.com/mcp"
	;;
*)
	usage
	;;
esac

dicee_require_command npx
dicee_require_op

token="$(dicee_op_read "$DICEE_OP_ITEM_CLOUDFLARE" api-token)"

exec npx -y mcp-remote "$url" --header "Authorization: Bearer ${token}"
