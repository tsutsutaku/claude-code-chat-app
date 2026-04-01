import fs from "fs/promises";
import path from "path";

const DEFAULT_RELATIVE =
  ".claude/projects/-Users-tsutsutaku-Documents-dev-20260401-claude-agent-sdk-workspace";

/**
 * Claude がセッション JSONL を保存するディレクトリ。
 * `CLAUDE_SESSIONS_DIR` で上書き可能（未設定時は `~` + 既定の相対パス）。
 */
export function getClaudeSessionsDir(): string {
  const env = process.env.CLAUDE_SESSIONS_DIR?.trim();
  if (env) return path.resolve(env);
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return path.join(home, DEFAULT_RELATIVE);
}

const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i;

export function isValidSessionFilename(name: string): boolean {
  return SESSION_ID_RE.test(name);
}

export function sessionIdFromFilename(filename: string): string | null {
  if (!isValidSessionFilename(filename)) return null;
  return filename.replace(/\.jsonl$/i, "");
}

/** パスがセッションルート配下に解決されることを検証し、正規化パスを返す */
export async function resolveSessionFileSafe(
  sessionsDir: string,
  sessionId: string
): Promise<string | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return null;
  }
  const base = path.resolve(sessionsDir);
  const file = path.resolve(base, `${sessionId}.jsonl`);
  if (!file.startsWith(base + path.sep) && file !== base) return null;
  try {
    const st = await fs.stat(file);
    if (!st.isFile()) return null;
  } catch {
    return null;
  }
  return file;
}
