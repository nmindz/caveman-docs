# caveman-docs

AI documentation compression plugin for Claude Code. Enforces caveman-style compression when writing or generating AI-oriented docs (AGENTS.md, CLAUDE.md, docs/agents/*.md, SKILL.md, agents/*.md).

Inspired by [caveman](https://github.com/JuliusBrussee/caveman) by Julius Brussee. Fills the AI-documentation gap caveman does not cover: scope rules, hook-driven enforcement, and dedicated generators for AGENTS.md / CLAUDE.md / docs/agents/*.

Licensed under GPLv3. See [LICENSE](./LICENSE).

## What it does

Three hooks fire at different interception points:

| Hook | When | What |
|------|------|------|
| SessionStart | Once per session | Injects compression rules into context |
| UserPromptSubmit | Every prompt | Detects AI doc write intent → injects reminder |
| PreToolUse Write\|Edit | Before every file write | Detects AI doc paths → injects reminder |

Compression applies whether the doc is written by a command, an agent, or directly in conversation.

## Commands

| Command | Scope |
|---------|-------|
| `/caveman-docs:init <path>` | AGENTS.md + CLAUDE.md pair only |
| `/caveman-docs:ai-context <path>` | Full tree: AGENTS.md + CLAUDE.md + docs/agents/*.md (8 files) |
| `/caveman-docs:compress [--staged\|--unstaged\|--all]` | Find modified AI docs in working tree, compress in place |

## Compression rules

| Rule | Drop | Keep |
|------|------|------|
| No meta-prose | "This section provides an overview of..." | Facts starting from line 1 |
| Tables > lists | Bullets for tabular data | `\| Command \| Purpose \|` tables |
| No hedging | typically, usually, note that, please be aware | Explicit conditions |
| No rationale prose | "Rationale: Kluent gives readable messages..." | "enforced by `scripts/check_kluent.sh`" |
| Active voice | "Tests can be run using..." | "Run tests with `npm test`" |
| Numbers as digits | "three patterns" | "3 patterns" |

Code blocks: verbatim, unchanged.

## Scope

**Compressed:**
- `AGENTS.md`, `CLAUDE.md`
- `docs/agents/*.md`
- `SKILL.md`
- `agents/*.md`, `commands/*.md` (agentic harness repos)
- `.claude/*.md`

**Exempt (written normally):**
- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`
- Confluence pages, Jira descriptions
- PR descriptions, commit messages

## Intent detection

The UserPromptSubmit hook also fires on prompts like:
- "write AGENTS.md for this repo"
- "generate AI context docs"
- "create agent documentation"
- "bootstrap AI context for this codebase"
- `/ai-context`, `/caveman-docs:*`

Exempt from detection: prompts mentioning Confluence, Jira, README, PR, human-readable docs.

## Install

Requires Node.js.

```bash
git clone <this-repo> ~/Projects/_myself/caveman-docs
cd ~/Projects/_myself/caveman-docs
bash hooks/install.sh
```

Restart Claude Code to activate.

## Uninstall

```bash
bash hooks/uninstall.sh
```

## Platform

Claude Code CLI only (macOS/Linux).
