#!/usr/bin/env bash
# Setup gopass credentials for dicee project
# Run this script once to populate non-sensitive values
# Sensitive credentials must be entered manually afterward
#
# Usage: ./scripts/setup-gopass-credentials.sh
#
# Credential Storage Strategy:
#   gopass  = Infrastructure credentials (local dev, machine identities)
#   Infisical = Application secrets (runtime, injected via SDK/CLI)

set -euo pipefail

echo "=== Dicee Project: Gopass Credential Setup ==="
echo ""

# Check if gopass is available
if ! command -v gopass &> /dev/null; then
    echo "ERROR: gopass is not installed"
    exit 1
fi

# =============================================================================
# INFISICAL CONFIGURATION
# =============================================================================

echo "Setting up Infisical configuration..."
echo "https://infisical.jefahnierocks.com" | gopass insert -f dicee/infisical/instance-url
echo "b15c7b9c-4e1f-447a-a326-4c382b6db706" | gopass insert -f dicee/infisical/project-id
echo "dicee-dsmc" | gopass insert -f dicee/infisical/project-slug
echo "Admin Org" | gopass insert -f dicee/infisical/org-name

# Development environment
echo "  - dev environment..."
echo "dicee-dev" | gopass insert -f dicee/infisical/dev/identity-name
echo "6498077a-7556-40c2-8cb5-670ad807cdf1" | gopass insert -f dicee/infisical/dev/identity-id
echo "bc5b0a8d-00c0-4f88-bb73-f56f4905ecf8" | gopass insert -f dicee/infisical/dev/client-id

# Staging environment
echo "  - staging environment..."
echo "dicee-staging" | gopass insert -f dicee/infisical/staging/identity-name
echo "4c650723-024e-475d-b1e5-4f98652e16f3" | gopass insert -f dicee/infisical/staging/identity-id
echo "2448afb7-27de-49b1-a9c9-aaf99d40fec6" | gopass insert -f dicee/infisical/staging/client-id

# Production environment
echo "  - prod environment..."
echo "dicee-prod" | gopass insert -f dicee/infisical/prod/identity-name
echo "7a36ab38-c72d-4668-8e82-22ea2b858c69" | gopass insert -f dicee/infisical/prod/identity-id
echo "c3a61530-ad44-48c1-beb8-fdad4d4042c0" | gopass insert -f dicee/infisical/prod/client-id

# =============================================================================
# CLOUDFLARE CONFIGURATION
# =============================================================================

echo "Setting up Cloudflare configuration..."
echo "13eb584192d9cefb730fde0cfd271328" | gopass insert -f dicee/cloudflare/account-id
echo "8d5f44e67ab4b37e47b034ff48b03099" | gopass insert -f dicee/cloudflare/zone-id
echo "jefahnierocks.com" | gopass insert -f dicee/cloudflare/domain
echo "dicee.jefahnierocks.com" | gopass insert -f dicee/cloudflare/subdomain

# =============================================================================
# SUPABASE CONFIGURATION (structure only - values entered manually)
# =============================================================================

echo "Setting up Supabase structure..."
echo "dicee" | gopass insert -f dicee/supabase/project-name

# =============================================================================
# VERCEL CONFIGURATION (structure only - values entered manually)
# =============================================================================

echo "Setting up Vercel structure..."
echo "dicee-web" | gopass insert -f dicee/vercel/project-name

# =============================================================================
# PARTYKIT CONFIGURATION (structure only - values entered manually)
# =============================================================================

echo "Setting up PartyKit structure..."
echo "dicee-rooms" | gopass insert -f dicee/partykit/project-name

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo "=== Non-sensitive values populated ==="
echo ""
echo "IMPORTANT: You must manually enter the sensitive credentials:"
echo ""
echo "  # Infisical client secrets (machine identity)"
echo "  gopass insert dicee/infisical/dev/client-secret"
echo "  gopass insert dicee/infisical/staging/client-secret"
echo "  gopass insert dicee/infisical/prod/client-secret"
echo ""
echo "  # Cloudflare API token"
echo "  gopass insert dicee/cloudflare/api-token"
echo ""
echo "  # Google Cloud OAuth (for Supabase Google Sign-In)"
echo "  gopass insert dicee/google/oauth-client-id      # OAuth 2.0 Client ID"
echo "  gopass insert dicee/google/oauth-client-secret  # OAuth 2.0 Client Secret"
echo ""
echo "  # Supabase credentials (from dashboard after project creation)"
echo "  gopass insert dicee/supabase/project-ref      # e.g., abcdefghijk"
echo "  gopass insert dicee/supabase/db-password      # Database password"
echo "  gopass insert dicee/supabase/publishable-key  # Publishable key (client-safe with RLS)"
echo "  gopass insert dicee/supabase/secret-key       # Secret key (backend only!)"
echo ""
echo "  # Vercel credentials (after linking project)"
echo "  gopass insert dicee/vercel/project-id"
echo "  gopass insert dicee/vercel/token              # Vercel API token"
echo ""
echo "  # PartyKit credentials (after deploying)"
echo "  gopass insert dicee/partykit/token"
echo ""
echo "After entering Supabase credentials, sync to Infisical:"
echo ""
echo "  dicee-env dev"
echo "  infisical secrets set PUBLIC_SUPABASE_URL=\"https://\$(gopass show -o dicee/supabase/project-ref).supabase.co\" --env=dev"
echo "  infisical secrets set PUBLIC_SUPABASE_ANON_KEY=\"\$(gopass show -o dicee/supabase/publishable-key)\" --env=dev"
echo "  infisical secrets set SUPABASE_SERVICE_ROLE_KEY=\"\$(gopass show -o dicee/supabase/secret-key)\" --env=dev"
echo ""
echo "Verify structure with: gopass ls dicee"
