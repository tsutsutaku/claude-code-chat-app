import fs from "fs";
import { createServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";
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

const PORT = 8080;
const HOST = "0.0.0.0";

/** チャットセッションごとの Claude Agent SDK セッション ID を管理 */
const sessionStore = new Map<string, string>();

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handlePing(res: ServerResponse): Promise<void> {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "Healthy",
      time_of_last_update: Math.floor(Date.now() / 1000),
    })
  );
}

async function handleInvocations(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  let body: {
    prompt?: string;
    developerMode?: boolean;
    chatId?: string;
    resumeSessionId?: string;
  } = {};

  try {
    const raw = await readBody(req);
    if (raw.trim()) {
      body = JSON.parse(raw) as typeof body;
    }
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const userText = body.prompt?.trim() ?? "";
  if (!userText) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No prompt provided" }));
    return;
  }

  const { developerMode, chatId, resumeSessionId } = body;
  const chatKey = chatId ?? randomUUID();
  const existingSessionId =
    (chatId ? sessionStore.get(chatId) : undefined) ?? resumeSessionId;

  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  fs.mkdirSync(WORKSPACE_PATH, { recursive: true });

  console.log("[server] prompt:", userText.slice(0, 100));
  console.log("[server] chatKey:", chatKey);
  console.log("[server] WORKSPACE_PATH:", WORKSPACE_PATH);
  console.log("[server] existingSessionId:", existingSessionId ?? "none");

  const langfuse = getLangfuse();
  const resolvedPrompt = await resolveAgentSystemPrompt(developerMode !== false);

  const trace = langfuse.trace({
    name: "claude-agent-chat",
    input: userText,
    ...(chatId ? { sessionId: chatId } : {}),
    tags: [
      "agentcore",
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
      console.error("[server] stream error:", err);
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

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const reader = uiStream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch (err) {
    console.error("[server] pipe error:", err);
  } finally {
    res.end();
  }
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const method = req.method?.toUpperCase() ?? "GET";
  const url = req.url ?? "/";

  console.log(`[server] ${method} ${url}`);

  try {
    if (method === "GET" && url === "/ping") {
      await handlePing(res);
    } else if (method === "POST" && url === "/invocations") {
      await handleInvocations(req, res);
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  } catch (err) {
    console.error("[server] unhandled error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[server] AgentCore ChatAgent running on ${HOST}:${PORT}`);
  console.log(`[server] WORKSPACE_PATH: ${WORKSPACE_PATH}`);
});
