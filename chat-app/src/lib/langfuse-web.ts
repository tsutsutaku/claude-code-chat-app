import { LangfuseWeb } from "langfuse";

/** Langfuse 推奨: 明示的フィードバックのスコア名（ソースが分かる名前） */
export const USER_THUMBS_SCORE_NAME = "user-thumbs";

let singleton: LangfuseWeb | null = null;

/**
 * ブラウザ用 Langfuse クライアント（公開キーのみ）。未設定時は null。
 */
export function getLangfuseWeb(): LangfuseWeb | null {
  const publicKey = process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY;
  if (!publicKey) return null;
  if (!singleton) {
    singleton = new LangfuseWeb({
      publicKey,
      baseUrl:
        process.env.NEXT_PUBLIC_LANGFUSE_BASE_URL ??
        process.env.NEXT_PUBLIC_LANGFUSE_HOST ??
        "https://cloud.langfuse.com",
    });
  }
  return singleton;
}
