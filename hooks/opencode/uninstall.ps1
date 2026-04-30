# caveman-docs uninstaller for OpenCode CLI on Windows. Idempotent.

$ErrorActionPreference = 'Stop'

$ConfigDir = $env:OPENCODE_CONFIG_DIR
if (-not $ConfigDir) {
    if ($env:APPDATA) {
        $ConfigDir = Join-Path $env:APPDATA 'opencode'
    } else {
        $ConfigDir = Join-Path $HOME '.config\opencode'
    }
}

$BeginMark = '<!-- BEGIN CAVEMAN-DOCS -->'
$EndMark   = '<!-- END CAVEMAN-DOCS -->'
$AgentsMd  = Join-Path $ConfigDir 'AGENTS.md'

foreach ($d in @('plugin', 'plugins')) {
    $p = Join-Path $ConfigDir "$d\caveman-docs.ts"
    if (Test-Path $p) { Remove-Item -Force $p }
}

$SkillDir = Join-Path $ConfigDir 'skill\caveman-docs'
if (Test-Path $SkillDir) { Remove-Item -Recurse -Force $SkillDir }

$AgentFile = Join-Path $ConfigDir 'agent\doc-compressor.md'
if (Test-Path $AgentFile) { Remove-Item -Force $AgentFile }

$Flag = Join-Path $ConfigDir '.caveman-docs-active'
if (Test-Path $Flag) { Remove-Item -Force $Flag }

$CommandsDir = Join-Path $ConfigDir 'commands'
foreach ($cmd in @('caveman-docs', 'caveman-docs-help', 'caveman-docs-init', 'caveman-docs-ai-context', 'caveman-docs-compress')) {
    $p = Join-Path $CommandsDir "$cmd.md"
    if (Test-Path $p) { Remove-Item -Force $p }
}

if (Test-Path $AgentsMd) {
    $existing = Get-Content -Raw -LiteralPath $AgentsMd
    if ($existing -match [regex]::Escape($BeginMark)) {
        $pattern = '(?s)\s*' + [regex]::Escape($BeginMark) + '.*?' + [regex]::Escape($EndMark) + '\s*'
        $stripped = [regex]::Replace($existing, $pattern, "`n")
        Set-Content -LiteralPath $AgentsMd -Value $stripped -NoNewline
    }
}

Write-Host "caveman-docs uninstalled from OpenCode ($ConfigDir)."
