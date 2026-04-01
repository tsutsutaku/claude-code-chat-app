/**
 * 初回のみ: コード内フォールバックと同じ内容を Langfuse にテキストプロンプトとして登録する。
 *
 * 実行例（chat-app 直下）:
 *   node --env-file=.env --import tsx ./scripts/seed-langfuse-prompts.ts
 *
 * 登録後は UI から編集し、`production` ラベルを付けたバージョンを運用してください。
 */
import { getLangfuse } from "../src/lib/langfuse-instrumentation";
import {
  FALLBACK_BUSINESS_SYSTEM_PROMPT,
  FALLBACK_DEVELOPER_SYSTEM_PROMPT,
} from "../src/lib/claude-session";
import {
  DEFAULT_PROMPT_NAME_BUSINESS,
  DEFAULT_PROMPT_NAME_DEVELOPER,
} from "../src/lib/langfuse-system-prompt";

async function main() {
  const lf = getLangfuse();

  await lf.createPrompt({
    name: DEFAULT_PROMPT_NAME_DEVELOPER,
    type: "text",
    prompt: FALLBACK_DEVELOPER_SYSTEM_PROMPT,
    labels: ["production"],
    commitMessage: "Seed from chat-app (developer mode)",
  });
  console.log(`Created/updated prompt: ${DEFAULT_PROMPT_NAME_DEVELOPER}`);

  await lf.createPrompt({
    name: DEFAULT_PROMPT_NAME_BUSINESS,
    type: "text",
    prompt: FALLBACK_BUSINESS_SYSTEM_PROMPT,
    labels: ["production"],
    commitMessage: "Seed from chat-app (business mode)",
  });
  console.log(`Created/updated prompt: ${DEFAULT_PROMPT_NAME_BUSINESS}`);

  await lf.flushAsync();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
