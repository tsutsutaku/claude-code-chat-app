import type { UIMessage } from "ai";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";

export const maxDuration = 120;

const AGENT_ARN = process.env.AGENTCORE_AGENT_ARN;
const AWS_REGION = process.env.AGENTCORE_REGION ?? process.env.AWS_REGION ?? "us-east-1";
/** ローカル開発用: agentcore dev のエンドポイント（例: http://localhost:8080） */
const LOCAL_URL = process.env.AGENTCORE_LOCAL_URL?.replace(/\/$/, "");

/**
 * chatId（nanoid 21文字）を AgentCore RuntimeSessionId の制約（最小 33 文字、
 * パターン [a-zA-Z0-9][a-zA-Z0-9-_]*）に合わせる。
 */
function toRuntimeSessionId(chatId: string): string {
  if (chatId.length >= 33) return chatId.slice(0, 256);
  return (chatId + "0".repeat(33 - chatId.length)).slice(0, 256);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages: UIMessage[];
    id?: string;
    chatId?: string;
    developerMode?: boolean;
    resumeSessionId?: string;
  };
  const { messages, developerMode } = body;
  const chatKey = body.chatId ?? body.id;

  const lastUserMessage = messages.findLast((m) => m.role === "user");
  if (!lastUserMessage) {
    return new Response("No user message found", { status: 400 });
  }

  const userText = lastUserMessage.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n");

  const payload = JSON.stringify({
    prompt: userText,
    developerMode: developerMode !== false,
    chatId: chatKey,
    ...(body.resumeSessionId ? { resumeSessionId: body.resumeSessionId } : {}),
  });

  // ── ローカル開発モード: agentcore dev に直接 HTTP リクエスト ──
  if (LOCAL_URL) {
    console.log("[proxy] local mode →", LOCAL_URL);
    console.log("[proxy] prompt:", userText.slice(0, 100));

    const agentRes = await fetch(`${LOCAL_URL}/invocations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    if (!agentRes.ok || !agentRes.body) {
      const text = await agentRes.text().catch(() => "");
      return new Response(`AgentCore local error: ${text}`, { status: 502 });
    }

    return new Response(agentRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "x-vercel-ai-ui-message-stream": "v1",
      },
    });
  }

  // ── 本番モード: InvokeAgentRuntime (AWS SDK) ──
  if (!AGENT_ARN) {
    return new Response(
      JSON.stringify({
        error:
          "AGENTCORE_AGENT_ARN または AGENTCORE_LOCAL_URL を設定してください",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const client = new BedrockAgentCoreClient({ region: AWS_REGION });
  const runtimeSessionId = chatKey
    ? toRuntimeSessionId(chatKey)
    : toRuntimeSessionId(crypto.randomUUID().replace(/-/g, ""));

  console.log("[proxy] agentArn:", AGENT_ARN);
  console.log("[proxy] runtimeSessionId:", runtimeSessionId);
  console.log("[proxy] prompt:", userText.slice(0, 100));

  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: AGENT_ARN,
    runtimeSessionId,
    payload: Buffer.from(payload, "utf8"),
    contentType: "application/json",
    qualifier: "DEFAULT",
  });

  const response = await client.send(command);

  if (!response.response) {
    return new Response("AgentCore returned no response body", { status: 502 });
  }

  const agentStream = response.response as ReadableStream<Uint8Array>;

  return new Response(agentStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}
