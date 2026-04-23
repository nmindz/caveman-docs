#!/usr/bin/env node
// caveman-docs — SessionStart activation hook
// Emits the caveman-docs ruleset as system context every session.
// Shapes AI doc output for Write/Edit on AGENTS.md, CLAUDE.md, docs/agents/*.md, SKILL.md, etc.

const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.caveman-docs-active');

// Write flag (symlink-safe)
safeWriteFlag(flagPath, 'active');

// Read SKILL.md
let skillContent = '';
try {
  skillContent = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'caveman-docs', 'SKILL.md'), 'utf8'
  );
} catch (e) { /* fallback below */ }

let output;
if (skillContent) {
  // Strip YAML frontmatter
  const body = skillContent.replace(/^---[\s\S]*?---\s*/, '');
  output = 'CAVEMAN-DOCS ACTIVE — AI documentation will be written compressed.\n\n' + body;
} else {
  output =
    'CAVEMAN-DOCS ACTIVE\n\n' +
    'When writing AI-oriented docs (AGENTS.md, CLAUDE.md, docs/agents/*.md, SKILL.md,\n' +
    'agents/*.md, commands/*.md): compress to max density.\n\n' +
    'Rules:\n' +
    '- No meta-prose. Heading states topic, body delivers facts.\n' +
    '- Bullets > paragraphs. Tables > lists for tabular data.\n' +
    '- No hedging (typically/usually/generally/note that).\n' +
    '- Active voice, imperative mood.\n' +
    '- Code blocks verbatim.\n' +
    '- Numbers as digits.\n\n' +
    'Exempt: Confluence, Jira, README.md, PR descriptions, CHANGELOG.md.';
}

process.stdout.write(output);

function safeWriteFlag(flagPath, content) {
  try {
    const flagDir = path.dirname(flagPath);
    fs.mkdirSync(flagDir, { recursive: true });

    try {
      if (fs.lstatSync(flagDir).isSymbolicLink()) return;
    } catch (e) { return; }

    try {
      if (fs.lstatSync(flagPath).isSymbolicLink()) return;
    } catch (e) {
      if (e.code !== 'ENOENT') return;
    }

    const tempPath = path.join(flagDir, `.caveman-docs-active.${process.pid}.${Date.now()}`);
    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW;
    let fd;
    try {
      fd = fs.openSync(tempPath, flags, 0o600);
      fs.writeSync(fd, String(content));
      try { fs.fchmodSync(fd, 0o600); } catch (e) {}
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    fs.renameSync(tempPath, flagPath);
  } catch (e) {
    // Silent fail — flag is best-effort
  }
}
