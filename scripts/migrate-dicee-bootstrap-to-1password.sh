#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/dicee-operator-metadata.sh"

readonly REQUIRED_SPECS=(
	"dicee-infisical-dev-auth|login|client-id|text|dicee/infisical/dev/client-id|required"
	"dicee-infisical-dev-auth|login|client-secret|password|dicee/infisical/dev/client-secret|required"
	"dicee-infisical-staging-auth|login|client-id|text|dicee/infisical/staging/client-id|required"
	"dicee-infisical-staging-auth|login|client-secret|password|dicee/infisical/staging/client-secret|required"
	"dicee-infisical-prod-auth|login|client-id|text|dicee/infisical/prod/client-id|required"
	"dicee-infisical-prod-auth|login|client-secret|password|dicee/infisical/prod/client-secret|required"
	"dicee-cloudflare-api|password|api-token|password|dicee/cloudflare/api-token|required"
	"dicee-supabase-mcp|password|token|password|dicee/supabase/mcp-token|required"
)

readonly OPTIONAL_SPECS=(
	"dicee-vercel-api|password|token|password|dicee/vercel/token|optional"
	"dicee-partykit-api|password|token|password|dicee/partykit/token|optional"
	"dicee-elevenlabs-local|password|api-key|password|dicee/elevenlabs/api-key|optional"
)

ASSUME_YES=false

usage() {
	cat <<'EOF'
Usage:
  ./scripts/migrate-dicee-bootstrap-to-1password.sh <command> [--yes]

Commands:
  preview            Show the gopass -> 1Password mapping and current readiness.
  migrate-required   Move required local/bootstrap secrets into 1Password.
  migrate-optional   Move optional local/bootstrap secrets if present in gopass.
  verify             Verify 1Password fields and smoke-test repo wrappers.
  cleanup            Delete migrated gopass entries, but only after value checks pass.

Notes:
  - Runtime/app secrets remain outside this flow.
  - This script never writes secrets into shell startup files or user-global config.
  - cleanup re-verifies each gopass value against the destination 1Password field before deletion.
EOF
	exit 1
}

log() {
	printf '%s\n' "$@"
}

fail() {
	printf 'ERROR: %s\n' "$*" >&2
	exit 1
}

confirm() {
	local prompt="$1"

	if [[ "$ASSUME_YES" == true ]]; then
		return 0
	fi

	printf '%s [y/N] ' "$prompt" >&2
	local reply=""
	read -r reply
	[[ "$reply" == "y" || "$reply" == "Y" ]]
}

require_gopass() {
	dicee_require_command gopass
}

have_command() {
	local command_name="$1"
	command -v "$command_name" >/dev/null 2>&1
}

gopass_has_path() {
	local path="$1"
	gopass show "$path" >/dev/null 2>&1
}

gopass_value() {
	local path="$1"
	gopass show -o "$path"
}

op_item_exists() {
	local item="$1"
	op item get "$item" --vault "$DICEE_OP_VAULT" >/dev/null 2>&1
}

upsert_field() {
	local item="$1"
	local category="$2"
	local field="$3"
	local field_type="$4"
	local value="$5"
	local assignment="${field}[${field_type}]=$value"

	if op_item_exists "$item"; then
		op item edit "$item" --vault "$DICEE_OP_VAULT" "$assignment" >/dev/null
	else
		op item create --vault "$DICEE_OP_VAULT" --category "$category" --title "$item" "$assignment" >/dev/null
	fi
}

verify_field_match() {
	local item="$1"
	local field="$2"
	local path="$3"
	local source_value=""
	local target_value=""

	source_value="$(gopass_value "$path")"
	target_value="$(dicee_op_read "$item" "$field")"

	[[ "$source_value" == "$target_value" ]]
}

print_spec_line() {
	local item="$1"
	local field="$2"
	local path="$3"
	local kind="$4"
	local status="$5"

	printf '  %-9s %-38s %-40s -> %s\n' "$kind" "$path" "$item/$field" "$status"
}

