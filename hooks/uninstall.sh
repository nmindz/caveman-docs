#!/bin/bash
# caveman-docs — hook uninstaller
set -e

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: 'node' is required."
  exit 1
fi

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
HOOKS_DIR="$CLAUDE_DIR/hooks/caveman-docs"
COMMANDS_DIR="$CLAUDE_DIR/commands/caveman-docs"
SKILLS_DIR="$CLAUDE_DIR/skills/caveman-docs"
SETTINGS="$CLAUDE_DIR/settings.json"
FLAG="$CLAUDE_DIR/.caveman-docs-active"

echo "Uninstalling caveman-docs..."

rm -f "$FLAG" 2>/dev/null || true

for dir in "$HOOKS_DIR" "$COMMANDS_DIR" "$SKILLS_DIR"; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    echo "  Removed: $dir"
  fi
done

# Remove agent (only if it was installed by caveman-docs)
if [ -f "$CLAUDE_DIR/agents/doc-compressor.md" ]; then
  rm -f "$CLAUDE_DIR/agents/doc-compressor.md"
  echo "  Removed: $CLAUDE_DIR/agents/doc-compressor.md"
fi

if [ -f "$SETTINGS" ]; then
  cp "$SETTINGS" "$SETTINGS.caveman-docs-uninstall.bak"

  CAVEDOCS_SETTINGS="$SETTINGS" node -e "
    const fs = require('fs');
    const settingsPath = process.env.CAVEDOCS_SETTINGS;
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (!settings.hooks) { process.exit(0); }

    const strip = (arr) => (arr || []).filter(e =>
      !(e.hooks && e.hooks.some(h => h.command && h.command.includes('caveman-docs')))
    );

    settings.hooks.SessionStart = strip(settings.hooks.SessionStart);
    settings.hooks.UserPromptSubmit = strip(settings.hooks.UserPromptSubmit);
    settings.hooks.PreToolUse = strip(settings.hooks.PreToolUse);

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    console.log('  Hooks removed from settings.json.');
  "
fi

echo ""
echo "Done. Restart Claude Code to apply."
