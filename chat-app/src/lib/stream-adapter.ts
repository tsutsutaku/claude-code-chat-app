import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { nanoid } from "nanoid";

import { toolDisplayHint } from "@/lib/tool-subtitle";

/**
 * Claude Agent SDK の SDKMessage を AI SDK UIMessage Stream (SSE) に変換する。
 * テキストブロックごとに text-end を挟み、本文→ツール→本文の順でパートが並ぶようにする。
 */

function encode(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function isToolBlock(
  block: { type: string }
): block is { type: "tool_use" | "mcp_tool_use" | "server_tool_use"; id: string; name: string; input?: unknown } {
  return (
    block.type === "tool_use" ||
    block.type === "mcp_tool_use" ||
    block.type === "server_tool_use"
  );
}

function safeParseToolInput(json: string): unknown {
  const s = json.trim();
  if (!s) return {};
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return { _parseError: true, raw: json };
  }
}

/** パース結果が `{}` だけなのに生 JSON はあるときは文字列を渡し、クライアント側で再パースさせる */
function normalizeToolInputForUi(raw: string): unknown {
  const parsed = safeParseToolInput(raw);
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    Object.keys(parsed).length === 0 &&
    raw.trim().length > 0
  ) {
    return raw.trim();
  }
  return parsed;
}

export type UIMessageStreamOptions = {
  /** Langfuse のトレース ID（クライアントでフィードバック送信に使用） */
  langfuseTraceId?: string;
};