iterate_specs() {
	local group="$1"
	local callback="$2"
	local spec=""
	local item=""
	local category=""
	local field=""
	local field_type=""
	local path=""
	local kind=""

	case "$group" in
	required)
		for spec in "${REQUIRED_SPECS[@]}"; do
			IFS='|' read -r item category field field_type path kind <<<"$spec"
			"$callback" "$item" "$category" "$field" "$field_type" "$path" "$kind"
		done
		;;
	optional)
		for spec in "${OPTIONAL_SPECS[@]}"; do
			IFS='|' read -r item category field field_type path kind <<<"$spec"
			"$callback" "$item" "$category" "$field" "$field_type" "$path" "$kind"
		done
		;;
	all)
		iterate_specs required "$callback"
		iterate_specs optional "$callback"
		;;
	*)
		fail "Unknown spec group: $group"
		;;
	esac
}

preview_spec() {
	local item="$1"
	local _category="$2"
	local field="$3"
	local _field_type="$4"
	local path="$5"
	local kind="$6"
	local status="missing in gopass"

	if ! have_command gopass; then
		status="gopass not available on PATH"
	elif gopass_has_path "$path"; then
		if have_command op && op_item_exists "$item" && op read --account "$DICEE_OP_ACCOUNT" "$(dicee_op_uri "$item" "$field")" >/dev/null 2>&1; then
			status="present in gopass, field exists in 1Password"
		else
			status="present in gopass, 1Password not checked yet"
		fi
	fi

	print_spec_line "$item" "$field" "$path" "$kind" "$status"
}

migrate_spec() {
	local item="$1"
	local category="$2"
	local field="$3"
	local field_type="$4"
	local path="$5"
	local kind="$6"

	if [[ "$kind" == "optional" ]] && ! gopass_has_path "$path"; then
		log "skip optional $path (not present in gopass)"
		return 0
	fi

	local value=""
	value="$(gopass_value "$path")"
	upsert_field "$item" "$category" "$field" "$field_type" "$value"

	if verify_field_match "$item" "$field" "$path"; then
		log "ok    migrated $path -> $(dicee_op_uri "$item" "$field")"
	else
		fail "Verification mismatch after migrate: $path -> $(dicee_op_uri "$item" "$field")"
	fi
}

verify_spec() {
	local item="$1"
	local _category="$2"
	local field="$3"
	local _field_type="$4"
	local path="$5"
	local kind="$6"
	local op_uri=""
	op_uri="$(dicee_op_uri "$item" "$field")"

	if op read --account "$DICEE_OP_ACCOUNT" "$op_uri" >/dev/null 2>&1; then
		if gopass_has_path "$path"; then
			if verify_field_match "$item" "$field" "$path"; then
				log "ok    $op_uri matches $path"
			else
				fail "Mismatch: $op_uri does not match $path"
			fi
		else
			log "ok    $op_uri exists (gopass source already absent)"
		fi
		return 0
	fi

	if [[ "$kind" == "optional" ]]; then
		log "warn  missing optional $op_uri"
		return 0
	fi

	fail "Missing required $op_uri"
}

cleanup_spec() {
	local item="$1"
	local _category="$2"
	local field="$3"
	local _field_type="$4"
	local path="$5"
	local kind="$6"

	if ! gopass_has_path "$path"; then
		log "skip $path (already absent from gopass)"
		return 0
	fi

	local op_uri=""
	op_uri="$(dicee_op_uri "$item" "$field")"
	if ! op read --account "$DICEE_OP_ACCOUNT" "$op_uri" >/dev/null 2>&1; then
		if [[ "$kind" == "optional" ]]; then
			log "skip optional cleanup for $path (destination missing)"
			return 0
		fi
		fail "Refusing cleanup: destination missing for $path -> $op_uri"
	fi

	if ! verify_field_match "$item" "$field" "$path"; then
		fail "Refusing cleanup: value mismatch for $path -> $op_uri"
	fi

	gopass rm -f "$path" >/dev/null
	log "ok    removed $path from gopass"
}

