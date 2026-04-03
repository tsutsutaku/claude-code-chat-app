/**
 * 初回のみ: コード内フォールバックと同じ内容を Langfuse にテキストプロンプトとして登録する。
 *
 * 実行例（chat-app 直下）:
 *   node --env-file=.env --import tsx ./scripts/seed-langfuse-prompts.ts
 *
 * 登録後は UI から編集し、`production` ラベルを付けたバージョンを運用してください。
 */
import Langfuse from "langfuse";

// プロンプト名（agent/app/ChatAgent/src/langfuse-system-prompt.ts と合わせること）
const DEFAULT_PROMPT_NAME_DEVELOPER = "claude-agent-system-prompt-developer";
const DEFAULT_PROMPT_NAME_BUSINESS = "claude-agent-system-prompt-business";

// フォールバック内容（agent/app/ChatAgent/src/claude-session.ts と合わせること）
const FALLBACK_DEVELOPER_SYSTEM_PROMPT = `あなたは kurewari（家族向け割り勘アプリ）の開発を支援する AIアシスタントです。
workspace/ 以下のファイルを自由に読み書きし、コードの説明・修正・実装を行ってください。
技術的な詳細（コード、型、設計）を含む開発者向けの回答をしてください。`;

const FALLBACK_BUSINESS_SYSTEM_PROMPT = `あなたは kurewari（家族向け割り勘アプリ）の開発を支援する AIアシスタントです。
workspace/ 以下のファイルを自由に読み書きし、コードの説明・修正・実装を行ってください。
専門用語やコードは避け、ビジネスオーナー向けに平易な言葉で回答してください。`;

async function main() {
  const lf = new Langfuse({
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
  });

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
