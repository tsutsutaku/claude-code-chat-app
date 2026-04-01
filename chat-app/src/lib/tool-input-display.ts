/**
 * AI SDK の dynamic-tool パートから、表示用の input を取り出す。
 * - `input` が空オブジェクトで `rawInput` があるときは raw を優先（クライアント側の取りこぼし対策）
 */
export function getDynamicToolInput(part: {
  input?: unknown;
  rawInput?: unknown;
}): unknown {
  const { input, rawInput } = part;
  if (input !== undefined && input !== null) {
    if (
      typeof input === "object" &&
      !Array.isArray(input) &&
      Object.keys(input as object).length === 0 &&
      rawInput !== undefined
    ) {
      return rawInput;
    }
    return input;
  }
  return rawInput;
}
