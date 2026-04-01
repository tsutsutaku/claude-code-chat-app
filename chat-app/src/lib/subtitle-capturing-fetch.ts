"use client";

/**
 * ツールの output に埋め込まれた { __subtitle, __value } ラッパーを展開する。
 * サーバー（stream-adapter）がサブタイトルを output に埋め込んで送り、
 * AI SDK が part.output として保持するため、状態遷移後も確実に取り出せる。
 */
export type WrappedToolOutput = {
  __subtitle: string;
  __value: unknown;
};

export function isWrappedOutput(output: unknown): output is WrappedToolOutput {
  return (
    output !== null &&
    typeof output === "object" &&
    !Array.isArray(output) &&
    "__subtitle" in output &&
    typeof (output as WrappedToolOutput).__subtitle === "string"
  );
}

export function unwrapToolOutput(output: unknown): {
  subtitle: string | null;
  value: unknown;
} {
  if (isWrappedOutput(output)) {
    return { subtitle: output.__subtitle, value: output.__value };
  }
  return { subtitle: null, value: output };
}
