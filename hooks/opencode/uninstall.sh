#!/usr/bin/env bash
#
# caveman-docs uninstaller for OpenCode CLI. Idempotent.
# Removes the plugin file, skill dir, agent file, slash commands,
# AGENTS.md block, and flag file.

set -euo pipefail

CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
AGENTS_MD="$CONFIG_DIR/AGENTS.md"
BEGIN_MARK="<!-- BEGIN CAVEMAN-DOCS -->"
END_MARK="<!-- END CAVEMAN-DOCS -->"

for d in "$CONFIG_DIR/plugin" "$CONFIG_DIR/plugins"; do
  [ -f "$d/caveman-docs.ts" ] && rm -f "$d/caveman-docs.ts"
done

rm -rf "$CONFIG_DIR/skill/caveman-docs"
rm -f "$CONFIG_DIR/agent/doc-compressor.md"
rm -f "$CONFIG_DIR/.caveman-docs-active"

# Remove file-based slash commands installed by install.sh.
for cmd in caveman-docs caveman-docs-help caveman-docs-init caveman-docs-ai-context caveman-docs-compress; do
  rm -f "$CONFIG_DIR/commands/$cmd.md"
done

if [ -f "$AGENTS_MD" ] && grep -qF "$BEGIN_MARK" "$AGENTS_MD"; then
  TMP="$(mktemp)"
  awk \
    -v begin="$BEGIN_MARK" \
    -v end="$END_MARK" '
      BEGIN { skip = 0 }
      {
        if ($0 == begin) { skip = 1; next }
        if ($0 == end && skip == 1) { skip = 0; next }
        if (skip == 0) { print }
      }
    ' "$AGENTS_MD" > "$TMP"
  mv "$TMP" "$AGENTS_MD"
fi

echo "caveman-docs uninstalled from OpenCode ($CONFIG_DIR)."
