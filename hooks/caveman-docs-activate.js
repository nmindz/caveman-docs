#!/usr/bin/env node
// caveman-docs — SessionStart activation hook
// Emits the caveman-docs ruleset as system context every session, scoped to the active mode.
// Mode resolved from flag file → env (CAVEMAN_DOCS_DEFAULT_MODE / CAVEMAN_DEFAULT_MODE) → config → 'full'.

const fs = require('fs');
const path = require('path');
const {
  getDefaultMode,
  getFlagPath,
  safeWriteFlag,
  clearFlag,
  ULTIMATE_MODES,
  ULTRA_CLASS,
  ruleFragmentFor
} = require('./caveman-docs-config');

const flagPath = getFlagPath();
const mode = getDefaultMode();

// "off" — skip activation entirely
if (mode === 'off') {
  clearFlag(flagPath);
  process.stdout.write('OK');
  process.exit(0);
}

// Persist resolved mode so other hooks (tracker, pre-write) read consistently.
safeWriteFlag(flagPath, mode);

// Read SKILL.md as source of truth
let skillContent = '';
try {
  skillContent = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'caveman-docs', 'SKILL.md'), 'utf8'
  );
} catch (e) { /* fallback below */ }

const modeRule = ruleFragmentFor(mode);
const isUltimate = ULTIMATE_MODES.has(mode);
const isUltra = ULTRA_CLASS.has(mode);

const ultimateNotice = isUltimate
  ? '\n\nULTIMATE INTERCEPTION ACTIVE: every .md write in this session — any path, any type — is compressed via caveman rules. Exempt: README.md, CHANGELOG.md, CONTRIBUTING.md.'
  : '';

let output;
if (skillContent) {
  const body = skillContent.replace(/^---[\s\S]*?---\s*/, '');
  output =
    'CAVEMAN-DOCS ACTIVE — level: ' + mode + '\n' +
    modeRule + ultimateNotice + '\n\n' +
    body;
} else {
  output =
    'CAVEMAN-DOCS ACTIVE — level: ' + mode + '\n' +
    modeRule + ultimateNotice + '\n\n' +
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