export function createUIMessageStream(
  sdkStream: AsyncGenerator<SDKMessage, void>,
  options?: UIMessageStreamOptions
): ReadableStream {
  const messageId = nanoid();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          encode({
            type: "start",
            messageId,
            ...(options?.langfuseTraceId
              ? { traceId: options.langfuseTraceId }
              : {}),
          })
        )
      );
      controller.enqueue(encoder.encode(encode({ type: "start-step" })));

      /** 開いているテキストセグメントの id（ブロック終了で閉じる） */
      let activeTextId: string | null = null;

      const blockIndexToKind = new Map<
        number,
        "thinking" | "text" | "tool" | "other"
      >();
      const toolJsonByIndex = new Map<number, string>();
      const toolMetaByIndex = new Map<
        number,
        { toolCallId: string; toolName: string }
      >();

      /** toolCallId → title ヒント。output イベントでも title を維持するために保持する */
      const toolTitleByCallId = new Map<string, string>();

      /**
       * stream_event でテキスト／ツールを既に送出したか。
       * 送出済みなのに同じターンの assistant も届くと二重になるためスキップする。
       * 逆に stream が空で assistant だけのときはフォールバックで送出する。
       */
      let streamEmittedAssistantContent = false;

      const emitTextEnd = () => {
        if (activeTextId) {
          controller.enqueue(
            encoder.encode(
              encode({ type: "text-end", id: activeTextId })
            )
          );
          activeTextId = null;
        }
      };

      const ensureTextStart = () => {
        if (!activeTextId) {
          activeTextId = nanoid();
          controller.enqueue(
            encoder.encode(
              encode({ type: "text-start", id: activeTextId })
            )
          );
        }
      };

      const emitTextDelta = (delta: string) => {
        streamEmittedAssistantContent = true;
        ensureTextStart();
        controller.enqueue(
          encoder.encode(
            encode({
              type: "text-delta",
              id: activeTextId!,
              delta,
            })
          )
        );
      };

      const emitToolInputStart = (toolCallId: string, toolName: string) => {
        streamEmittedAssistantContent = true;
        controller.enqueue(
          encoder.encode(
            encode({
              type: "tool-input-start",
              toolCallId,
              toolName,
              dynamic: true,
            })
          )
        );
      };

      const emitToolInputAvailable = (
        toolCallId: string,
        toolName: string,
        input: unknown
      ) => {
        const hint = toolDisplayHint(toolName, input);
        if (hint) toolTitleByCallId.set(toolCallId, hint);
        controller.enqueue(
          encoder.encode(
            encode({
              type: "tool-input-available",
              toolCallId,
              toolName,
              input,
              dynamic: true,
              ...(hint ? { title: hint } : {}),
            })
          )
        );
      };

      const emitToolInputDelta = (toolCallId: string, delta: string) => {
        controller.enqueue(
          encoder.encode(
            encode({
              type: "tool-input-delta",
              toolCallId,
              inputTextDelta: delta,
            })
          )
        );
      };

      const emitToolOutput = (
        toolCallId: string,
        output: unknown,
        isError: boolean
      ) => {
        const savedTitle = toolTitleByCallId.get(toolCallId);
        if (isError) {
          const errText =
            typeof output === "string" ? output : JSON.stringify(output);
          controller.enqueue(
            encoder.encode(
              encode({
                type: "tool-output-error",
                toolCallId,
                errorText: errText || "Tool error",
                dynamic: true,
                ...(savedTitle ? { title: savedTitle } : {}),
              })
            )
          );
        } else {
          controller.enqueue(
            encoder.encode(
              encode({
                type: "tool-output-available",
                toolCallId,
                output,
                dynamic: true,
              })
            )
          );
        }
      };

      const handleUserToolResults = (msg: SDKMessage) => {
        if (msg.type !== "user") return;
        const content = msg.message.content;
        if (typeof content === "string") return;
        for (const block of content) {
          if (block.type !== "tool_result") continue;
          const toolCallId = block.tool_use_id;
          const isError = Boolean(block.is_error);
          const c = block.content;
          let output: unknown;
          if (typeof c === "string") {
            output = c;
          } else if (Array.isArray(c)) {
            const parts = c.map((b) => {
              if (typeof b === "object" && b !== null && "type" in b) {
                if (b.type === "text" && "text" in b) {
                  return (b as { text: string }).text;
                }
              }
              return b;
            });
            output = parts.length === 1 ? parts[0] : parts;
          } else {
            output = c;
          }
          emitToolOutput(toolCallId, output, isError);
        }
      };

      try {
        for await (const msg of sdkStream) {
          handleUserToolResults(msg);

          if (msg.type === "stream_event") {
            const ev = msg.event;

            if (ev.type === "message_start") {
              streamEmittedAssistantContent = false;
              emitTextEnd();
              blockIndexToKind.clear();
              toolJsonByIndex.clear();
              toolMetaByIndex.clear();
            }

            if (ev.type === "content_block_start") {
              const block = ev.content_block;
              const idx = ev.index;
              if (block.type === "thinking" || block.type === "redacted_thinking") {
                blockIndexToKind.set(idx, "thinking");
              } else if (block.type === "text") {
                blockIndexToKind.set(idx, "text");
                ensureTextStart();
              } else if (isToolBlock(block)) {
                emitTextEnd();
                blockIndexToKind.set(idx, "tool");
                const toolCallId = block.id;
                const toolName = block.name;
                toolMetaByIndex.set(idx, { toolCallId, toolName });
                emitToolInputStart(toolCallId, toolName);
                const inputStr =
                  block.input !== undefined && block.input !== null
                    ? typeof block.input === "string"
                      ? block.input
                      : JSON.stringify(block.input)
                    : "";
                // `block.input` が空オブジェクト {} のときは SDK のプレースホルダーなので無視する。
                // 実際の内容は後続の input_json_delta で届く。
                const initial = inputStr === "{}" ? "" : inputStr;
                toolJsonByIndex.set(idx, initial);
              } else {
                blockIndexToKind.set(idx, "other");
              }
            }

            if (ev.type === "content_block_delta") {
              const d = ev.delta;
              if (d.type === "text_delta") {
                emitTextDelta(d.text);
              } else if (d.type === "input_json_delta") {
                const idx = ev.index;
                const meta = toolMetaByIndex.get(idx);
                if (meta) {
                  const prev = toolJsonByIndex.get(idx) ?? "";
                  const next = prev + d.partial_json;
                  toolJsonByIndex.set(idx, next);
                  emitToolInputDelta(meta.toolCallId, d.partial_json);
                }
              }
            }

            if (ev.type === "content_block_stop") {
              const idx = ev.index;
              const kind = blockIndexToKind.get(idx);
              if (kind === "text") {
                emitTextEnd();
              } else if (kind === "tool") {
                const meta = toolMetaByIndex.get(idx);
                if (meta) {
                  const raw = toolJsonByIndex.get(idx) ?? "";
                  emitToolInputAvailable(
                    meta.toolCallId,
                    meta.toolName,
                    normalizeToolInputForUi(raw)
                  );
                }
                toolJsonByIndex.delete(idx);
                toolMetaByIndex.delete(idx);
              }
            }
          }

          if (msg.type === "assistant" && !streamEmittedAssistantContent) {
            const content = msg.message.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (
                  block.type === "thinking" ||
                  block.type === "redacted_thinking"
                ) {
                  continue;
                }
                if (block.type === "text" && block.text) {
                  emitTextDelta(block.text);
                  emitTextEnd();
                } else if (isToolBlock(block)) {
                  emitTextEnd();
                  emitToolInputStart(block.id, block.name);
                  emitToolInputAvailable(
                    block.id,
                    block.name,
                    block.input ?? {}
                  );
                }
              }
            }
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(encode({ type: "error", errorText: errorMessage }))
        );
      }

      emitTextEnd();

      controller.enqueue(encoder.encode(encode({ type: "finish-step" })));
      controller.enqueue(encoder.encode(encode({ type: "finish" })));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}
