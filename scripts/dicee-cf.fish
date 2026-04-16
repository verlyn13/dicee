#!/usr/bin/env fish

# Fish-friendly shim for command-scoped Cloudflare auth.
# This does not export secrets into the parent shell.

if test (count $argv) -lt 2
    echo "Usage: scripts/dicee-cf.fish -- <command> [args...]"
    exit 1
end

set script_dir (cd (dirname (status filename)); and pwd)
exec bash "$script_dir/with-dicee-cloudflare.sh" $argv
