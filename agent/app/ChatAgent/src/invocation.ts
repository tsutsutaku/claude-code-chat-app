import fs from "fs";
import { randomUUID } from "crypto";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import {
  agentQueryOptions,
  MODEL,
  WORKSPACE_PATH,
} from "./claude-session.js";
import {
  AgentToolSpanTracker,
  finalizeAgentGenerationAndTrace,
  getLangfuse,
  resolveLangfuseEnvironment,
} from "./langfuse-instrumentation.js";
import { resolveAgentSystemPrompt } from "./langfuse-system-prompt.js";
import { createUIMessageStream } from "./stream-adapter.js";

/** チャットセッションごとの Claude Agent SDK セッション ID（Lambda コンテナ再利用時も有効） */
const sessionStore = new Map<string, string>();

export type InvocationBody = {
  prompt?: string;
  developerMode?: boolean;
  chatId?: string;
  resumeSessionId?: string;
};

export type InvocationSuccess = {
  ok: true;
  stream: ReadableStream<Uint8Array>;
};

export type InvocationFailure = {
  ok: false;
  status: number;
  body: string;
};

export type InvocationResult = InvocationSuccess | InvocationFailure;

function jsonError(status: number, obj: object): InvocationFailure {
  return {
    ok: false,
    status,
    body: JSON.stringify(obj),
  };
}

/**
 * POST /invocations と同じ処理。HTTP サーバー・Lambda 双方から利用。
 */
export async function runInvocation(
  body: InvocationBody,
  abortSignal: AbortSignal
): Promise<InvocationResult> {
  const userText = body.prompt?.trim() ?? "";
  if (!userText) {
    return jsonError(400, { error: "No prompt provided" });
  }

  const { developerMode, chatId, resumeSessionId } = body;
  const chatKey = chatId ?? randomUUID();
  const existingSessionId =
    (chatId ? sessionStore.get(chatId) : undefined) ?? resumeSessionId;

  fs.mkdirSync(WORKSPACE_PATH, { recursive: true });

  console.log("[invocation] prompt:", userText.slice(0, 100));
  console.log("[invocation] chatKey:", chatKey);
  console.log("[invocation] WORKSPACE_PATH:", WORKSPACE_PATH);
  console.log("[invocation] existingSessionId:", existingSessionId ?? "none");

  const langfuse = getLangfuse();
  const resolvedPrompt = await resolveAgentSystemPrompt(developerMode !== false);

  const trace = langfuse.trace({
    name: "claude-agent-chat",
    input: userText,
    ...(chatId ? { sessionId: chatId } : {}),
    tags: [
      "lambda",
      developerMode === false ? "mode:business" : "mode:developer",
    ],
    environment: resolveLangfuseEnvironment(),
    metadata: {
      developer_mode: developerMode !== false,
      ...(chatId ? { client_chat_key: chatId } : {}),
    },
  });

  const generation = trace.generation({
    name: "claude-agent-query",
    model: MODEL,
    input: userText,
    modelParameters: {
      developer_mode: developerMode !== false,
    },
    ...(resolvedPrompt.langfusePrompt
      ? { prompt: resolvedPrompt.langfusePrompt }
      : {}),
  });

  const toolTracker = new AgentToolSpanTracker(generation);

  const abortController = new AbortController();
  abortSignal.addEventListener("abort", () => abortController.abort());

  const q = query({
    prompt: userText,
    options: agentQueryOptions({
      resume: existingSessionId,
      abortController,
      systemPrompt: resolvedPrompt.systemPrompt,
    }),
  });

  const wrappedStream = async function* (): AsyncGenerator<SDKMessage, void> {
    let outputText = "";
    let resultMessage: SDKResultMessage | null = null;
    let streamError: unknown = null;

    try {
      for await (const msg of q) {
        toolTracker.handleMessage(msg);

        if (chatId && msg.session_id && !sessionStore.has(chatId)) {
          sessionStore.set(chatId, msg.session_id);
        }
        if (
          msg.type === "assistant" &&
          Array.isArray(msg.message?.content)
        ) {
          for (const block of msg.message.content) {
            if (block.type === "text") outputText += block.text;
          }
        }
        if (msg.type === "result") {
          resultMessage = msg;
        }
        yield msg;
      }
    } catch (err) {
      streamError = err;
      console.error("[invocation] stream error:", err);
      throw err;
    } finally {
      toolTracker.endOpenWithWarning();
      finalizeAgentGenerationAndTrace({
        trace,
        generation,
        result: resultMessage,
        streamError,
        outputText,
        model: MODEL,
      });
      await langfuse.flushAsync();
    }
  };

  const uiStream = createUIMessageStream(wrappedStream(), {
    langfuseTraceId: trace.id,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = uiStream.getReader();
      try {
        while (true) {
          if (abortSignal.aborted) break;
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (err) {
        console.error("[invocation] pipe error:", err);
        controller.error(err);
        return;
      }
      controller.close();
    },
    cancel() {
      abortController.abort();
    },
  });

  return { ok: true, stream };
}
