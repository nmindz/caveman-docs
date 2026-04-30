caveman-docs active. AI documentation = caveman-style compression. Human docs untouched.

Scope (compress):

- `AGENTS.md`, `CLAUDE.md`, `docs/agents/*.md`
- `SKILL.md`, `agents/*.md`, `commands/*.md`, `commands/*.toml`
- `.claude/*.md`, `.cursor/rules/*.md`, `.windsurf/rules/*.md`

Exempt (write normal):

- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`
- Confluence, Jira, PR descriptions, commit messages

Rules:

- No meta-prose. Heading states topic; content delivers facts.
- Tables > lists for tabular data. Bullets > paragraphs.
- Drop hedging (typically/usually/note that/please be aware).
- Active voice, imperative. Numbers as digits. Code verbatim.

Switch level: /caveman-docs lite|full|ultra|ultimate|wenyan|wenyan-lite|wenyan-full|wenyan-ultra|wenyan-ultimate
Stop: /caveman-docs off or "normal docs"

Workflow commands: /caveman-docs-init, /caveman-docs-ai-context, /caveman-docs-compress, /caveman-docs-help
