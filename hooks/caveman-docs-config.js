#!/usr/bin/env node
// caveman-docs — shared configuration resolver
//
// Resolution order for active mode:
//   1. Flag file at $CLAUDE_CONFIG_DIR/.caveman-docs-active (set by /caveman-docs <level>)
//   2. CAVEMAN_DOCS_DEFAULT_MODE environment variable
//   3. CAVEMAN_DEFAULT_MODE environment variable (shared with upstream caveman plugin)
//   4. Config file defaultMode field at:
//      - $XDG_CONFIG_HOME/caveman-docs/config.json
//      - ~/.config/caveman-docs/config.json (macOS / Linux fallback)
//      - %APPDATA%\caveman-docs\config.json (Windows fallback)
//   5. 'full'

const fs = require('fs');
const path = require('path');
const os = require('os');

const VALID_MODES = [
  'off',
  'lite', 'full', 'ultra', 'ultimate',
  'wenyan-lite', 'wenyan', 'wenyan-full', 'wenyan-ultra', 'wenyan-ultimate'
];

// ULTRA-class modes get aggressive compression injection on EVERY user prompt.
const ULTRA_CLASS = new Set(['ultra', 'ultimate', 'wenyan-ultra', 'wenyan-ultimate']);

// ULTIMATE modes intercept ANY .md write (not just AI docs).
const ULTIMATE_MODES = new Set(['ultimate', 'wenyan-ultimate']);

// Wenyan modes write in classical Chinese style.
const WENYAN_MODES = new Set(['wenyan-lite', 'wenyan', 'wenyan-full', 'wenyan-ultra', 'wenyan-ultimate']);

const MAX_FLAG_BYTES = 64;

function getConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'caveman-docs');
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'caveman-docs'
    );
  }
  return path.join(os.homedir(), '.config', 'caveman-docs');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function getClaudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function getFlagPath() {
  return path.join(getClaudeDir(), '.caveman-docs-active');
}

function normalizeMode(raw) {
  if (!raw) return null;
  const m = String(raw).trim().toLowerCase();
  if (!VALID_MODES.includes(m)) return null;
  // Canonicalize wenyan-full → wenyan
  if (m === 'wenyan-full') return 'wenyan';
  return m;
}

function getDefaultMode() {
  // 1. Flag file (set by /caveman-docs <level>)
  const flag = readFlag(getFlagPath());
  if (flag) return flag;

  // 2. Plugin-specific env var
  const docMode = normalizeMode(process.env.CAVEMAN_DOCS_DEFAULT_MODE);
  if (docMode) return docMode;

  // 3. Shared env var (upstream caveman plugin)
  const sharedMode = normalizeMode(process.env.CAVEMAN_DEFAULT_MODE);
  if (sharedMode) return sharedMode;

  // 4. Config file
  try {
    const config = JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
    const cfgMode = normalizeMode(config.defaultMode);
    if (cfgMode) return cfgMode;
  } catch (e) { /* missing or invalid */ }

  // 5. Default
  return 'full';
}

function safeWriteFlag(flagPath, content) {
  try {
    const flagDir = path.dirname(flagPath);
    fs.mkdirSync(flagDir, { recursive: true });

    try {
      if (fs.lstatSync(flagDir).isSymbolicLink()) return;
    } catch (e) { return; }

    try {
      if (fs.lstatSync(flagPath).isSymbolicLink()) return;
    } catch (e) {
      if (e.code !== 'ENOENT') return;
    }

    const tempPath = path.join(flagDir, `.caveman-docs-active.${process.pid}.${Date.now()}`);
    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW;
    let fd;
    try {
      fd = fs.openSync(tempPath, flags, 0o600);
      fs.writeSync(fd, String(content));
      try { fs.fchmodSync(fd, 0o600); } catch (e) {}
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    fs.renameSync(tempPath, flagPath);
  } catch (e) {
    // Silent fail — flag is best-effort
  }
}

function readFlag(flagPath) {
  try {
    let st;
    try { st = fs.lstatSync(flagPath); } catch (e) { return null; }
    if (st.isSymbolicLink() || !st.isFile()) return null;
    if (st.size > MAX_FLAG_BYTES) return null;

    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_RDONLY | O_NOFOLLOW;
    let fd;
    let out;
    try {
      fd = fs.openSync(flagPath, flags);
      const buf = Buffer.alloc(MAX_FLAG_BYTES);
      const n = fs.readSync(fd, buf, 0, MAX_FLAG_BYTES, 0);
      out = buf.slice(0, n).toString('utf8');
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    return normalizeMode(out);
  } catch (e) {
    return null;
  }
}

function clearFlag(flagPath) {
  try { fs.unlinkSync(flagPath); } catch (e) {}
}

// Mode-specific rule fragment used by activate + tracker hooks.
function ruleFragmentFor(mode) {
  switch (mode) {
    case 'lite':
      return 'Level: lite. Drop filler/hedging/pleasantries. Keep articles + full sentences. Professional, tight.';
    case 'full':
      return 'Level: full. Drop articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries, hedging. Fragments OK. Short synonyms (big not extensive). Technical terms exact. Code blocks unchanged.';
    case 'ultra':
      return 'Level: ultra. Maximum compression. Abbreviate (DB/auth/config/req/res/fn/impl). Strip conjunctions. Arrows for causality (X → Y). One word when one word enough. Telegraphic.';
    case 'ultimate':
      return 'Level: ultimate. Same as ultra (max compression, abbreviations, arrows, telegraphic) PLUS: ALL .md files written in this session (any path, any type — not only AI docs) get caveman compression. Exempt: README.md, CHANGELOG.md, CONTRIBUTING.md.';
    case 'wenyan-lite':
      return 'Level: wenyan-lite. Semi-classical Chinese. Drop filler/hedging but keep grammar structure. Classical register.';
    case 'wenyan':
      return 'Level: wenyan (full). Maximum classical terseness. Fully 文言文. 80-90% character reduction. Classical sentence patterns; verbs precede objects; subjects often omitted; classical particles (之/乃/為/其).';
    case 'wenyan-ultra':
      return 'Level: wenyan-ultra. Extreme classical Chinese abbreviation. Maximum compression while keeping classical feel. Ancient scholar on a budget.';
    case 'wenyan-ultimate':
      return 'Level: wenyan-ultimate. Same as wenyan-ultra (extreme classical, max compression) PLUS: ALL .md files written in this session (any path, any type) get wenyan-style compression. Exempt: README.md, CHANGELOG.md, CONTRIBUTING.md.';
    default:
      return '';
  }
}

module.exports = {
  VALID_MODES,
  ULTRA_CLASS,
  ULTIMATE_MODES,
  WENYAN_MODES,
  getDefaultMode,
  getConfigDir,
  getConfigPath,
  getClaudeDir,
  getFlagPath,
  safeWriteFlag,
  readFlag,
  clearFlag,
  normalizeMode,
  ruleFragmentFor
};
