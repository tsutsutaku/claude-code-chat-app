import { createServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";
import { runInvocation, type InvocationBody } from "./invocation.js";

const PORT = 8080;
const HOST = "0.0.0.0";

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
  let body: InvocationBody = {};

  try {
    const raw = await readBody(req);
    if (raw.trim()) {
      body = JSON.parse(raw) as InvocationBody;
    }
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  const result = await runInvocation(body, abortController.signal);

  if (!result.ok) {
    res.writeHead(result.status, { "Content-Type": "application/json" });
    res.end(result.body);
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const reader = result.stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
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
  console.log(`[server] ChatAgent HTTP on ${HOST}:${PORT}`);
});
