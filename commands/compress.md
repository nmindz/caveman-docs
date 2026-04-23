---
description: "Compress AI doc files in the current directory to caveman style. VCS-aware when possible (git staged/unstaged), falls back to scanning the tree. Finds AGENTS.md, CLAUDE.md, docs/agents/*.md, SKILL.md, agents/*.md, commands/*.md and rewrites them compressed. Human docs exempt."
argument-hint: "[--staged | --unstaged | --all | --tree] [<path>]"
delegates-to: [doc-compressor]
---

CAVEMAN-DOCS MODE ACTIVE. Compresses AI doc files already on disk. Preserves all technical facts, code blocks, section structure. Removes prose padding, rationale paragraphs, meta-prose, hedging.

You are the router for caveman-docs compression of AI docs.

## Resolve target

`$ARGUMENTS` has path → resolve (absolute or relative to CWD).
No path → CWD. Do NOT ask. Do NOT gate on VCS.

## Parse flags

| Flag | Behavior |
|---|---|
| `--staged` | Only staged (git only). Skip if not a git repo. |
| `--unstaged` | Only unstaged (git only). Skip if not a git repo. |
| `--all` (default, git repo) | Staged + unstaged + untracked AI docs (git) |
| `--tree` | Scan entire tree for AI docs regardless of VCS state. Works on any directory. |

Detect VCS:
- `test -d <target>/.git` → git available
- `test -d <target>/.hg` → hg available
- `test -d <target>/.svn` → svn available
- None → fall back to `--tree` automatically

If user passed a VCS-specific flag (`--staged`, `--unstaged`) and VCS is not git: report "VCS flag requires git; falling back to --tree" and continue with `--tree`.

## Discover AI doc files

Git path (`--all`, `--staged`, `--unstaged`):
```bash
git diff --cached --name-only      # staged
git diff --name-only               # unstaged
git ls-files --others --exclude-standard  # untracked
```

Tree path (`--tree` or no VCS):
```bash
find <target> -type f \( \
  -name 'AGENTS.md' -o -name 'CLAUDE.md' -o -name 'SKILL.md' \
  -o -path '*/docs/agents/*.md' -o -path '*/agents/*.md' \
  -o -path '*/commands/*.md' -o -path '*/commands/*.toml' \
  -o -path '*/.claude/*.md' \
\) -not -path '*/node_modules/*' -not -path '*/.git/*'
```

Filter AI doc paths:

**Include:**
- `AGENTS.md`, `CLAUDE.md`
- `docs/agents/*.md`
- `SKILL.md` (anywhere in tree)
- `agents/*.md`
- `commands/*.md`, `commands/*.toml`
- `.claude/*.md`

**Exclude always:**
- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`
- Any path user marks human-facing

If no AI doc files found: report "No AI doc files found." and stop.

Show list before proceeding:

```
Found N AI doc file(s) to compress:
  - docs/agents/architecture.md
  - AGENTS.md
  - docs/agents/project_overview.md
Proceeding...
```

## Delegate to `doc-compressor`

**Input:**
- target: resolved path
- scope: `compress`
- files: list of discovered AI doc paths

**Output:** per-file compression report (original bytes, compressed bytes, ratio).

**Trust but verify:**
- Each file still exists after compression (`test -f`)
- Each file still has its canonical heading (`head -1`)
- `docs/agents/*.md` still ≥120 bytes each

## Output

Summary table:

| File | Before | After | Saved |
|------|--------|-------|-------|
| `AGENTS.md` | 4.2 KB | 1.8 KB | 57% |
| `docs/agents/architecture.md` | 6.1 KB | 2.4 KB | 61% |

Files modified in place. User reviews diff before committing (or not — no VCS required).

## Rules

- No commits, no staging, no VCS ops
- No VCS gating. Target can be any directory (git, hg, svn, plain dir)
- Never compress: README.md, CHANGELOG.md, CONTRIBUTING.md, PR descriptions
- Never delete: technical facts, commands, code blocks, canonical headings, Related documents footers
- Never add content not already in file
