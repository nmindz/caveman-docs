#!/usr/bin/env bash
#
# caveman-docs installer for OpenCode CLI.
#
# Idempotent. Reads the live source-of-truth files from this repo:
#   plugins/caveman-docs/opencode/caveman-docs.ts -> $CONFIG/plugin/caveman-docs.ts
#   skills/caveman-docs/SKILL.md                  -> $CONFIG/skill/caveman-docs/SKILL.md
#   agents/doc-compressor.md                      -> $CONFIG/agent/doc-compressor.md
#   rules/caveman-docs-activate.md                -> $CONFIG/AGENTS.md (between markers)
#   plugins/caveman-docs/opencode/commands/*.md   -> $CONFIG/commands/*.md
#
# $CONFIG defaults to $OPENCODE_CONFIG_DIR or ~/.config/opencode.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"

if [ -d "$CONFIG_DIR/plugins" ] && [ ! -d "$CONFIG_DIR/plugin" ]; then
  PLUGIN_DIR="$CONFIG_DIR/plugins"
else
  PLUGIN_DIR="$CONFIG_DIR/plugin"
fi

SKILL_DIR="$CONFIG_DIR/skill/caveman-docs"
AGENT_DIR="$CONFIG_DIR/agent"
COMMANDS_DIR="$CONFIG_DIR/commands"
AGENTS_MD="$CONFIG_DIR/AGENTS.md"

PLUGIN_SRC="$REPO_ROOT/plugins/caveman-docs/opencode/caveman-docs.ts"
SKILL_SRC="$REPO_ROOT/skills/caveman-docs/SKILL.md"
AGENT_SRC="$REPO_ROOT/agents/doc-compressor.md"
RULES_SRC="$REPO_ROOT/rules/caveman-docs-activate.md"
COMMANDS_SRC_DIR="$REPO_ROOT/plugins/caveman-docs/opencode/commands"

BEGIN_MARK="<!-- BEGIN CAVEMAN-DOCS -->"
END_MARK="<!-- END CAVEMAN-DOCS -->"

for src in "$PLUGIN_SRC" "$SKILL_SRC" "$AGENT_SRC" "$RULES_SRC"; do
  if [ ! -f "$src" ]; then
    echo "error: source missing: $src" >&2
    exit 1
  fi
done

if [ ! -d "$COMMANDS_SRC_DIR" ]; then
  echo "error: commands source dir missing: $COMMANDS_SRC_DIR" >&2
  exit 1
fi

mkdir -p "$CONFIG_DIR" "$PLUGIN_DIR" "$SKILL_DIR" "$AGENT_DIR" "$COMMANDS_DIR"

cp "$PLUGIN_SRC" "$PLUGIN_DIR/caveman-docs.ts"
cp "$SKILL_SRC"  "$SKILL_DIR/SKILL.md"
cp "$AGENT_SRC"  "$AGENT_DIR/doc-compressor.md"

# Install slash commands. Each .md becomes /<basename> in OpenCode autocomplete.
for cmd in "$COMMANDS_SRC_DIR"/*.md; do
  [ -f "$cmd" ] || continue
  cp "$cmd" "$COMMANDS_DIR/$(basename "$cmd")"
done

RULES_CONTENT="$(cat "$RULES_SRC")"
BLOCK="${BEGIN_MARK}
${RULES_CONTENT}
${END_MARK}"

touch "$AGENTS_MD"

if grep -qF "$BEGIN_MARK" "$AGENTS_MD"; then
  TMP="$(mktemp)"
  awk \
    -v begin="$BEGIN_MARK" \
    -v end="$END_MARK" \
    -v block="$BLOCK" '
      BEGIN { skip = 0 }
      {
        if ($0 == begin) { print block; skip = 1; next }
        if ($0 == end && skip == 1) { skip = 0; next }
        if (skip == 0) { print }
      }
    ' "$AGENTS_MD" > "$TMP"
  mv "$TMP" "$AGENTS_MD"
else
  if [ -s "$AGENTS_MD" ]; then
    printf '\n%s\n' "$BLOCK" >> "$AGENTS_MD"
  else
    printf '%s\n' "$BLOCK" > "$AGENTS_MD"
  fi
fi

cat <<EOF
caveman-docs installed for OpenCode.
  plugin   -> $PLUGIN_DIR/caveman-docs.ts
  skill    -> $SKILL_DIR/SKILL.md
  agent    -> $AGENT_DIR/doc-compressor.md
  commands -> $COMMANDS_DIR/caveman-docs*.md
  rules    -> $AGENTS_MD (between $BEGIN_MARK / $END_MARK)

Plugin auto-loads from \`$PLUGIN_DIR/\`. No config edit needed.

If you prefer explicit registration, add this line to your opencode.jsonc:

  "plugin": ["file://$PLUGIN_DIR/caveman-docs.ts"]

Restart OpenCode. Then test:
  - Type /caveman-docs in autocomplete (file-based slash command)
  - Or send "activate caveman-docs"
  - Or set CAVEMAN_DOCS_DEFAULT_MODE=ultra to auto-activate at session start
EOF
