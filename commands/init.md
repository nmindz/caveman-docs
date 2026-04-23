---
description: "Generate AGENTS.md + CLAUDE.md pair in caveman-compressed format. Idempotent. Defaults to current repo. Does NOT generate docs/agents/* — use /caveman-docs:ai-context for the full tree."
argument-hint: "[absolute-path | repo-name]"
delegates-to: [doc-compressor]
---

CAVEMAN-DOCS MODE ACTIVE. Every generated artifact must use maximum compression: tables over lists, bullets over paragraphs, no meta-prose, no hedging, active voice.

You are the router for caveman-docs AGENTS.md + CLAUDE.md initialization.

## Resolve target

| Shape of `$ARGUMENTS` | Resolution |
|---|---|
| Starts with `/` | Use as-is |
| Bare name | Probe `~/workspace/<name>`, `~/dev/<name>`, `~/code/<name>` in order |
| Empty | Use CWD (`pwd`). Do NOT ask. |

## Delegate to `doc-compressor`

**Input:**
- target: resolved absolute repo path
- scope: `init`

**Output:**
- AGENTS.md: 6-section table-driven file, ≤ no prose paragraphs
- CLAUDE.md: thin redirect, ≤400 bytes

**Trust but verify:** after agent completes:
- `test -f <target>/AGENTS.md`
- `grep -Fxq '_End of AGENTS.md_' <target>/AGENTS.md`
- `grep -q '| File | Content |' <target>/AGENTS.md`
- `[ $(wc -c < <target>/CLAUDE.md) -le 400 ]`

If any check fails, report the failing path and do not synthesize content. Re-invoke agent after inspecting failure.

## Rules

- Never write Confluence, Jira, Slack, or any external platform artifact
- No staging, committing, or VCS ops — developer reviews diff and commits manually
- No VCS gating. Target can be any directory (git, hg, svn, plain dir)
