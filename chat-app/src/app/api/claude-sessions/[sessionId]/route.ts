import fs from "fs/promises";
import { getClaudeSessionsDir, resolveSessionFileSafe } from "@/lib/claude-sessions-dir";
import { parseClaudeJsonlToMessages } from "@/lib/parse-claude-jsonl";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { sessionId } = await ctx.params;
  const dir = getClaudeSessionsDir();
  const file = await resolveSessionFileSafe(dir, sessionId);
  if (!file) {
    return Response.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  const raw = await fs.readFile(file, "utf8");
  const messages = parseClaudeJsonlToMessages(raw);
  return Response.json({ sessionId, messages });
}
