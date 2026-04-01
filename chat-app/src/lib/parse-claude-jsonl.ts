import { nanoid } from "nanoid";
import type { ChatMessage, MessagePart, ToolPart } from "@/lib/use-agent-chat";

type JsonlLine = Record<string, unknown>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function extractUserPromptText(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  const texts: string[] = [];
  for (const c of content) {
    if (!isRecord(c)) continue;
    if (c.type === "text" && typeof c.text === "string") texts.push(c.text);
  }
  return texts.length ? texts.join("\n") : null;
}

function isToolResultOnlyUserContent(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.some((c) => isRecord(c) && c.type === "tool_result");
}

function extractToolResult(content: unknown): { toolUseId: string; body: string } | null {
  if (!Array.isArray(content)) return null;
  for (const c of content) {
    if (!isRecord(c) || c.type !== "tool_result") continue;
    const id = c.tool_use_id;
    if (typeof id !== "string") continue;
    const raw = c.content;
    const body =
      typeof raw === "string"
        ? raw
        : raw !== undefined
          ? JSON.stringify(raw, null, 2)
          : "";
    return { toolUseId: id, body };
  }
  return null;
}

function assistantBlocksToParts(blocks: unknown[]): MessagePart[] {
  const parts: MessagePart[] = [];
  for (const b of blocks) {
    if (!isRecord(b)) continue;
    const t = b.type;
    if (t === "thinking") continue;
    if (t === "text" && typeof b.text === "string") {
      parts.push({ type: "text", text: b.text });
      continue;
    }
    if (t === "tool_use" || t === "mcp_tool_use" || t === "server_tool_use") {
      const name = typeof b.name === "string" ? b.name : "Tool";
      const id = typeof b.id === "string" ? b.id : nanoid();
      parts.push({
        type: "tool",
        toolCallId: id,
        toolName: name,
        subtitle: null,
        state: "input-available",
        output: undefined,
        errorText: null,
      } satisfies ToolPart);
    }
  }
  return parts;
}

function applyToolOutput(parts: MessagePart[], toolUseId: string, output: string): void {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.type !== "tool" || p.toolCallId !== toolUseId) continue;
    parts[i] = {
      ...p,
      state: "output-available",
      output,
    };
    return;
  }
}

/**
 * Claude Code / Agent SDK が書き出すセッション JSONL を、チャット UI 用メッセージ列に変換する。
 */
export function parseClaudeJsonlToMessages(raw: string): ChatMessage[] {
  const lines = raw.split("\n").filter((l) => l.trim());
  const messages: ChatMessage[] = [];
  let assistantParts: MessagePart[] = [];

  const flushAssistant = () => {
    if (assistantParts.length === 0) return;
    messages.push({
      id: nanoid(),
      role: "assistant",
      parts: assistantParts,
    });
    assistantParts = [];
  };

  for (const line of lines) {
    let row: JsonlLine;
    try {
      row = JSON.parse(line) as JsonlLine;
    } catch {
      continue;
    }
    const rowType = row.type;
    if (rowType === "queue-operation" || rowType === "last-prompt") continue;

    if (rowType === "user" && isRecord(row.message)) {
      const content = row.message.content;
      const prompt = extractUserPromptText(content);
      if (prompt !== null && prompt !== "" && !isToolResultOnlyUserContent(content)) {
        flushAssistant();
        messages.push({
          id: typeof row.uuid === "string" ? row.uuid : nanoid(),
          role: "user",
          parts: [{ type: "text", text: prompt }],
        });
        continue;
      }
      const tr = extractToolResult(content);
      if (tr) {
        applyToolOutput(assistantParts, tr.toolUseId, tr.body);
      }
      continue;
    }

    if (rowType === "assistant" && isRecord(row.message)) {
      const inner = row.message;
      if (inner.type !== "message" || inner.role !== "assistant") continue;
      const content = inner.content;
      if (!Array.isArray(content)) continue;
      assistantParts.push(...assistantBlocksToParts(content));
    }
  }

  flushAssistant();
  return messages;
}

/** 一覧用: ファイル先頭から走査し、最初のユーザープロンプト文言を返す */
export function extractFirstUserPromptFromJsonl(raw: string): string | null {
  const lines = raw.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    let row: JsonlLine;
    try {
      row = JSON.parse(line) as JsonlLine;
    } catch {
      continue;
    }
    if (row.type !== "user" || !isRecord(row.message)) continue;
    const content = row.message.content;
    const prompt = extractUserPromptText(content);
    if (prompt !== null && prompt.trim() && !isToolResultOnlyUserContent(content)) {
      return prompt.trim();
    }
  }
  return null;
}
