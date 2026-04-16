#!/usr/bin/env fish

# Fish-friendly shim for command-scoped Infisical auth.
# This does not export secrets into the parent shell.

if test (count $argv) -lt 3
    echo "Usage: scripts/dicee-env.fish <dev|staging|prod> -- <command> [args...]"
    exit 1
end

set script_dir (cd (dirname (status filename)); and pwd)
exec bash "$script_dir/with-dicee-infisical-auth.sh" $argv
