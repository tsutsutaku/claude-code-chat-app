import { unwrapToolInput, tryParseJsonObject, globToolSubtitle, readToolDisplay } from "./read-tool-display.js";
import { bashCommandLine } from "./bash-tool-display.js";

function extractStringField(
  input: unknown,
  keys: string[],
  depth = 0
): string | null {
  if (depth > 10) return null;
  const parsed = tryParseJsonObject(input);
  if (!parsed) return null;

  for (const k of keys) {
    const v = parsed[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  if ("arguments" in parsed) {
    const found = extractStringField(parsed.arguments, keys, depth + 1);
    if (found) return found;
  }
  for (const v of Object.values(parsed)) {
    if (v && typeof v === "object") {
      const found = extractStringField(v, keys, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

const PATH_KEYS = [
  "path",
  "file_path",
  "target_file",
  "target_file_path",
  "file",
  "relative_path",
  "absolute_path",
  "target_notebook",
];

function extractPath(input: unknown): string | null {
  return extractStringField(unwrapToolInput(input), PATH_KEYS);
}

function grepSubtitle(input: unknown): string | null {
  const unwrapped = unwrapToolInput(input);
  const pattern = extractStringField(unwrapped, ["pattern", "regex", "search"]);
  const path = extractStringField(unwrapped, ["path", "file_path", "include"]);
  if (!pattern) return null;
  return path ? `${pattern} (${path})` : pattern;
}

export type ToolDisplayInfo = {
  title: string;
  subtitle: string | null;
};

export function resolveToolDisplay(
  toolName: string,
  input: unknown,
  output?: unknown,
  partTitle?: string
): ToolDisplayInfo {
  const n = toolName.toLowerCase();
  const titleFallback =
    typeof partTitle === "string" &&
    partTitle.trim() &&
    partTitle.trim() !== toolName
      ? partTitle.trim()
      : null;

  if (n === "read") {
    const info = readToolDisplay(input, output);
    return { title: "Read", subtitle: info?.pathHint ?? titleFallback };
  }
  if (n === "bash") {
    return { title: "Bash", subtitle: bashCommandLine(input) ?? titleFallback };
  }
  if (n === "glob") {
    return { title: "Glob", subtitle: globToolSubtitle(input) ?? titleFallback };
  }
  if (n === "grep") {
    return { title: "Grep", subtitle: grepSubtitle(input) ?? titleFallback };
  }
  if (n === "edit" || n === "multiedit") {
    return { title: "Edit", subtitle: extractPath(input) ?? titleFallback };
  }
  if (n === "write") {
    return { title: "Write", subtitle: extractPath(input) ?? titleFallback };
  }
  if (n === "notebookedit" || n === "notebook_edit") {
    return { title: "NotebookEdit", subtitle: extractPath(input) ?? titleFallback };
  }

  return { title: toolName, subtitle: titleFallback };
}

export function toolDisplayHint(
  toolName: string,
  input: unknown
): string | undefined {
  const info = resolveToolDisplay(toolName, input);
  return info.subtitle ?? undefined;
}
