#!/bin/bash
# caveman-docs — hook installer for Claude Code
# Installs:
#   - SessionStart: injects caveman-docs rules at session start
#   - UserPromptSubmit: detects AI doc write intent, injects compression reminder
#   - PreToolUse Write|Edit: intercepts writes to AI doc files
# Usage: bash hooks/install.sh [--force]
set -e

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: 'node' is required (used to merge hooks into settings.json)."
  exit 1
fi

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
HOOKS_DIR="$CLAUDE_DIR/hooks/caveman-docs"
COMMANDS_DIR="$CLAUDE_DIR/commands/caveman-docs"
SKILLS_DIR="$CLAUDE_DIR/skills/caveman-docs"
AGENTS_DIR="$CLAUDE_DIR/agents"
SETTINGS="$CLAUDE_DIR/settings.json"

HOOK_FILES=("package.json" "caveman-docs-config.js" "caveman-docs-activate.js" "caveman-docs-tracker.js" "caveman-docs-pre-write.js")

SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
fi

if [ -z "$SCRIPT_DIR" ]; then
  echo "ERROR: Cannot determine hook source directory. Run from the repo checkout."
  exit 1
fi

# Check if already installed
ALREADY_INSTALLED=0
if [ "$FORCE" -eq 0 ]; then
  ALL_FILES_PRESENT=1
  for hook in "${HOOK_FILES[@]}"; do
    if [ ! -f "$HOOKS_DIR/$hook" ]; then
      ALL_FILES_PRESENT=0
      break
    fi
  done

  HOOKS_WIRED=0
  if [ "$ALL_FILES_PRESENT" -eq 1 ] && [ -f "$SETTINGS" ]; then
    if CAVEDOCS_SETTINGS="$SETTINGS" node -e "
      const fs = require('fs');
      const s = JSON.parse(fs.readFileSync(process.env.CAVEDOCS_SETTINGS, 'utf8'));
      const has = (event, needle) =>
        Array.isArray(s.hooks?.[event]) &&
        s.hooks[event].some(e => e.hooks && e.hooks.some(h => h.command && h.command.includes(needle)));
      process.exit(
        has('SessionStart','caveman-docs') &&
        has('UserPromptSubmit','caveman-docs') &&
        has('PreToolUse','caveman-docs')
          ? 0 : 1
      );
    " >/dev/null 2>&1; then
      HOOKS_WIRED=1
    fi
  fi

  if [ "$ALL_FILES_PRESENT" -eq 1 ] && [ "$HOOKS_WIRED" -eq 1 ]; then
    ALREADY_INSTALLED=1
    echo "caveman-docs hooks already installed in $HOOKS_DIR"
    echo "  Re-run with --force to overwrite: bash hooks/install.sh --force"
  fi
fi

if [ "$ALREADY_INSTALLED" -eq 1 ] && [ "$FORCE" -eq 0 ]; then
  exit 0
fi

REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Installing caveman-docs..."

# 1. Hook files
mkdir -p "$HOOKS_DIR"
for hook in "${HOOK_FILES[@]}"; do
  cp "$SCRIPT_DIR/$hook" "$HOOKS_DIR/$hook"
  echo "  Installed: $HOOKS_DIR/$hook"
done

