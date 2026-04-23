#!/usr/bin/env node
// caveman-docs — PreToolUse hook for Write and Edit tools
// Detects when a Write/Edit targets an AI doc file and injects a compression reminder.
// Fired for tool_name: Write, Edit

const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.caveman-docs-active');

// AI doc path patterns — relative segment match (no full-path requirement)
const AI_DOC_PATTERNS = [
  /\bAGENTS\.md$/i,
  /\bCLAUDE\.md$/i,
  /\bdocs[/\\]agents[/\\][^/\\]+\.md$/i,
  /\bSKILL\.md$/i,
  /\bagents[/\\][^/\\]+\.md$/i,
  /\bcommands[/\\][^/\\]+\.(md|toml)$/i,
  /\b\.claude[/\\][^/\\]+\.md$/i,
  /\b\.cursor[/\\]rules[/\\][^/\\]+\.md[c]?$/i,
  /\b\.windsurf[/\\]rules[/\\][^/\\]+\.md$/i,
];

// Human-facing doc patterns — exempt even if path looks like AI doc
const HUMAN_DOC_PATTERNS = [
  /\bREADME\.md$/i,
  /\bCHANGELOG\.md$/i,
  /\bCONTRIBUTING\.md$/i,
];

function isAIDoc(filePath) {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/');
  if (HUMAN_DOC_PATTERNS.some(p => p.test(normalized))) return false;
  return AI_DOC_PATTERNS.some(p => p.test(normalized));
}

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || data.tool || '';
    const toolInput = data.tool_input || data.input || {};

    // Only act on Write and Edit
    if (!/^(Write|Edit)$/i.test(toolName)) {
      process.exit(0);
    }

    const filePath = toolInput.file_path || toolInput.path || '';

    if (!isAIDoc(filePath)) {
      process.exit(0);
    }

    // Check flag — only inject if caveman-docs is active
    // (always active after SessionStart, but respect manual deactivation)
    let flagActive = true;
    try {
      const st = fs.lstatSync(flagPath);
      if (!st.isFile()) flagActive = false;
    } catch (e) {
      // Flag missing means not installed in this session — still inject since
      // the SessionStart hook may have been installed without the flag mechanism
      flagActive = true;
    }

    if (!flagActive) {
      process.exit(0);
    }

    const fileName = path.basename(filePath);
    const reminder =
      `CAVEMAN-DOCS: "${fileName}" is an AI doc file. Apply compression rules:\n` +
      `- No meta-prose (heading states topic, body delivers facts)\n` +
      `- Bullets > paragraphs. Tables > lists for tabular data.\n` +
      `- No hedging words (typically/usually/generally/note that/please be aware)\n` +
      `- Active voice, imperative mood\n` +
      `- Numbers as digits\n` +
      `- Code blocks verbatim and exact\n` +
      `Exempt (write normally): Confluence, Jira, README.md, PR descriptions, CHANGELOG.md.`;

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: reminder
      }
    }));
  } catch (e) {
    // Silent fail — never block a tool call
  }
  process.exit(0);
});
