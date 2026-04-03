/**
 * API Gateway HTTP API (v2) + Lambda レスポンスストリーミング。
 * Node.js 22 の Lambda で `awslambda` グローバルが有効なときのみ利用。
 */
import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { runInvocation, type InvocationBody } from "./invocation.js";

// Lambda ランタイムが注入（型は緩め）
declare const awslambda: {
  streamifyResponse: (
    fn: (
      event: APIGatewayProxyEventV2,
      responseStream: NodeJS.WritableStream,
      context: Context
    ) => void | Promise<void>
  ) => (event: APIGatewayProxyEventV2, context: Context) => Promise<void>;
  HttpResponseStream: {
    from: (
      stream: NodeJS.WritableStream,
      metadata: {
        statusCode: number;
        headers?: Record<string, string>;
      }
    ) => NodeJS.WritableStream & { write: (c: string | Uint8Array) => void; end: () => void };
  };
};

function parseBody(event: APIGatewayProxyEventV2): string {
  let body = event.body ?? "{}";
  if (event.isBase64Encoded) {
    body = Buffer.from(body, "base64").toString("utf8");
  }
  return body;
}

async function handleWithStream(
  event: APIGatewayProxyEventV2,
  responseStream: NodeJS.WritableStream,
  _context: Context
): Promise<void> {
  const path = event.rawPath ?? event.requestContext.http.path;

  if (event.requestContext.http.method === "OPTIONS") {
    const http = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
    });
    http.end();
    return;
  }

  if (event.requestContext.http.method === "GET" && path.endsWith("/ping")) {
    const http = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
    });
    http.end(
      JSON.stringify({
        status: "Healthy",
        time_of_last_update: Math.floor(Date.now() / 1000),
      })
    );
    return;
  }

  if (event.requestContext.http.method !== "POST" || !path.endsWith("/invocations")) {
    const http = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
    });
    http.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  let parsed: InvocationBody;
  try {
    parsed = JSON.parse(parseBody(event)) as InvocationBody;
  } catch {
    const http = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
    });
    http.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const abortController = new AbortController();

  const result = await runInvocation(parsed, abortController.signal);

  if (!result.ok) {
    const http = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: result.status,
      headers: { "Content-Type": "application/json" },
    });
    http.end(result.body);
    return;
  }

  const httpStream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });

  const reader = result.stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      httpStream.write(value);
    }
  } catch (err) {
    console.error("[lambda] stream error:", err);
  } finally {
    httpStream.end();
  }
}

export const handler = awslambda.streamifyResponse(handleWithStream);