# 2. Commands → ~/.claude/commands/caveman-docs/ (namespaced)
#    Exception: caveman-docs.toml ships at ~/.claude/commands/caveman-docs.toml so
#    the slash command resolves as /caveman-docs <level> (top-level, not namespaced).
mkdir -p "$COMMANDS_DIR"
for cmd in "$REPO_DIR"/commands/*.md "$REPO_DIR"/commands/*.toml; do
  [ -f "$cmd" ] || continue
  base="$(basename "$cmd")"
  if [ "$base" = "caveman-docs.toml" ] || [ "$base" = "caveman-docs.md" ]; then
    cp "$cmd" "$CLAUDE_DIR/commands/$base"
    echo "  Installed: $CLAUDE_DIR/commands/$base (top-level slash)"
  else
    cp "$cmd" "$COMMANDS_DIR/$base"
    echo "  Installed: $COMMANDS_DIR/$base"
  fi
done

# 3. Skill → ~/.claude/skills/caveman-docs/
mkdir -p "$SKILLS_DIR"
cp "$REPO_DIR/skills/caveman-docs/SKILL.md" "$SKILLS_DIR/SKILL.md"
echo "  Installed: $SKILLS_DIR/SKILL.md"

# 4. Agent → ~/.claude/agents/
mkdir -p "$AGENTS_DIR"
cp "$REPO_DIR/agents/doc-compressor.md" "$AGENTS_DIR/doc-compressor.md"
echo "  Installed: $AGENTS_DIR/doc-compressor.md"

if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
fi

cp "$SETTINGS" "$SETTINGS.caveman-docs.bak"

CAVEDOCS_SETTINGS="$SETTINGS" CAVEDOCS_HOOKS_DIR="$HOOKS_DIR" node -e "
  const fs = require('fs');
  const settingsPath = process.env.CAVEDOCS_SETTINGS;
  const hooksDir = process.env.CAVEDOCS_HOOKS_DIR;
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if (!settings.hooks) settings.hooks = {};

  const hasCavedocs = (event) =>
    Array.isArray(settings.hooks[event]) &&
    settings.hooks[event].some(e => e.hooks && e.hooks.some(h => h.command && h.command.includes('caveman-docs')));

  // SessionStart — emit caveman-docs rules
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
  if (!hasCavedocs('SessionStart')) {
    settings.hooks.SessionStart.push({
      matcher: '',
      hooks: [{
        type: 'command',
        command: 'node \"' + hooksDir + '/caveman-docs-activate.js\"',
        timeout: 5,
        statusMessage: 'Loading caveman-docs mode...'
      }]
    });
    console.log('  [+] SessionStart hook wired.');
  } else {
    console.log('  [=] SessionStart hook already present.');
  }

  // UserPromptSubmit — detect AI doc write intent
  if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
  if (!hasCavedocs('UserPromptSubmit')) {
    settings.hooks.UserPromptSubmit.push({
      matcher: '',
      hooks: [{
        type: 'command',
        command: 'node \"' + hooksDir + '/caveman-docs-tracker.js\"',
        timeout: 5,
        statusMessage: 'caveman-docs: checking doc intent...'
      }]
    });
    console.log('  [+] UserPromptSubmit hook wired.');
  } else {
    console.log('  [=] UserPromptSubmit hook already present.');
  }

  // PreToolUse Write|Edit — intercept AI doc writes
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
  if (!hasCavedocs('PreToolUse')) {
    settings.hooks.PreToolUse.push({
      matcher: 'Write|Edit',
      hooks: [{
        type: 'command',
        command: 'node \"' + hooksDir + '/caveman-docs-pre-write.js\"',
        timeout: 3,
        statusMessage: 'caveman-docs: checking doc type...'
      }]
    });
    console.log('  [+] PreToolUse (Write|Edit) hook wired.');
  } else {
    console.log('  [=] PreToolUse hook already present.');
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  console.log('  settings.json updated.');
"

echo ""
echo "Done. Restart Claude Code to activate."
echo ""
echo "Installed:"
echo "  Hooks:"
echo "    - SessionStart        → caveman-docs-activate.js   (injects rules every session)"
echo "    - UserPromptSubmit    → caveman-docs-tracker.js    (detects AI doc write intent)"
echo "    - PreToolUse Write|Edit → caveman-docs-pre-write.js (fires on AI doc paths)"
echo "  Commands:"
echo "    - /caveman-docs <level>     — switch mode (lite/full/ultra/ultimate/wenyan*/off)"
echo "    - /caveman-docs:init        — generate AGENTS.md + CLAUDE.md"
echo "    - /caveman-docs:ai-context  — generate full tree (+ docs/agents/*.md)"
echo "    - /caveman-docs:compress    — compress staged/unstaged AI docs in place"
echo "  Mode resolution: flag file > CAVEMAN_DOCS_DEFAULT_MODE > CAVEMAN_DEFAULT_MODE > config > 'full'"
echo "  Skill:  $SKILLS_DIR/SKILL.md"
echo "  Agent:  $AGENTS_DIR/doc-compressor.md"
echo ""
echo "AI docs compressed: AGENTS.md, CLAUDE.md, docs/agents/*.md, SKILL.md, agents/*.md, commands/*.md"
echo "Exempt:             README.md, CHANGELOG.md, Confluence, Jira, PR descriptions"
