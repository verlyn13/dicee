#!/usr/bin/env bash
# Generate ~/.codex/config.toml for Dicee using the ChatGPT 5.1-optimized template
# Usage: ./scripts/setup-codex-cli.sh [--dry-run]
set -euo pipefail

DRY_RUN=false
if [[ ${1:-} == "--dry-run" ]]; then
  DRY_RUN=true
fi

PROJECT_DIR=$(cd "$(dirname "$0")/.." && pwd -P)
TEMPLATE_PATH="$PROJECT_DIR/.codex/config.template.toml"
TARGET_DIR="$HOME/.codex"
TARGET_FILE="$TARGET_DIR/config.toml"

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  echo "Template not found at $TEMPLATE_PATH" >&2
  exit 1
fi

render_template() {
  python3 - "$PROJECT_DIR" "$TEMPLATE_PATH" <<'PY'
import pathlib, sys
project_dir = pathlib.Path(sys.argv[1]).resolve()
template_path = pathlib.Path(sys.argv[2])
content = template_path.read_text()
print(content.replace("__PROJECT_DIR__", str(project_dir)))
PY
}

if [[ "$DRY_RUN" == true ]]; then
  render_template
  exit 0
fi

mkdir -p "$TARGET_DIR"
if [[ -f "$TARGET_FILE" ]]; then
  cp "$TARGET_FILE" "$TARGET_FILE.bak"
  echo "Existing config backed up to $TARGET_FILE.bak"
fi

render_template > "$TARGET_FILE"
chmod 600 "$TARGET_FILE"
echo "Codex CLI config written to $TARGET_FILE"
