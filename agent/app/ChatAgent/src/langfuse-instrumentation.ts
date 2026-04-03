import type { SDKMessage, NonNullableUsage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type {
  LangfuseGenerationClient,
  LangfuseSpanClient,
  LangfuseTraceClient,
} from "langfuse";
import Langfuse from "langfuse";

const MAX_TRACE_CHARS = 12_000;

function truncateForTrace(value: unknown, max = MAX_TRACE_CHARS): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length <= max) return value;
    return `${value.slice(0, max)}…[truncated]`;
  }
  try {
    const s = JSON.stringify(value);
    if (s.length <= max) return value;
    return `${s.slice(0, max)}…[truncated]`;
  } catch {
    return "[unserializable]";
  }
}

function isToolContentBlock(
  block: unknown
): block is { type: string; id: string; name: string; input?: unknown } {
  if (typeof block !== "object" || block === null || !("type" in block)) {
    return false;
  }
  const t = (block as { type: string }).type;
  return (
    t === "tool_use" || t === "mcp_tool_use" || t === "server_tool_use"
  );
}

let langfuseSingleton: Langfuse | null = null;

export function getLangfuse(): Langfuse {
  if (!langfuseSingleton) {
    langfuseSingleton = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl:
        process.env.LANGFUSE_BASE_URL ??
        process.env.LANGFUSE_HOST ??
        "https://cloud.langfuse.com",
    });
  }
  return langfuseSingleton;
}

export function usageToLangfuseDetails(
  usage: NonNullableUsage
): Record<string, number> {
  const out: Record<string, number> = {
    input: usage.input_tokens,
    output: usage.output_tokens,
    total: usage.input_tokens + usage.output_tokens,
  };
  if (usage.cache_creation_input_tokens != null) {
    out.cache_creation_input_tokens = usage.cache_creation_input_tokens;
  }
  if (usage.cache_read_input_tokens != null) {
    out.cache_read_input_tokens = usage.cache_read_input_tokens;
  }
  return out;
}

export class AgentToolSpanTracker {
  private readonly open = new Map<string, LangfuseSpanClient>();

  constructor(private readonly parent: LangfuseGenerationClient) {}

  handleMessage(msg: SDKMessage): void {
    if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
      for (const block of msg.message.content) {
        if (!isToolContentBlock(block)) continue;
        if (this.open.has(block.id)) continue;
        const span = this.parent.span({
          name: block.name,
          input: truncateForTrace(block.input ?? {}),
        });
        this.open.set(block.id, span);
      }
    }

    if (msg.type !== "user" || !msg.message?.content) return;
    const content = msg.message.content;
    if (typeof content === "string") return;

    for (const block of content) {
      if (block.type !== "tool_result") continue;
      const span = this.open.get(block.tool_use_id);
      if (!span) continue;

      const c = block.content;
      let output: unknown;
      if (typeof c === "string") {
        output = truncateForTrace(c);
      } else if (Array.isArray(c)) {
        output = truncateForTrace(c);
      } else {
        output = truncateForTrace(c);
      }

      if (block.is_error) {
        span.end({
          output,
          level: "ERROR",
          statusMessage:
            typeof output === "string" ? output : JSON.stringify(output),
        });
      } else {
        span.end({ output });
      }
      this.open.delete(block.tool_use_id);
    }
  }

  endOpenWithWarning(): void {
    for (const span of this.open.values()) {
      span.end({
        level: "WARNING",
        statusMessage: "Stream ended before tool result",
      });
    }
    this.open.clear();
  }
}

export function finalizeAgentGenerationAndTrace(params: {
  trace: LangfuseTraceClient;
  generation: LangfuseGenerationClient;
  result: SDKResultMessage | null;
  streamError: unknown;
  outputText: string;
  model: string;
}): void {
  const { trace, generation, result, streamError, outputText, model } = params;

  if (streamError) {
    const msg =
      streamError instanceof Error ? streamError.message : String(streamError);
    generation.end({
      model,
      output: truncateForTrace(outputText, MAX_TRACE_CHARS) as string,
      level: "ERROR",
      statusMessage: msg,
    });
    trace.update({
      output: truncateForTrace(outputText, MAX_TRACE_CHARS) as string,
      metadata: { stream_error: true },
    });
    return;
  }

  if (result?.type === "result") {
    const usageDetails = usageToLangfuseDetails(result.usage);
    const failed =
      result.subtype !== "success" || result.is_error === true;
    const errMsg =
      result.subtype !== "success" && "errors" in result && result.errors.length
        ? result.errors.join("; ")
        : result.subtype !== "success"
          ? result.subtype
          : undefined;

    generation.end({
      model,
      output: truncateForTrace(outputText, MAX_TRACE_CHARS) as string,
      usageDetails,
      costDetails: { total: result.total_cost_usd },
      metadata: {
        num_turns: result.num_turns,
        duration_ms: result.duration_ms,
        duration_api_ms: result.duration_api_ms,
        stop_reason: result.stop_reason,
        subtype: result.subtype,
      },
      ...(failed
        ? {
            level: "ERROR" as const,
            statusMessage: errMsg ?? "agent reported error",
          }
        : {}),
    });

    trace.update({
      output: truncateForTrace(outputText, MAX_TRACE_CHARS) as string,
      metadata: {
        num_turns: result.num_turns,
        total_cost_usd: result.total_cost_usd,
        claude_session_id: result.session_id,
        stop_reason: result.stop_reason,
      },
    });
    return;
  }

  generation.end({
    model,
    output: truncateForTrace(outputText, MAX_TRACE_CHARS) as string,
    metadata: { note: "no_result_message" },
  });
  trace.update({
    output: truncateForTrace(outputText, MAX_TRACE_CHARS) as string,
    metadata: { note: "no_result_message" },
  });
}

export function resolveLangfuseEnvironment(): string | undefined {
  return process.env.NODE_ENV ?? undefined;
}
