# Fish shell function for loading Cloudflare credentials from gopass
#
# Installation:
#   cp scripts/dicee-cf.fish ~/.config/fish/functions/dicee-cf.fish
#
# Usage:
#   dicee-cf           # Load Cloudflare credentials
#   dicee-cf --clear   # Clear Cloudflare credentials from environment

function dicee-cf --description "Load Cloudflare credentials for dicee project from gopass"
    set -l arg $argv[1]

    # Handle --clear flag
    if test "$arg" = "--clear"
        set -e CLOUDFLARE_API_TOKEN
        set -e CLOUDFLARE_ACCOUNT_ID
        echo "Cleared Cloudflare environment variables"
        return 0
    end

    # Check if gopass is available
    if not command -q gopass
        echo "Error: gopass is not installed"
        return 1
    end

    # Check if credentials exist
    if not gopass show dicee/cloudflare/api-token &>/dev/null
        echo "Error: Cloudflare API token not found"
        echo "Run: gopass insert dicee/cloudflare/api-token"
        return 1
    end

    # Load credentials
    set -gx CLOUDFLARE_API_TOKEN (gopass show -o dicee/cloudflare/api-token)
    set -gx CLOUDFLARE_ACCOUNT_ID (gopass show -o dicee/cloudflare/account-id)

    echo "Loaded Cloudflare credentials"
    echo "  CLOUDFLARE_ACCOUNT_ID: $CLOUDFLARE_ACCOUNT_ID"

    # Verify authentication
    wrangler whoami
end

# Completion for dicee-cf
complete -c dicee-cf -f -a "--clear" -d "Clear credentials"
