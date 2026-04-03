import path from "path";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { createWorkspaceCanUseTool } from "./workspace-tool-permissions.js";

/**
 * AgentCore コンテナ環境では /tmp のみ書き込み可能。
 * workspace は /tmp/workspace に固定。
 */
export const WORKSPACE_PATH = process.env.WORKSPACE_PATH
  ? path.resolve(process.env.WORKSPACE_PATH)
  : "/tmp/workspace";

export const MODEL = "claude-haiku-4-5";

function resolvePathToClaudeCodeExecutable(): string {
  const fromEnv = process.env.CLAUDE_CODE_CLI_PATH?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const cwd = process.cwd();
  return path.resolve(
    path.join(cwd, "node_modules", "@anthropic-ai", "claude-agent-sdk", "cli.js")
  );
}

/**
 * Claude Code プロセスに渡す環境変数。
 * コンテナでは HOME 下への書き込みが失敗するため /tmp を明示する。
 */
function claudeCodeProcessEnv(): NonNullable<Options["env"]> {
  const home = process.env.CLAUDE_SERVERLESS_HOME?.trim() || "/tmp";
  return {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: `${home}/.config`,
    XDG_DATA_HOME: `${home}/.local/share`,
    XDG_CACHE_HOME: `${home}/.cache`,
    TMPDIR: home,
  };
}

export const FALLBACK_DEVELOPER_SYSTEM_PROMPT = [
  "【役割】",
  "あなたのタスクは、kurewari ディレクトリに関する仕様について回答することだけです。",
  "kurewari や workspace の仕様・中身と無関係な質問には、丁寧に断り、一切回答しないでください。",
  "kurewariディレクトリは./kurewariにあります",
  "ユーザーの質問はその前提がなくても、kurewariディレクトリに関する質問であると考えてください。",
  "workspace, kurewariはディレクトリなので、readは実行しないでください。",
  "【分析方針】",
  "ファイルを積極的に読み込み、コードや設計を深く分析してください。",
  "正確な回答のために必要なだけツールを使って調査してください。",
  "【回答スタイル】",
  "技術的な詳細（コード・スキーマ・SQLクエリ・実装の仕組みなど）を積極的に提示して構いません。",
].join("\n");

export const FALLBACK_BUSINESS_SYSTEM_PROMPT = [
  "【役割】",
  "あなたのタスクは、kurewari ディレクトリに関する仕様について回答することだけです。",
  "kurewari や workspace の仕様・中身と無関係な質問には、丁寧に断り、一切回答しないでください。",
  "kurewariディレクトリは./kurewariにあります",
  "ユーザーの質問はその前提がなくても、kurewariディレクトリに関する質問であると考えてください。",
  "workspace, kurewariはディレクトリなので、readは実行しないでください。",
  "【分析方針】",
  "ファイルを積極的に読み込み、コードや設計を深く分析してください。",
  "正確な回答のために必要なだけツールを使って調査してください。",
  "【回答スタイル - 重要】",
  "このシステムはビジネス担当者向けです。調査・分析は十分に行った上で、以下のルールで回答してください。",
  "- コードや SQL、スキーマ定義などの技術的な記述は回答に含めないでください。",
  "- 専門用語を避け、誰でも理解できる平易な日本語で説明してください。",
  "- 「何ができるか」「どういう仕組みか」を概念・業務フローのレベルで説明してください。",
  "- 技術的な質問をされた場合も、業務上の意味や目的に言い換えて回答してください。",
].join("\n");

export function agentQueryOptions(params: {
  resume?: string;
  abortController?: AbortController;
  systemPrompt: string;
}): Options {
  return {
    cwd: WORKSPACE_PATH,
    model: MODEL,
    systemPrompt: params.systemPrompt,
    pathToClaudeCodeExecutable: resolvePathToClaudeCodeExecutable(),
    additionalDirectories: [],
    canUseTool: createWorkspaceCanUseTool(WORKSPACE_PATH),
    tools: { type: "preset", preset: "claude_code" },
    allowedTools: [
      "Grep",
      "Read",
      "Glob",
      "Bash",
      "Edit",
      "Write",
      "NotebookEdit",
    ],
    includePartialMessages: true,
    persistSession: false,
    env: claudeCodeProcessEnv(),
    ...(params.resume ? { resume: params.resume } : {}),
    ...(params.abortController
      ? { abortController: params.abortController }
      : {}),
  };
}
