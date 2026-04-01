import type { UIMessage } from "ai";
import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { agentQueryOptions, MODEL } from "@/lib/claude-session";
import {
  AgentToolSpanTracker,
  finalizeAgentGenerationAndTrace,
  getLangfuse,
  resolveLangfuseEnvironment,
} from "@/lib/langfuse-instrumentation";
import { resolveAgentSystemPrompt } from "@/lib/langfuse-system-prompt";
import { DEFAULT_TEST_USER_ID } from "@/lib/chat-user";
import { createUIMessageStream } from "@/lib/stream-adapter";

export const maxDuration = 120;

// セッションIDを会話ごとに保持するための簡易ストア
const sessionStore = new Map<string, string>();

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages: UIMessage[];
    /** useChat / DefaultChatTransport が送るチャット識別子 */
    id?: string;
    chatId?: string;
    developerMode?: boolean;
    /** 履歴から開いた直後など、サーバー Map に無いときの Claude セッション ID */
    resumeSessionId?: string;
  };
  const { messages, developerMode } = body;
  /** AI SDK v6 は `id`、以前の例では `chatId` のことがある */
  const chatKey = body.chatId ?? body.id;

  const lastUserMessage = messages.findLast((m) => m.role === "user");
  if (!lastUserMessage) {
    return new Response("No user message found", { status: 400 });
  }

  // UIMessage の parts からテキストを抽出
  const userText = lastUserMessage.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");

  const existingSessionId =
    (chatKey ? sessionStore.get(chatKey) : undefined) ?? body.resumeSessionId;

  const abortController = new AbortController();
  if (req.signal.aborted) {
    abortController.abort();
  } else {
    req.signal.addEventListener("abort", () => abortController.abort(), {
      once: true,
    });
  }

  const langfuse = getLangfuse();
  const resolvedPrompt = await resolveAgentSystemPrompt(developerMode !== false);

  const userId =
    req.headers.get("x-user-id") ??
    (process.env.NODE_ENV === "test" ? DEFAULT_TEST_USER_ID : undefined);
  const tags = [
    "chat-app",
    developerMode === false ? "mode:business" : "mode:developer",
  ];

  const trace = langfuse.trace({
    name: "claude-agent-chat",
    input: userText,
    ...(chatKey ? { sessionId: chatKey } : {}),
    ...(userId ? { userId } : {}),
    tags,
    environment: resolveLangfuseEnvironment(),
    metadata: {
      developer_mode: developerMode !== false,
      ...(chatKey ? { client_chat_key: chatKey } : {}),
    },
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
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

  // V1: query() + マルチターンは options.resume
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

        if (chatKey && msg.session_id && !sessionStore.has(chatKey)) {
          sessionStore.set(chatKey, msg.session_id);
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
    /** LangfuseTraceClient の id / traceId は同一のトレース UUID */
    langfuseTraceId: trace.id,
  });

  return new Response(uiStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}
