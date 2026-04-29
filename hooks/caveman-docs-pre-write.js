#!/usr/bin/env node
// caveman-docs — PreToolUse hook for Write and Edit tools
// Injects compression reminder when:
//   - target is an AI doc (always, when caveman-docs is active), OR
//   - active mode is ULTIMATE / WENYAN-ULTIMATE → ANY .md file (path/type-agnostic).
// Exempts README.md, CHANGELOG.md, CONTRIBUTING.md in all modes.

const path = require('path');
const {
  getDefaultMode,
  getFlagPath,
  readFlag,
  ULTIMATE_MODES,
  ruleFragmentFor
} = require('./caveman-docs-config');

const flagPath = getFlagPath();

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

const HUMAN_DOC_PATTERNS = [
  /\bREADME\.md$/i,
  /\bCHANGELOG\.md$/i,
  /\bCONTRIBUTING\.md$/i,
];

function isHumanDoc(p) {
  return HUMAN_DOC_PATTERNS.some(r => r.test(p));
}

function isAIDoc(p) {
  if (!p) return false;
  if (isHumanDoc(p)) return false;
  return AI_DOC_PATTERNS.some(r => r.test(p));
}

function isMarkdown(p) {
  return /\.(md|markdown)$/i.test(p);
}

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || data.tool || '';
    const toolInput = data.tool_input || data.input || {};

    if (!/^(Write|Edit|MultiEdit)$/i.test(toolName)) process.exit(0);

    const filePath = (toolInput.file_path || toolInput.path || '').replace(/\\/g, '/');
    if (!filePath) process.exit(0);

    const mode = readFlag(flagPath) || getDefaultMode();
    if (mode === 'off') process.exit(0);

    const aiDoc = isAIDoc(filePath);
    const ultimate = ULTIMATE_MODES.has(mode);
    const anyMd = ultimate && isMarkdown(filePath) && !isHumanDoc(filePath);

    if (!aiDoc && !anyMd) process.exit(0);

    const fileName = path.basename(filePath);
    const scopeNote = aiDoc
      ? `"${fileName}" is an AI doc file.`
      : `"${fileName}" is a Markdown file. ULTIMATE mode (${mode}) compresses every .md write.`;

    const reminder =
      `CAVEMAN-DOCS (${mode}): ${scopeNote} Apply compression:\n` +
      `${ruleFragmentFor(mode)}\n` +
      `- No meta-prose (heading states topic, body delivers facts)\n` +
      `- Bullets > paragraphs. Tables > lists for tabular data.\n` +
      `- No hedging (typically/usually/generally/note that/please be aware)\n` +
      `- Active voice, imperative mood\n` +
      `- Numbers as digits\n` +
      `- Code blocks verbatim and exact\n` +
      `Exempt (write normally): README.md, CHANGELOG.md, CONTRIBUTING.md, Confluence, Jira, PR descriptions.`;

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
