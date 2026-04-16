#!/usr/bin/env bash

# Non-secret operator/bootstrap metadata for Dicee.
# Runtime/app secrets stay in Infisical. Local operator/bootstrap secrets live in
# 1Password and are retrieved command-by-command by the wrappers in ../.

readonly DICEE_OP_ACCOUNT="my.1password.com"
readonly DICEE_OP_VAULT="Dev"

readonly DICEE_OP_ITEM_INFISICAL_DEV="dicee-infisical-dev-auth"
readonly DICEE_OP_ITEM_INFISICAL_STAGING="dicee-infisical-staging-auth"
readonly DICEE_OP_ITEM_INFISICAL_PROD="dicee-infisical-prod-auth"
readonly DICEE_OP_ITEM_CLOUDFLARE="dicee-cloudflare-api"
readonly DICEE_OP_ITEM_SUPABASE_MCP="dicee-supabase-mcp"
readonly DICEE_OP_ITEM_VERCEL="dicee-vercel-api"
readonly DICEE_OP_ITEM_PARTYKIT="dicee-partykit-api"
readonly DICEE_OP_ITEM_ELEVENLABS_LOCAL="dicee-elevenlabs-local"

readonly DICEE_INFISICAL_INSTANCE_URL="https://infisical.jefahnierocks.com"
readonly DICEE_INFISICAL_PROJECT_ID="b15c7b9c-4e1f-447a-a326-4c382b6db706"
readonly DICEE_INFISICAL_PROJECT_SLUG="dicee-dsmc"
readonly DICEE_INFISICAL_ORG_NAME="Admin Org"

readonly DICEE_INFISICAL_DEV_IDENTITY_NAME="dicee-dev"
readonly DICEE_INFISICAL_DEV_IDENTITY_ID="6498077a-7556-40c2-8cb5-670ad807cdf1"
readonly DICEE_INFISICAL_STAGING_IDENTITY_NAME="dicee-staging"
readonly DICEE_INFISICAL_STAGING_IDENTITY_ID="4c650723-024e-475d-b1e5-4f98652e16f3"
readonly DICEE_INFISICAL_PROD_IDENTITY_NAME="dicee-prod"
readonly DICEE_INFISICAL_PROD_IDENTITY_ID="7a36ab38-c72d-4668-8e82-22ea2b858c69"

readonly DICEE_CLOUDFLARE_ACCOUNT_ID="13eb584192d9cefb730fde0cfd271328"
readonly DICEE_CLOUDFLARE_DOMAIN="dicee.games"

readonly DICEE_SUPABASE_PROJECT_NAME="dicee"
readonly DICEE_SUPABASE_PROJECT_REF="duhsbuyxyppgbkwbbtqg"

readonly DICEE_VERCEL_PROJECT_NAME="dicee-web"
readonly DICEE_PARTYKIT_PROJECT_NAME="dicee-rooms"
readonly DICEE_AUDIO_PROJECT_NAME="dicee-audio"

dicee_require_command() {
	local command_name="$1"
	if ! command -v "$command_name" >/dev/null 2>&1; then
		echo "Missing required command: $command_name" >&2
		return 1
	fi
}

dicee_op_uri() {
	local item="$1"
	local field="$2"
	printf "op://%s/%s/%s" "$DICEE_OP_VAULT" "$item" "$field"
}

dicee_require_op() {
	dicee_require_command op
	if ! op vault get "$DICEE_OP_VAULT" --account "$DICEE_OP_ACCOUNT" >/dev/null 2>&1; then
		cat >&2 <<EOF
1Password CLI is not ready for Dicee.
Approved workstation flow:
  1. Sign into the 1Password desktop app for $DICEE_OP_ACCOUNT
  2. Enable Settings > Developer > Integrate with 1Password CLI
  3. Verify readiness with:
     op vault get $DICEE_OP_VAULT --account $DICEE_OP_ACCOUNT >/dev/null
EOF
		return 1
	fi
}

dicee_op_read() {
	local item="$1"
	local field="$2"
	op read --account "$DICEE_OP_ACCOUNT" "$(dicee_op_uri "$item" "$field")"
}
