#!/usr/bin/env node
// caveman-docs — UserPromptSubmit hook
// 1. Detects /caveman-docs <level> commands and updates the active-mode flag.
// 2. Detects AI doc write intent and injects the caveman-docs compression reminder.
// 3. Per-turn reinforcement when an aggressive level (ultra/ultimate/wenyan-ultra/wenyan-ultimate) is active.

const fs = require('fs');
const {
  getDefaultMode,
  getFlagPath,
  safeWriteFlag,
  readFlag,
  clearFlag,
  normalizeMode,
  ULTIMATE_MODES,
  ULTRA_CLASS,
  ruleFragmentFor,
  VALID_MODES
} = require('./caveman-docs-config');

const flagPath = getFlagPath();

// AI doc write-intent patterns
const AI_DOC_WRITE_PATTERNS = [
  /\b(write|create|generate|update|refresh|add|make)\b.{0,40}\bAGENTS\.md\b/i,
  /\b(write|create|generate|update|refresh|add|make)\b.{0,40}\bCLAUDE\.md\b/i,
  /\b(write|create|generate|update|refresh|add|make)\b.{0,40}\bSKILL\.md\b/i,
  /\bdocs[/\\]agents\b.{0,40}\b(write|create|generate|update|add|make)\b/i,
  /\b(write|create|generate|update|add|make)\b.{0,40}\bdocs[/\\]agents\b/i,
  /\b(write|create|generate|update|refresh|add|make)\b.{0,60}\b(ai.?context|agent.?context|agent.?docs?|agent.?documentation)\b/i,
  /\b(ai.?context|agent.?context|agent.?docs?)\b.{0,40}\b(write|create|generate|update|refresh)\b/i,
  /\/(ai-context|caveman-docs|init)\b/i,
  /\b(write|create|generate|update|refresh)\b.{0,30}\bdocs?\b.{0,60}\b(agent|claude|ai|autonomous|coding.?assistant)\b/i,
  /\b(agent|claude|ai|autonomous)\b.{0,40}\b(write|create|generate|update)\b.{0,30}\bdocs?\b/i,
  /\bbootstrap\b.{0,40}\b(ai|agent|context|docs?)\b/i,
  /\b(onboard|bootstrap)\b.{0,40}\b(repo|repository|codebase)\b.{0,40}\b(ai|agent|claude)\b/i,
];

const HUMAN_DOC_PATTERNS = [
  /\b(confluence|jira|notion|wiki)\b/i,
  /\bREADME\.md\b/i,
  /\b(pull.?request|PR.?description|commit.?message|changelog)\b/i,
  /\bCHANGELOG\.md\b/i,
  /\bCONTRIBUTING\.md\b/i,
  /\bhuman.?readable\b/i,
  /\bfor.?humans?\b/i,
  /\bnormal.?docs?\b/i,
];

const DEACTIVATE_PATTERNS = [
  /\bstop.?caveman.?-?docs?\b/i,
  /\bdisable.?caveman.?-?docs?\b/i,
  /\bnormal.?docs?\b/i,
];

const REMINDER_BASE =
  'CAVEMAN-DOCS: Detected AI doc write intent. Apply compression rules to all AI doc files:\n' +
  '- No meta-prose (heading states topic, body delivers facts)\n' +
  '- Tables > lists (command+purpose, name+description, symptom+check)\n' +
  '- Bullets > paragraphs\n' +
  '- No hedging (typically/usually/generally/note that/please be aware)\n' +
  '- No rationale prose — cite enforcement (e.g., "enforced by scripts/check_kluent.sh") instead\n' +
  '- Active voice, imperative mood. Numbers as digits.\n' +
  '- Code blocks verbatim.\n' +
  'Exempt (write normally): Confluence, Jira, README.md, CHANGELOG.md, PR descriptions, commit messages.';

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const promptRaw = (data.prompt || '').trim();
    const prompt = promptRaw.toLowerCase();

    if (!prompt) { process.exit(0); }

    // 1) /caveman-docs <level> — set active mode
    //    Accepts: /caveman-docs, /caveman-docs lite|full|ultra|ultimate|wenyan|wenyan-lite|wenyan-ultra|wenyan-ultimate|off
    const slashMatch = prompt.match(/^\/(?:caveman-docs|caveman-docs:caveman-docs)\b\s*(\S+)?/);
    if (slashMatch) {
      const arg = (slashMatch[1] || '').trim();
      if (!arg) {
        // Bare /caveman-docs — re-resolve mode from env/config and persist
        const m = getDefaultMode();
        if (m === 'off') clearFlag(flagPath);
        else safeWriteFlag(flagPath, m);
      } else {
        const target = normalizeMode(arg);
        if (target === 'off') {
          clearFlag(flagPath);
        } else if (target) {
          safeWriteFlag(flagPath, target);
        }
        // Unknown arg: leave existing flag untouched
      }
      // Don't exit — still allow per-turn reminder below to fire on the new mode
    }

    // 2) Deactivation phrases
    if (DEACTIVATE_PATTERNS.some(p => p.test(prompt))) {
      clearFlag(flagPath);
      process.exit(0);
    }

    // 3) Resolve current mode
    const mode = readFlag(flagPath) || getDefaultMode();
    if (mode === 'off') process.exit(0);

    // 4) Inject reminder when:
    //    - AI doc write intent detected (and not human-doc context), OR
    //    - aggressive mode active (ultra-class) — every turn keeps caveman pinned
    const isAIDocIntent =
      !HUMAN_DOC_PATTERNS.some(p => p.test(prompt)) &&
      AI_DOC_WRITE_PATTERNS.some(p => p.test(prompt));

    const aggressive = ULTRA_CLASS.has(mode);

    if (isAIDocIntent || aggressive) {
      const ultimateLine = ULTIMATE_MODES.has(mode)
        ? '\nULTIMATE: also intercept ANY .md file written in this session (not only AI docs). Exempt: README.md, CHANGELOG.md, CONTRIBUTING.md.'
        : '';

      const additionalContext =
        'CAVEMAN-DOCS ACTIVE (' + mode + '). ' + ruleFragmentFor(mode) +
        (isAIDocIntent ? '\n\n' + REMINDER_BASE : '') +
        ultimateLine;

      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext
        }
      }));
    }
  } catch (e) {
    // Silent fail
  }
  process.exit(0);
});
