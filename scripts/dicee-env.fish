# Fish shell function for loading dicee credentials from gopass
#
# Installation:
#   cp scripts/dicee-env.fish ~/.config/fish/functions/dicee-env.fish
#
# Usage:
#   dicee-env           # Load dev credentials (default)
#   dicee-env staging   # Load staging credentials
#   dicee-env prod      # Load production credentials
#   dicee-env --clear   # Clear all credentials from environment

function dicee-env --description "Load Infisical credentials for dicee project from gopass"
    set -l env $argv[1]

    # Handle --clear flag
    if test "$env" = "--clear"
        set -e INFISICAL_API_URL
        set -e INFISICAL_CLIENT_ID
        set -e INFISICAL_CLIENT_SECRET
        set -e INFISICAL_PROJECT_ID
        set -e DICEE_ENV
        echo "Cleared Infisical environment variables"
        return 0
    end

    # Default to dev environment
    if test -z "$env"
        set env "dev"
    end

    # Validate environment
    if not contains $env dev staging prod
        echo "Error: Invalid environment '$env'. Use: dev, staging, or prod"
        return 1
    end

    # Check if gopass is available
    if not command -q gopass
        echo "Error: gopass is not installed"
        return 1
    end

    # Check if credentials exist
    if not gopass show dicee/infisical/$env/client-id &>/dev/null
        echo "Error: Credentials not found for '$env' environment"
        echo "Run: ./scripts/setup-gopass-credentials.sh"
        return 1
    end

    # Load credentials
    set -gx INFISICAL_API_URL (gopass show -o dicee/infisical/instance-url)
    set -gx INFISICAL_CLIENT_ID (gopass show -o dicee/infisical/$env/client-id)
    set -gx INFISICAL_CLIENT_SECRET (gopass show -o dicee/infisical/$env/client-secret)
    set -gx INFISICAL_PROJECT_ID (gopass show -o dicee/infisical/project-id)
    set -gx DICEE_ENV $env

    echo "Loaded Infisical credentials for: $env"
    echo "  INFISICAL_API_URL: $INFISICAL_API_URL"
    echo "  INFISICAL_CLIENT_ID: $INFISICAL_CLIENT_ID"
    echo "  INFISICAL_PROJECT_ID: $INFISICAL_PROJECT_ID"
    echo "  DICEE_ENV: $DICEE_ENV"
end

# Completion for dicee-env
complete -c dicee-env -f -a "dev staging prod --clear" -d "Environment"
