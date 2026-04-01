import path from "path";
import type {
  CanUseTool,
  PermissionResult,
} from "@anthropic-ai/claude-agent-sdk";

type ToolUseOptions = Parameters<CanUseTool>[2];

/**
 * ツール入力に含まれるパス系フィールドが workspace ルート配下か検証する。
 * Bash はコマンド文字列を簡易チェックする。
 */

const PATH_KEYS = new Set([
  "path",
  "file_path",
  "target_file",
  "target_directory",
  "directory",
  "old_path",
  "new_path",
  "file",
  "source",
  "destination",
  "glob_pattern",
]);

function isUnderRoot(absPath: string, root: string): boolean {
  const r = path.resolve(root);
  const p = path.resolve(absPath);
  return p === r || p.startsWith(r + path.sep);
}

function resolvedPathWithin(root: string, value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  const resolved = path.isAbsolute(v) ? path.resolve(v) : path.resolve(root, v);
  return isUnderRoot(resolved, root);
}

function walkPathFields(
  obj: unknown,
  visit: (key: string, value: string) => void,
  parentKey = ""
): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === "string") {
    if (PATH_KEYS.has(parentKey) || parentKey.endsWith("_path")) {
      visit(parentKey, obj);
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => walkPathFields(item, visit, `${parentKey}[${i}]`));
    return;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      walkPathFields(v, visit, k);
    }
  }
}

function deny(message: string): PermissionResult {
  return { behavior: "deny", message };
}

/**
 * cwd を workspace のルートとし、その外へのファイル操作・参照を拒否する。
 */
export function createWorkspaceCanUseTool(workspaceRoot: string): CanUseTool {
  const root = path.resolve(workspaceRoot);

  return async (
    toolName: string,
    input: Record<string, unknown>,
    _options: ToolUseOptions
  ): Promise<PermissionResult> => {
    if (toolName === "Bash") {
      const cmd = String(input.command ?? "");
      if (!cmd.trim()) {
        return { behavior: "allow", updatedInput: input };
      }
      const absPaths = cmd.match(/\/[^\s;|&`'"]+/g) ?? [];
      for (const seg of absPaths) {
        const candidate = seg.length > 1 ? seg : "";
        if (!candidate) continue;
        const resolved = path.resolve(candidate);
        if (!isUnderRoot(resolved, root)) {
          return deny(
            `workspace 外のパスをコマンドに含められません: ${candidate}`
          );
        }
      }
      return { behavior: "allow", updatedInput: input };
    }

    const violations: string[] = [];
    walkPathFields(input, (key, value) => {
      if (!resolvedPathWithin(root, value)) {
        violations.push(`${key}: ${value}`);
      }
    });

    if (violations.length > 0) {
      return deny(
        `workspace（${root}）外のパスは使えません: ${violations.join("; ")}`
      );
    }

    return { behavior: "allow", updatedInput: input };
  };
}
