---
description: Generate or refresh the full AI context tree (AGENTS.md, CLAUDE.md, docs/agents/*.md) in caveman-compressed format. Idempotent — safe to re-run. Equivalent to /ai-context but with mandatory compression.
---

CAVEMAN-DOCS MODE ACTIVE. Every generated artifact must use maximum compression: tables over lists, bullets over paragraphs, no meta-prose, no hedging, active voice. Existing docs will be regenerated compressed — verbose prose from previous runs is replaced.

You are the router for caveman-docs full AI context tree generation.

Argument: `$ARGUMENTS`

## Resolve target

| Shape of argument | Resolution                                                           |
| ----------------- | -------------------------------------------------------------------- |
| Starts with `/`   | Use as-is                                                            |
| Bare name         | Probe `~/workspace/<name>`, `~/dev/<name>`, `~/code/<name>` in order |
| Empty             | Use CWD (`pwd`). Do NOT ask.                                         |

### Optional flags

| Flag                                                 | Effect                                           |
| ---------------------------------------------------- | ------------------------------------------------ |
| `--repo-type=<service\|library\|cli\|mobile\|infra>` | Skip auto-classification. Pass through to agent. |

## Delegate to `doc-compressor` agent

**Input:**

- target: resolved absolute repo path
- scope: `full`
- repo-type: explicit from flag, or `auto`

**Output:** 10 artifacts at canonical paths. Per-artifact status: `created` / `updated` / `unchanged` / `skipped (N/A)`.

**If agent fails mid-run:** stop, report which artifacts were touched and the failure message. Do not synthesize files from agent output text.

## Verify on disk

Run after agent completes:

```bash
# presence
test -f <target>/AGENTS.md
test -f <target>/CLAUDE.md
test -f <target>/docs/agents/project_overview.md
test -f <target>/docs/agents/architecture.md
test -f <target>/docs/agents/tech_stack.md
test -f <target>/docs/agents/coding_guidelines.md
test -f <target>/docs/agents/domain_rules.md
test -f <target>/docs/agents/api_contracts.md
test -f <target>/docs/agents/data_model.md
test -f <target>/docs/agents/dependencies.md

# structure
grep -Fxq '_End of AGENTS.md_' <target>/AGENTS.md
grep -q '| File | Content |' <target>/AGENTS.md
[ $(wc -c < <target>/CLAUDE.md) -le 400 ]
grep -q 'AGENTS.md' <target>/CLAUDE.md

# docs/agents minimum size (≥120 bytes each)
for f in project_overview architecture tech_stack coding_guidelines domain_rules api_contracts data_model dependencies; do
  [ "$(wc -c < <target>/docs/agents/$f.md)" -ge 120 ]
done
```

If any check fails: report offending paths, do not synthesize content.

## Output

Final summary table:

| Artifact                          | Status                    | Bytes |
| --------------------------------- | ------------------------- | ----- |
| `AGENTS.md`                       | created/updated/unchanged | N     |
| `CLAUDE.md`                       | ...                       | N     |
| `docs/agents/project_overview.md` | ...                       | N     |
| (8 more rows)                     |                           |       |

## Rules

- Never write Confluence, Jira, Slack, GitHub Issues
- No staging, no committing, no VCS ops
- No VCS gating. Target can be any directory
- No new external dependency — Bash, Read, Write, Edit, Glob, Grep only
