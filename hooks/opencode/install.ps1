# caveman-docs installer for OpenCode CLI on Windows. Idempotent.
#
# Reads source-of-truth files from this repo and installs into:
#   $CONFIG/plugin/caveman-docs.ts
#   $CONFIG/skill/caveman-docs/SKILL.md
#   $CONFIG/agent/doc-compressor.md
#   $CONFIG/commands/caveman-docs*.md
#   $CONFIG/AGENTS.md  (between <!-- BEGIN CAVEMAN-DOCS --> / <!-- END CAVEMAN-DOCS -->)
#
# $CONFIG defaults to $env:OPENCODE_CONFIG_DIR or %APPDATA%\opencode
# (falling back to $HOME/.config/opencode).

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path

$ConfigDir = $env:OPENCODE_CONFIG_DIR
if (-not $ConfigDir) {
    if ($env:APPDATA) {
        $ConfigDir = Join-Path $env:APPDATA 'opencode'
    } else {
        $ConfigDir = Join-Path $HOME '.config\opencode'
    }
}

$PluginsPlural   = Join-Path $ConfigDir 'plugins'
$PluginsSingular = Join-Path $ConfigDir 'plugin'
if ((Test-Path $PluginsPlural) -and -not (Test-Path $PluginsSingular)) {
    $PluginDir = $PluginsPlural
} else {
    $PluginDir = $PluginsSingular
}

$SkillDir    = Join-Path $ConfigDir 'skill\caveman-docs'
$AgentDir    = Join-Path $ConfigDir 'agent'
$CommandsDir = Join-Path $ConfigDir 'commands'
$AgentsMd    = Join-Path $ConfigDir 'AGENTS.md'

$PluginSrc      = Join-Path $RepoRoot 'plugins\caveman-docs\opencode\caveman-docs.ts'
$SkillSrc       = Join-Path $RepoRoot 'skills\caveman-docs\SKILL.md'
$AgentSrc       = Join-Path $RepoRoot 'agents\doc-compressor.md'
$RulesSrc       = Join-Path $RepoRoot 'rules\caveman-docs-activate.md'
$CommandsSrcDir = Join-Path $RepoRoot 'plugins\caveman-docs\opencode\commands'

foreach ($src in @($PluginSrc, $SkillSrc, $AgentSrc, $RulesSrc)) {
    if (-not (Test-Path $src)) {
        Write-Error "source missing: $src"
    }
}

if (-not (Test-Path $CommandsSrcDir)) {
    Write-Error "commands source dir missing: $CommandsSrcDir"
}

$BeginMark = '<!-- BEGIN CAVEMAN-DOCS -->'
$EndMark   = '<!-- END CAVEMAN-DOCS -->'

New-Item -ItemType Directory -Force -Path $ConfigDir, $PluginDir, $SkillDir, $AgentDir, $CommandsDir | Out-Null

Copy-Item -Force $PluginSrc (Join-Path $PluginDir 'caveman-docs.ts')
Copy-Item -Force $SkillSrc  (Join-Path $SkillDir  'SKILL.md')
Copy-Item -Force $AgentSrc  (Join-Path $AgentDir  'doc-compressor.md')

Get-ChildItem -LiteralPath $CommandsSrcDir -Filter '*.md' -File | ForEach-Object {
    Copy-Item -Force $_.FullName (Join-Path $CommandsDir $_.Name)
}

$RulesContent = Get-Content -Raw -LiteralPath $RulesSrc
$Block = "$BeginMark`n$RulesContent`n$EndMark"

if (-not (Test-Path $AgentsMd)) {
    Set-Content -LiteralPath $AgentsMd -Value $Block -NoNewline
    Add-Content -LiteralPath $AgentsMd -Value ''
} else {
    $existing = Get-Content -Raw -LiteralPath $AgentsMd
    if ($existing -match [regex]::Escape($BeginMark)) {
        $pattern = '(?s)' + [regex]::Escape($BeginMark) + '.*?' + [regex]::Escape($EndMark)
        # Use placeholder to avoid regex escape pitfalls in the replacement.
        $placeholder = "__CAVEMAN_DOCS_BLOCK_PLACEHOLDER_$([guid]::NewGuid())__"
        $replaced = [regex]::Replace($existing, $pattern, $placeholder)
        $replaced = $replaced.Replace($placeholder, $Block)
        Set-Content -LiteralPath $AgentsMd -Value $replaced -NoNewline
    } else {
        if ($existing.Length -gt 0 -and -not $existing.EndsWith("`n")) {
            Add-Content -LiteralPath $AgentsMd -Value ''
        }
        Add-Content -LiteralPath $AgentsMd -Value ''
        Add-Content -LiteralPath $AgentsMd -Value $Block
    }
}

Write-Host "caveman-docs installed for OpenCode."
Write-Host "  plugin   -> $(Join-Path $PluginDir 'caveman-docs.ts')"
Write-Host "  skill    -> $(Join-Path $SkillDir 'SKILL.md')"
Write-Host "  agent    -> $(Join-Path $AgentDir 'doc-compressor.md')"
Write-Host "  commands -> $(Join-Path $CommandsDir 'caveman-docs*.md')"
Write-Host "  rules    -> $AgentsMd (between $BeginMark / $EndMark)"
Write-Host ""
Write-Host "Plugin auto-loads from $PluginDir\. No config edit needed."
Write-Host ""
Write-Host "If you prefer explicit registration, add this line to your opencode.jsonc:"
Write-Host ""
Write-Host "  ""plugin"": [""file://$($PluginDir -replace '\\','/')/caveman-docs.ts""]"
Write-Host ""
Write-Host "Restart OpenCode. Then test:"
Write-Host "  - Type /caveman-docs in autocomplete (file-based slash command)"
Write-Host "  - Or send 'activate caveman-docs'"
Write-Host "  - Or set CAVEMAN_DOCS_DEFAULT_MODE=ultra to auto-activate at session start"
