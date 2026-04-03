import type { UIMessage } from "ai";

export const maxDuration = 120;

/** 本番: API Gateway のベース URL（例: https://xxxx.execute-api.us-east-1.amazonaws.com） */
const AGENT_API_URL = process.env.AGENT_API_URL?.replace(/\/$/, "");
/** オプション: API Gateway で API キーを使う場合 */
const AGENT_API_KEY = process.env.AGENT_API_KEY;
/** ローカル: ChatAgent の HTTP サーバー（例: http://localhost:8080） */
const LOCAL_URL = process.env.AGENTCORE_LOCAL_URL?.replace(/\/$/, "");

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

  const baseUrl = LOCAL_URL ?? AGENT_API_URL;
  if (!baseUrl) {
    return new Response(
      JSON.stringify({
        error:
          "AGENT_API_URL または AGENTCORE_LOCAL_URL を設定してください",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const invokeUrl = `${baseUrl}/invocations`;
  console.log("[proxy] →", invokeUrl);
  console.log("[proxy] prompt:", userText.slice(0, 100));

  const agentRes = await fetch(invokeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(AGENT_API_KEY ? { "x-api-key": AGENT_API_KEY } : {}),
    },
    body: payload,
  });

  if (!agentRes.ok || !agentRes.body) {
    const text = await agentRes.text().catch(() => "");
    return new Response(`Agent error (${agentRes.status}): ${text}`, {
      status: 502,
    });
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
