/**
 * caveman-docs plugin for OpenCode CLI.
 *
 * Ports the Claude Code mode-tracker hook to OpenCode's plugin API.
 *
 * Responsibilities:
 *   1. Slash-command activation: `/caveman-docs`,
 *      `/caveman-docs lite|full|ultra|ultimate|wenyan|wenyan-lite|wenyan-full|wenyan-ultra|wenyan-ultimate|off`.
 *      Workflow dispatchers (`/caveman-docs-init`, `/caveman-docs-ai-context`,
 *      `/caveman-docs-compress`, `/caveman-docs-help`) are file-based commands
 *      and DO NOT mutate the mode flag.
 *   2. Natural-language activation/deactivation: "activate caveman-docs",
 *      "stop caveman-docs", "normal docs", etc.
 *   3. Symlink-safe write of the active mode to a flag file at
 *      `${OPENCODE_CONFIG_DIR or ~/.config/opencode}/.caveman-docs-active`.
 *
 * Environment variables (parity with Claude Code hook):
 *   OPENCODE_CONFIG_DIR        Override config directory (default: ~/.config/opencode)
 *   CAVEMAN_DOCS_DEFAULT_MODE  Override default mode for bare `/caveman-docs`
 *   CAVEMAN_DEFAULT_MODE       Shared with upstream `caveman` plugin (fallback)
 *
 * Compared to Claude Code, OpenCode has no PreToolUse / UserPromptSubmit hook
 * for per-write enforcement. The persistent caveman-docs ruleset ships in
 * AGENTS.md (between `<!-- BEGIN CAVEMAN-DOCS -->` / `<!-- END CAVEMAN-DOCS -->`)
 * and the SKILL.md, both reloaded each session. ULTIMATE-mode write
 * interception is advisory in OpenCode — the AGENTS.md block + SKILL carry
 * that weight.
 */

import type { Plugin } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const VALID_MODES = new Set([
  "off",
  "lite",
  "full",
  "ultra",
  "ultimate",
  "wenyan-lite",
  "wenyan",
  "wenyan-full",
  "wenyan-ultra",
  "wenyan-ultimate",
]);

const ACTIVATE_RE_A =
  /\b(activate|enable|turn on|start)\b.*\bcaveman[-\s]?docs?\b/i;
const ACTIVATE_RE_B =
  /\bcaveman[-\s]?docs?\b.*\b(mode|activate|enable|turn on|start)\b/i;
const DEACTIVATE_RE =
  /\b(stop|disable|turn off|deactivate|exit|end)\b.*\bcaveman[-\s]?docs?\b/i;
const NORMAL_DOCS_RE = /\bnormal\s+docs\b/i;

function configDir(): string {
  return (
    process.env.OPENCODE_CONFIG_DIR ??
    path.join(os.homedir(), ".config", "opencode")
  );
}

function flagPath(): string {
  return path.join(configDir(), ".caveman-docs-active");
}

function readConfigFileMode(): string | null {
  const xdg = process.env.XDG_CONFIG_HOME;
  const candidates = [
    xdg ? path.join(xdg, "caveman-docs", "config.json") : null,
    path.join(os.homedir(), ".config", "caveman-docs", "config.json"),
    process.env.APPDATA
      ? path.join(process.env.APPDATA, "caveman-docs", "config.json")
      : null,
  ].filter((p): p is string => p !== null);

  for (const candidate of candidates) {
    try {
      const raw = fs.readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw) as { defaultMode?: unknown };
      if (
        typeof parsed.defaultMode === "string" &&
        VALID_MODES.has(parsed.defaultMode)
      ) {
        return parsed.defaultMode;
      }
    } catch {
      // Silent fall-through.
    }
  }
  return null;
}

function defaultMode(): string {
  // Resolution order parity with hooks/caveman-docs-config.js:
  //   1. CAVEMAN_DOCS_DEFAULT_MODE
  //   2. CAVEMAN_DEFAULT_MODE (shared with upstream caveman)
  //   3. ~/.config/caveman-docs/config.json defaultMode
  //   4. "full"
  const docsEnv = process.env.CAVEMAN_DOCS_DEFAULT_MODE;
  if (docsEnv && VALID_MODES.has(docsEnv)) return docsEnv;

  const sharedEnv = process.env.CAVEMAN_DEFAULT_MODE;
  if (sharedEnv && VALID_MODES.has(sharedEnv)) return sharedEnv;

  const fileMode = readConfigFileMode();
  if (fileMode) return fileMode;

  return "full";
}

/**
 * Write `content` to `target` atomically, refusing to follow symlinks.
 * Silent-fails on every filesystem error — flag write is best-effort.
 */
