"use client";

import { useState, useRef, useCallback } from "react";
import { nanoid } from "nanoid";
import { DEFAULT_TEST_USER_ID } from "@/lib/chat-user";
import { unwrapToolOutput } from "@/lib/subtitle-capturing-fetch";

export type TextPart = {
  type: "text";
  text: string;
};

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

export type ToolPart = {
  type: "tool";
  toolCallId: string;
  toolName: string;
  /** パス・コマンドなどのヒント。一度セットしたら絶対にリセットしない */
  subtitle: string | null;
  state: ToolState;
  output: unknown;
  errorText: string | null;
};

export type MessagePart = TextPart | ToolPart;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  /** この応答に対応する Langfuse トレース（フィードバック用）。履歴読み込み時は無い */
  langfuseTraceId?: string;
};

export type ChatStatus = "idle" | "submitted" | "streaming" | "error";

function parseSSELine(line: string): Record<string, unknown> | null {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6);
  if (data === "[DONE]") return null;
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function useAgentChat(apiPath: string, opts?: { extraBody?: Record<string, unknown> }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  const [status, setStatus] = useState<ChatStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const chatIdRef = useRef<string>(nanoid());
  /** 履歴から開いた Claude セッション ID（初回 query の resume 用） */
  const resumeSessionRef = useRef<string | undefined>(undefined);

  /** アシスタントメッセージの parts をアップデートする */
  const updateLast = useCallback(
    (updater: (parts: MessagePart[]) => MessagePart[]) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        return [
          ...prev.slice(0, -1),
          { ...last, parts: updater(last.parts) },
        ];
      });
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg: ChatMessage = {
        id: nanoid(),
        role: "user",
        parts: [{ type: "text", text }],
      };
      const assistantMsg: ChatMessage = {
        id: nanoid(),
        role: "assistant",
        parts: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStatus("submitted");

      try {
        const resumeSessionId = resumeSessionRef.current;
        const userId =
          process.env.NEXT_PUBLIC_USER_ID ??
          (process.env.NODE_ENV === "test" ? DEFAULT_TEST_USER_ID : undefined);
        const response = await fetch(apiPath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(userId ? { "x-user-id": userId } : {}),
          },
          body: JSON.stringify({
            id: chatIdRef.current,
            ...(resumeSessionId ? { resumeSessionId } : {}),
            messages: [...messagesRef.current, userMsg].map((m) => ({
              id: m.id,
              role: m.role,
              parts: m.parts.filter((p) => p.type === "text"),
            })),
            ...opts?.extraBody,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          setStatus("error");
          return;
        }

        setStatus("streaming");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const ev = parseSSELine(line);
            if (!ev) continue;

            const type = ev.type as string;

            if (type === "start") {
              const traceId =
                typeof ev.traceId === "string" ? ev.traceId : "";
              if (traceId) {
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (!last || last.role !== "assistant") return prev;
                  return [
                    ...prev.slice(0, -1),
                    { ...last, langfuseTraceId: traceId },
                  ];
                });
              }
            } else if (type === "text-start") {
              updateLast((parts) => [
                ...parts,
                { type: "text", text: "" } as TextPart,
              ]);
            } else if (type === "text-delta") {
              const delta = ev.delta as string;
              updateLast((parts) => {
                const last = parts[parts.length - 1];
                if (last?.type === "text") {
                  return [
                    ...parts.slice(0, -1),
                    { ...last, text: last.text + delta },
                  ];
                }
                return [...parts, { type: "text", text: delta }];
              });
            } else if (type === "tool-input-start") {
              const toolCallId = ev.toolCallId as string;
              const toolName = ev.toolName as string;
              updateLast((parts) => [
                ...parts,
                {
                  type: "tool",
                  toolCallId,
                  toolName,
                  subtitle: null,
                  state: "input-streaming",
                  output: undefined,
                  errorText: null,
                } satisfies ToolPart,
              ]);
            } else if (type === "tool-input-available") {
              const toolCallId = ev.toolCallId as string;
              const title =
                typeof ev.title === "string" && ev.title.trim()
                  ? ev.title.trim()
                  : null;
              updateLast((parts) =>
                parts.map((p) =>
                  p.type === "tool" && p.toolCallId === toolCallId
                    ? {
                        ...p,
                        state: "input-available" as const,
                        subtitle: title ?? p.subtitle,
                      }
                    : p
                )
              );
            } else if (type === "tool-output-available") {
              const toolCallId = ev.toolCallId as string;
              const { subtitle: embedded, value } = unwrapToolOutput(ev.output);
              updateLast((parts) =>
                parts.map((p) =>
                  p.type === "tool" && p.toolCallId === toolCallId
                    ? {
                        ...p,
                        state: "output-available" as const,
                        output: value,
                        subtitle: p.subtitle ?? embedded,
                      }
                    : p
                )
              );
            } else if (type === "tool-output-error") {
              const toolCallId = ev.toolCallId as string;
              const errorText = ev.errorText as string;
              updateLast((parts) =>
                parts.map((p) =>
                  p.type === "tool" && p.toolCallId === toolCallId
                    ? { ...p, state: "output-error" as const, errorText }
                    : p
                )
              );
            }
          }
        }

        setStatus("idle");
        resumeSessionRef.current = undefined;
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setStatus("error");
        } else {
          setStatus("idle");
        }
      } finally {
        abortRef.current = null;
      }
    },
    [apiPath, updateLast, opts?.extraBody]
  );

  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    resumeSessionRef.current = undefined;
    chatIdRef.current = nanoid();
    setMessages([]);
    setStatus("idle");
  }, []);

  const loadConversation = useCallback((loaded: ChatMessage[], sessionId: string) => {
    abortRef.current?.abort();
    chatIdRef.current = sessionId;
    resumeSessionRef.current = sessionId;
    setMessages(loaded);
    setStatus("idle");
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  return {
    messages,
    status,
    sendMessage,
    stop,
    newConversation,
    loadConversation,
  };
}
