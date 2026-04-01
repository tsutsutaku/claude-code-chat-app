import { unwrapToolInput, tryParseJsonObject } from "@/lib/read-tool-display";

const COMMAND_KEYS = ["command", "cmd", "shell_command"] as const;

function collectCommandCandidates(obj: unknown, depth = 0): string[] {
  if (depth > 10) return [];
  const out: string[] = [];

  const parsed = tryParseJsonObject(obj);
  if (parsed) {
    for (const k of COMMAND_KEYS) {
      const v = parsed[k];
      if (typeof v === "string" && v.trim()) {
        out.push(v.trim());
      }
    }
    if ("arguments" in parsed) {
      out.push(...collectCommandCandidates(parsed.arguments, depth + 1));
    }
    for (const v of Object.values(parsed)) {
      if (v && typeof v === "object") {
        out.push(...collectCommandCandidates(v, depth + 1));
      }
    }
  }

  return out;
}

/**
 * Bash ツールの input から表示用のコマンド行を得る。
 */
export function bashCommandLine(input: unknown): string | null {
  const candidates = collectCommandCandidates(unwrapToolInput(input));
  return candidates[0] ?? null;
}

export function isBashToolName(name: string): boolean {
  return name === "Bash" || name.toLowerCase() === "bash";
}