function safeWriteFlag(target: string, content: string): void {
  try {
    const dir = path.dirname(target);

    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }

    try {
      const lst = fs.lstatSync(target);
      if (lst.isSymbolicLink()) return;
    } catch {
      // ENOENT — we'll create.
    }

    try {
      const parentLst = fs.lstatSync(dir);
      if (parentLst.isSymbolicLink()) {
        const resolved = fs.realpathSync(dir);
        if (!resolved.startsWith(os.homedir())) return;
      }
    } catch {
      // ignore
    }

    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    const flags =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fs.constants as any).O_WRONLY |
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fs.constants as any).O_CREAT |
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fs.constants as any).O_TRUNC |
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((fs.constants as any).O_NOFOLLOW ?? 0);

    let fd: number | null = null;
    try {
      fd = fs.openSync(tmp, flags, 0o600);
      fs.writeSync(fd, content);
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {
          // ignore
        }
      }
    }

    fs.renameSync(tmp, target);
  } catch {
    // Silent — flag write must never break a session.
  }
}

function clearFlag(target: string): void {
  try {
    fs.unlinkSync(target);
  } catch {
    // ignore — file may not exist
  }
}

interface PromptDecision {
  kind: "set" | "clear" | "noop";
  mode?: string;
}

function decide(prompt: string): PromptDecision {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) return { kind: "noop" };

  // --- Slash-command activation ---
  // Only `/caveman-docs` mutates the mode flag. Workflow dispatchers
  // (`/caveman-docs-init`, `/caveman-docs-ai-context`, `/caveman-docs-compress`,
  // `/caveman-docs-help`) are file-based commands that delegate to the
  // doc-compressor agent — they do NOT toggle persistent mode.
  if (trimmed.startsWith("/")) {
    const parts = trimmed.split(/\s+/);
    const head = parts[0]?.toLowerCase();
    const arg = parts[1]?.toLowerCase();

    if (head === "/caveman-docs") {
      if (!arg) return { kind: "set", mode: defaultMode() };
      if (arg === "off" || arg === "stop" || arg === "disable") {
        return { kind: "clear" };
      }
      if (VALID_MODES.has(arg)) return { kind: "set", mode: arg };
      // Unknown level → fall back to default
      return { kind: "set", mode: defaultMode() };
    }

    return { kind: "noop" };
  }

  // --- Natural-language deactivation (checked first) ---
  if (DEACTIVATE_RE.test(trimmed) || NORMAL_DOCS_RE.test(trimmed)) {
    return { kind: "clear" };
  }

  // --- Natural-language activation ---
  if (ACTIVATE_RE_A.test(trimmed) || ACTIVATE_RE_B.test(trimmed)) {
    return { kind: "set", mode: defaultMode() };
  }

  return { kind: "noop" };
}

interface MessagePart {
  type?: string;
  text?: string;
}

interface MessageInfo {
  role?: string;
  parts?: MessagePart[];
}

function extractPromptText(info: MessageInfo | undefined): string {
  if (!info?.parts || !Array.isArray(info.parts)) return "";
  const chunks: string[] = [];
  for (const part of info.parts) {
    if (part?.type === "text" && typeof part.text === "string") {
      chunks.push(part.text);
    }
  }
  return chunks.join("\n");
}

/**
 * Resolve session-start auto-activation mode.
 *
 * Returns a mode string only when the user has *explicitly* opted in via
 * env var or config.json defaultMode. Returns null otherwise — never write
 * a flag for users who never asked for caveman-docs.
 */
function autoActivateMode(): string | null {
  const docsEnv = process.env.CAVEMAN_DOCS_DEFAULT_MODE;
  if (docsEnv && VALID_MODES.has(docsEnv)) return docsEnv;

  const sharedEnv = process.env.CAVEMAN_DEFAULT_MODE;
  if (sharedEnv && VALID_MODES.has(sharedEnv)) return sharedEnv;

  return readConfigFileMode();
}

export const CavemanDocsPlugin: Plugin = async () => {
  const target = flagPath();

  // Session-start auto-activation: only if explicit opt-in via env or config.
  const auto = autoActivateMode();
  if (auto !== null) {
    safeWriteFlag(target, auto);
  }

  return {
    "message.updated": async (props: unknown) => {
      const p = props as { properties?: { info?: MessageInfo } } | undefined;
      const info = p?.properties?.info;
      if (info?.role !== "user") return;

      const prompt = extractPromptText(info);
      if (prompt.length === 0) return;

      const decision = decide(prompt);
      if (decision.kind === "set" && decision.mode) {
        safeWriteFlag(target, decision.mode);
      } else if (decision.kind === "clear") {
        clearFlag(target);
      }
    },
  };
};