wrapper_smoke_test() {
	log
	log "Running wrapper smoke tests..."

	"$SCRIPT_DIR/with-dicee-infisical-auth.sh" dev -- bash -lc '[[ "${DICEE_ENV:-}" == "dev" && -n "${INFISICAL_CLIENT_ID:-}" && -n "${INFISICAL_CLIENT_SECRET:-}" ]]'
	log "ok    infisical wrapper (dev)"

	"$SCRIPT_DIR/with-dicee-infisical-auth.sh" staging -- bash -lc '[[ "${DICEE_ENV:-}" == "staging" && -n "${INFISICAL_CLIENT_ID:-}" && -n "${INFISICAL_CLIENT_SECRET:-}" ]]'
	log "ok    infisical wrapper (staging)"

	"$SCRIPT_DIR/with-dicee-infisical-auth.sh" prod -- bash -lc '[[ "${DICEE_ENV:-}" == "prod" && -n "${INFISICAL_CLIENT_ID:-}" && -n "${INFISICAL_CLIENT_SECRET:-}" ]]'
	log "ok    infisical wrapper (prod)"

	"$SCRIPT_DIR/with-dicee-cloudflare.sh" -- bash -lc '[[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" && -n "${CLOUDFLARE_API_TOKEN:-}" && "${CF_BEARER_TOKEN:-}" == "Bearer ${CLOUDFLARE_API_TOKEN}" ]]'
	log "ok    cloudflare wrapper"

	"$SCRIPT_DIR/with-dicee-supabase-mcp.sh" -- bash -lc '[[ -n "${SUPABASE_PROJECT_REF:-}" && -n "${SUPABASE_MCP_TOKEN:-}" ]]'
	log "ok    supabase MCP wrapper"

	if op read --account "$DICEE_OP_ACCOUNT" "$(dicee_op_uri "$DICEE_OP_ITEM_ELEVENLABS_LOCAL" api-key)" >/dev/null 2>&1; then
		"$SCRIPT_DIR/with-dicee-elevenlabs-local.sh" -- bash -lc '[[ -n "${ELEVENLABS_API_KEY:-}" ]]'
		log "ok    elevenlabs local wrapper"
	fi
}

run_preview() {
	log "Dicee gopass -> 1Password migration preview"
	log "1Password account: $DICEE_OP_ACCOUNT"
	log "1Password vault:   $DICEE_OP_VAULT"
	log
	log "Required secrets:"
	iterate_specs required preview_spec
	log
	log "Optional secrets:"
	iterate_specs optional preview_spec
	log
	log "Runtime/app secrets are not part of this flow."
}

run_migrate() {
	local group="$1"

	require_gopass
	dicee_require_op

	log "About to migrate $group Dicee local/bootstrap secrets into 1Password."
	log "Destination account: $DICEE_OP_ACCOUNT"
	log "Destination vault:   $DICEE_OP_VAULT"
	log
	iterate_specs "$group" preview_spec
	log

	confirm "Proceed with $group migration?" || fail "Cancelled"
	iterate_specs "$group" migrate_spec
}

run_verify() {
	require_gopass
	dicee_require_op

	log "Verifying 1Password contract values against gopass where available..."
	iterate_specs all verify_spec

	log
	"$SCRIPT_DIR/check-1password-setup.sh"
	wrapper_smoke_test
}

run_cleanup() {
	require_gopass
	dicee_require_op

	log "Cleanup will remove migrated entries from gopass only after matching them to 1Password."
	log "This should be run only after a successful verify step."
	log
	iterate_specs all preview_spec
	log

	confirm "Proceed with cleanup from gopass?" || fail "Cancelled"
	iterate_specs all cleanup_spec
}

main() {
	local command="${1:-}"
	[[ -n "$command" ]] || usage
	shift || true

	while [[ $# -gt 0 ]]; do
		case "$1" in
		--yes)
			ASSUME_YES=true
			;;
		-h|--help)
			usage
			;;
		*)
			fail "Unknown argument: $1"
			;;
		esac
		shift
	done

	case "$command" in
	preview)
		run_preview
		;;
	migrate-required)
		run_migrate required
		;;
	migrate-optional)
		run_migrate optional
		;;
	verify)
		run_verify
		;;
	cleanup)
		run_cleanup
		;;
	*)
		usage
		;;
	esac
}

main "$@"
