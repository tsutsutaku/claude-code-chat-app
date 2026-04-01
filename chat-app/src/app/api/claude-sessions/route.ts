import fs from "fs/promises";
import path from "path";
import {
  getClaudeSessionsDir,
  isValidSessionFilename,
  sessionIdFromFilename,
} from "@/lib/claude-sessions-dir";
import { extractFirstUserPromptFromJsonl } from "@/lib/parse-claude-jsonl";

export const dynamic = "force-dynamic";

const READ_PREFIX_BYTES = 96 * 1024;

export async function GET() {
  const dir = getClaudeSessionsDir();
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return Response.json(
      {
        dir,
        error: "ディレクトリを開けません。CLAUDE_SESSIONS_DIR を確認してください。",
        sessions: [] as { id: string; title: string; updatedAt: string }[],
      },
      { status: 200 }
    );
  }

  const entries: { id: string; title: string; updatedAt: string }[] = [];
  for (const name of names) {
    if (!isValidSessionFilename(name)) continue;
    const id = sessionIdFromFilename(name);
    if (!id) continue;
    const full = path.join(dir, name);
    let st: Awaited<ReturnType<typeof fs.stat>>;
    try {
      st = await fs.stat(full);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    let title = id.slice(0, 8) + "…";
    try {
      const fh = await fs.open(full, "r");
      try {
        const buf = Buffer.allocUnsafe(Math.min(READ_PREFIX_BYTES, st.size));
        const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
        const prefix = buf.subarray(0, bytesRead).toString("utf8");
        const first = extractFirstUserPromptFromJsonl(prefix);
        if (first) title = first.length > 120 ? `${first.slice(0, 117)}…` : first;
      } finally {
        await fh.close();
      }
    } catch {
      /* keep fallback title */
    }
    entries.push({
      id,
      title,
      updatedAt: st.mtime.toISOString(),
    });
  }

  entries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return Response.json({ dir, sessions: entries });
}
