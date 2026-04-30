---
description: Show caveman-docs quick-reference — modes, commands, env vars, scope.
---

Print caveman-docs quick reference:

## Modes

| Level                    | Effect                                                     | Scope                                             |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------- |
| `lite`                   | Drop filler/hedging. Keep articles                         | AI docs                                           |
| `full` (default)         | Drop articles, fragments OK                                | AI docs                                           |
| `ultra`                  | Max compression, abbreviations, arrows                     | AI docs                                           |
| `ultimate`               | `ultra` + intercept ANY `.md` write (advisory in OpenCode) | All `.md` (exempt: README/CHANGELOG/CONTRIBUTING) |
| `wenyan-lite`            | Semi-classical Chinese                                     | AI docs                                           |
| `wenyan` / `wenyan-full` | Full 文言文                                                | AI docs                                           |
| `wenyan-ultra`           | Extreme classical                                          | AI docs                                           |
| `wenyan-ultimate`        | `wenyan-ultra` + intercept ANY `.md` write                 | All `.md`                                         |
| `off`                    | Disable                                                    | —                                                 |

## Commands

| Command                                                               | Purpose                                                         |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `/caveman-docs <level>`                                               | Switch mode. Bare = re-resolve from env/config                  |
| `/caveman-docs-init [path]`                                           | AGENTS.md + CLAUDE.md pair only                                 |
| `/caveman-docs-ai-context <path>`                                     | Full tree: AGENTS.md + CLAUDE.md + docs/agents/\*.md (10 files) |
| `/caveman-docs-compress [--staged\|--unstaged\|--all\|--tree] [path]` | Compress AI docs in working tree                                |
| `/caveman-docs-help`                                                  | This reference                                                  |

## Activation phrases (natural language)

- Activate: "activate caveman-docs", "talk like caveman docs", "enable caveman-docs"
- Deactivate: "stop caveman-docs", "normal docs", "disable caveman-docs"

## Environment variables

| Var                         | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `OPENCODE_CONFIG_DIR`       | Override config root (default: `~/.config/opencode`) |
| `CAVEMAN_DOCS_DEFAULT_MODE` | Default mode for bare `/caveman-docs`                |
| `CAVEMAN_DEFAULT_MODE`      | Shared fallback with upstream `caveman` plugin       |

## Mode resolution order

1. Flag file `$CONFIG/.caveman-docs-active` (set by `/caveman-docs <level>`)
2. `CAVEMAN_DOCS_DEFAULT_MODE` env
3. `CAVEMAN_DEFAULT_MODE` env
4. `~/.config/caveman-docs/config.json` `defaultMode`
5. `full`

## Scope

**Compressed:** AGENTS.md, CLAUDE.md, docs/agents/_.md, SKILL.md, agents/_.md, commands/_.md, .claude/_.md, .cursor/rules/\*.md
**Exempt:** README.md, CHANGELOG.md, CONTRIBUTING.md, Confluence, Jira, PR descriptions, commit messages
