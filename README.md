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
| `/caveman-docs <level>` | Switch intensity level (lite/full/ultra/ultimate/wenyan-*/off) |
| `/caveman-docs:init <path>` | AGENTS.md + CLAUDE.md pair only |
| `/caveman-docs:ai-context <path>` | Full tree: AGENTS.md + CLAUDE.md + docs/agents/*.md (8 files) |
| `/caveman-docs:compress [--staged\|--unstaged\|--all]` | Find modified AI docs in working tree, compress in place |

## Intensity levels

Same compression mental model as upstream [caveman](https://github.com/JuliusBrussee/caveman), applied to the AI-documentation scope. Switch with `/caveman-docs <level>` or set a default with the `CAVEMAN_DEFAULT_MODE` (or `CAVEMAN_DOCS_DEFAULT_MODE`) environment variable.

### Standard levels

| Level | Trigger | Effect |
|-------|---------|--------|
| `lite` | `/caveman-docs lite` | Drop filler. Keep grammar. Professional but no fluff |
| `full` | `/caveman-docs full` | Default. Drop articles, fragments OK, full grunt |
| `ultra` | `/caveman-docs ultra` | Maximum compression. Telegraphic. Abbreviate everything |
| `ultimate` | `/caveman-docs ultimate` | Same as `ultra` PLUS intercept ANY `.md` file written in the session, regardless of path or type |

### 文言文 (Wenyan) levels

Classical Chinese literary compression — same technical accuracy in the most token-efficient written language humans ever invented.

| Level | Trigger | Effect |
|-------|---------|--------|
| `wenyan-lite` | `/caveman-docs wenyan-lite` | Semi-classical. Grammar intact, filler gone |
| `wenyan` (or `wenyan-full`) | `/caveman-docs wenyan` | Full 文言文. Maximum classical terseness |
| `wenyan-ultra` | `/caveman-docs wenyan-ultra` | Extreme. Ancient scholar on a budget |
| `wenyan-ultimate` | `/caveman-docs wenyan-ultimate` | Same as `wenyan-ultra` PLUS intercept ANY `.md` file written in the session |

### What `ultimate` / `wenyan-ultimate` do differently

`ultra` and `wenyan-ultra` only compress AI-doc paths (AGENTS.md, CLAUDE.md, docs/agents/*.md, SKILL.md, etc.). The `ultimate` and `wenyan-ultimate` levels extend that interception to **every Markdown file** the agent writes — meeting notes, design docs, ad-hoc `.md` scratch files, anything ending in `.md` or `.markdown`. README.md, CHANGELOG.md, and CONTRIBUTING.md remain exempt in all modes. Non-Markdown files (`.ts`, `.py`, `.go`, etc.) are never touched.

### Mode resolution order

1. Flag file `~/.claude/.caveman-docs-active` (set by `/caveman-docs <level>`)
2. `CAVEMAN_DOCS_DEFAULT_MODE` environment variable
3. `CAVEMAN_DEFAULT_MODE` environment variable (shared with upstream `caveman` plugin)
4. `~/.config/caveman-docs/config.json` `defaultMode` field
5. `full` (default)

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
