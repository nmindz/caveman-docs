#!/usr/bin/env node
// caveman-docs — UserPromptSubmit hook
// Detects prompts requesting AI doc generation/update and injects caveman-docs compression context.
// Does NOT activate for human-facing doc requests (Confluence, Jira, README, PR descriptions).

const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.caveman-docs-active');

// --- AI doc write intent patterns ---
// Match when user asks to write/generate/update AI-oriented docs

const AI_DOC_WRITE_PATTERNS = [
  // Explicit file names
  /\b(write|create|generate|update|refresh|add|make)\b.{0,40}\bAGENTS\.md\b/i,
  /\b(write|create|generate|update|refresh|add|make)\b.{0,40}\bCLAUDE\.md\b/i,
  /\b(write|create|generate|update|refresh|add|make)\b.{0,40}\bSKILL\.md\b/i,
  /\bdocs[/\\]agents\b.{0,40}\b(write|create|generate|update|add|make)\b/i,
  /\b(write|create|generate|update|add|make)\b.{0,40}\bdocs[/\\]agents\b/i,

  // AI doc concepts
  /\b(write|create|generate|update|refresh|add|make)\b.{0,60}\b(ai.?context|agent.?context|agent.?docs?|agent.?documentation)\b/i,
  /\b(ai.?context|agent.?context|agent.?docs?)\b.{0,40}\b(write|create|generate|update|refresh)\b/i,

  // Slash commands for AI context generation
  /\/(ai-context|caveman-docs|init)\b/i,

  // "write docs" / "update docs" with AI agent signals nearby
  /\b(write|create|generate|update|refresh)\b.{0,30}\bdocs?\b.{0,60}\b(agent|claude|ai|autonomous|coding.?assistant)\b/i,
  /\b(agent|claude|ai|autonomous)\b.{0,40}\b(write|create|generate|update)\b.{0,30}\bdocs?\b/i,

  // bootstrapping context
  /\bbootstrap\b.{0,40}\b(ai|agent|context|docs?)\b/i,
  /\b(onboard|bootstrap)\b.{0,40}\b(repo|repository|codebase)\b.{0,40}\b(ai|agent|claude)\b/i,
];

// --- Human doc patterns (exempt) ---
// If the prompt is clearly about Confluence, Jira, README, PRs — skip injection

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

// --- Deactivation patterns ---
const DEACTIVATE_PATTERNS = [
  /\bstop.?caveman.?docs?\b/i,
  /\bdisable.?caveman.?docs?\b/i,
  /\bnormal.?docs?\b/i,
];

function isFlagActive() {
  try {
    const st = fs.lstatSync(flagPath);
    return st.isFile();
  } catch (e) {
    return true; // flag missing = not explicitly deactivated; still inject
  }
}

const REMINDER =
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
    const prompt = (data.prompt || '').trim();

    if (!prompt) { process.exit(0); }

    // Handle deactivation
    if (DEACTIVATE_PATTERNS.some(p => p.test(prompt))) {
      try { fs.unlinkSync(flagPath); } catch (e) {}
      process.exit(0);
    }

    if (!isFlagActive()) { process.exit(0); }

    // Exempt if clearly about human-facing docs
    if (HUMAN_DOC_PATTERNS.some(p => p.test(prompt))) {
      process.exit(0);
    }

    // Detect AI doc write intent
    if (AI_DOC_WRITE_PATTERNS.some(p => p.test(prompt))) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: REMINDER
        }
      }));
    }
  } catch (e) {
    // Silent fail
  }
  process.exit(0);
});
