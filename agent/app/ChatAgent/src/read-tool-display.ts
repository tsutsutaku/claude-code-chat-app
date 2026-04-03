export const READ_PREVIEW_LINE_COUNT = 10;
export const GLOB_PREVIEW_LINE_COUNT = READ_PREVIEW_LINE_COUNT;

function basenamePath(p: string): string {
  const n = p.replace(/\\/g, "/").split("/").filter(Boolean);
  return n[n.length - 1] ?? p;
}

export function unwrapToolInput(input: unknown): unknown {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const o = input as Record<string, unknown>;
    if (o._parseError === true && typeof o.raw === "string") {
      const parsed = tryParseJsonObject(o.raw);
      return parsed ?? o.raw;
    }
  }
  return input;
}

export function tryParseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const p = JSON.parse(value) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) {
        return p as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

const PATH_KEY_HINTS = [
  "path",
  "file_path",
  "target_file",
  "target_file_path",
  "file",
  "relative_path",
  "absolute_path",
  "source",
  "uri",
  "location",
];

function collectPathCandidates(obj: unknown, depth = 0): string[] {
  if (depth > 10) return [];
  const out: string[] = [];

  const parsed = tryParseJsonObject(obj);
  if (parsed) {
    for (const k of PATH_KEY_HINTS) {
      const v = parsed[k];
      if (typeof v === "string" && v.trim()) {
        out.push(v.trim());
      }
    }
    if ("arguments" in parsed) {
      out.push(...collectPathCandidates(parsed.arguments, depth + 1));
    }
    for (const v of Object.values(parsed)) {
      if (v && typeof v === "object") {
        out.push(...collectPathCandidates(v, depth + 1));
      }
    }
  }

  return out;
}

function pickBestPath(candidates: string[]): string | null {
  const scored = candidates
    .filter((s) => s.length > 0 && !s.startsWith("http://") && !s.startsWith("https://"))
    .map((s) => ({
      s,
      score:
        (s.includes("/") || s.includes("\\") ? 2 : 0) +
        (/\.[a-zA-Z0-9]{1,8}$/.test(s) ? 1 : 0),
    }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.s ?? null;
}

export type ReadToolDisplay = {
  fileName: string;
  pathHint: string;
};

export function readToolDisplay(
  input: unknown,
  output?: unknown
): ReadToolDisplay | null {
  const fromInput = pickBestPath(
    collectPathCandidates(unwrapToolInput(input))
  );
  if (fromInput) {
    return {
      fileName: basenamePath(fromInput),
      pathHint: fromInput,
    };
  }

  if (output && typeof output === "object" && !Array.isArray(output)) {
    const o = output as Record<string, unknown>;
    for (const k of PATH_KEY_HINTS) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) {
        const p = v.trim();
        return { fileName: basenamePath(p), pathHint: p };
      }
    }
  }

  return null;
}

export function previewReadOutput(
  output: unknown,
  maxLines = READ_PREVIEW_LINE_COUNT
): unknown {
  if (typeof output !== "string") return output;
  const lines = output.split(/\r?\n/);
  if (lines.length <= maxLines) return output;
  return (
    lines.slice(0, maxLines).join("\n") +
    `\n\n…（全 ${lines.length} 行中・先頭 ${maxLines} 行のみ表示）`
  );
}

export function isReadToolName(name: string): boolean {
  return name.toLowerCase() === "read";
}

export function previewGlobOutput(
  output: unknown,
  maxLines = GLOB_PREVIEW_LINE_COUNT
): unknown {
  if (typeof output === "string") {
    return previewReadOutput(output, maxLines);
  }
  if (Array.isArray(output)) {
    const lines = output.map((item) =>
      typeof item === "string" ? item : JSON.stringify(item)
    );
    if (lines.length <= maxLines) return output;
    return (
      lines.slice(0, maxLines).join("\n") +
      `\n\n…（全 ${lines.length} 件中・先頭 ${maxLines} 件のみ表示）`
    );
  }
  return output;
}

export function isGlobToolName(name: string): boolean {
  return name.toLowerCase() === "glob";
}

function collectGlobPatternHints(obj: unknown, depth = 0): string[] {
  if (depth > 10) return [];
  const out: string[] = [];

  const parsed = tryParseJsonObject(obj);
  if (parsed) {
    const pattern = parsed.pattern;
    const pathVal = parsed.path;
    if (typeof pattern === "string" && pattern.trim()) {
      const p = pattern.trim();
      if (typeof pathVal === "string" && pathVal.trim()) {
        out.push(`${pathVal.trim()} — ${p}`);
      } else {
        out.push(p);
      }
    }
    if ("arguments" in parsed) {
      out.push(...collectGlobPatternHints(parsed.arguments, depth + 1));
    }
    for (const v of Object.values(parsed)) {
      if (v && typeof v === "object") {
        out.push(...collectGlobPatternHints(v, depth + 1));
      }
    }
  }

  return out;
}

export function globToolSubtitle(input: unknown): string | null {
  const hints = collectGlobPatternHints(unwrapToolInput(input));
  return hints[0] ?? null;
}
