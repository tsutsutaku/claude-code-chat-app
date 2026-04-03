import type { TextPromptClient } from "langfuse";
import {
  FALLBACK_BUSINESS_SYSTEM_PROMPT,
  FALLBACK_DEVELOPER_SYSTEM_PROMPT,
} from "./claude-session.js";
import { getLangfuse } from "./langfuse-instrumentation.js";

export const DEFAULT_PROMPT_NAME_DEVELOPER = "claude-agent-system-developer";
export const DEFAULT_PROMPT_NAME_BUSINESS = "claude-agent-system-business";

const PROMPT_NAME_DEVELOPER =
  process.env.LANGFUSE_PROMPT_DEVELOPER ?? DEFAULT_PROMPT_NAME_DEVELOPER;
const PROMPT_NAME_BUSINESS =
  process.env.LANGFUSE_PROMPT_BUSINESS ?? DEFAULT_PROMPT_NAME_BUSINESS;

const PROMPT_LABEL = process.env.LANGFUSE_PROMPT_LABEL ?? "production";

export type ResolvedSystemPrompt = {
  systemPrompt: string;
  langfusePrompt?: TextPromptClient;
};

export async function resolveAgentSystemPrompt(
  developerMode: boolean
): Promise<ResolvedSystemPrompt> {
  const fallback = developerMode
    ? FALLBACK_DEVELOPER_SYSTEM_PROMPT
    : FALLBACK_BUSINESS_SYSTEM_PROMPT;

  if (process.env.LANGFUSE_SYSTEM_PROMPT_SOURCE === "local") {
    return { systemPrompt: fallback };
  }

  const name = developerMode ? PROMPT_NAME_DEVELOPER : PROMPT_NAME_BUSINESS;

  try {
    const lf = getLangfuse();
    const prompt = await lf.getPrompt(name, undefined, {
      label: PROMPT_LABEL,
      type: "text",
      fallback,
    });
    const systemPrompt = prompt.compile();
    return { systemPrompt, langfusePrompt: prompt };
  } catch {
    return { systemPrompt: fallback };
  }
}
