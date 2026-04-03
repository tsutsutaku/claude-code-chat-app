import path from "path";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { createWorkspaceCanUseTool } from "@/lib/workspace-tool-permissions";

/**
 * リポジトリ直下の `workspace` をエージェントの cwd にする。
 * - `WORKSPACE_PATH` 環境変数が設定されている場合はその値を使用（Amplify 等デプロイ環境向け）
 * - `chat-app` で `next dev` する場合: 親の `workspace`
 * - リポジトリルートで起動する場合: その直下の `workspace`
 */
function resolveWorkspacePath(): string {
  if (process.env.WORKSPACE_PATH) {
    return path.resolve(process.env.WORKSPACE_PATH);
  }
  const cwd = process.cwd();
  if (path.basename(cwd) === "chat-app") {
    return path.resolve(cwd, "..", "workspace");
  }
  return path.resolve(cwd, "workspace");
}

export const WORKSPACE_PATH = resolveWorkspacePath();

export const MODEL = "claude-haiku-4-5";

/** Langfuse 未設定・取得失敗時のフォールバック（開発者モード） */
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

/** Langfuse 未設定・取得失敗時のフォールバック（ビジネスモード） */
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

/** V1 `query()` 用の共通オプション（cwd / model、任意で resume・中断） */
export function agentQueryOptions(params: {
  resume?: string;
  abortController?: AbortController;
  /** Langfuse から解決したシステムプロンプト（必須） */
  systemPrompt: string;
}): Options {
  return {
    cwd: WORKSPACE_PATH,
    model: MODEL,
    systemPrompt: params.systemPrompt,
    /** cwd 以外のディレクトリを追加で許可しない（SDK の追加探索先を空に） */
    additionalDirectories: [],
    /** ツール引数のパスが workspace 内か検証（systemPrompt より優先して強制） */
    canUseTool: createWorkspaceCanUseTool(WORKSPACE_PATH),
    /**
     * Claude Code 既定の組み込みツール（Grep / Read / Glob など）を有効化。
     * 未指定だと Grep などが使えない場合がある。
     */
    tools: { type: "preset", preset: "claude_code" },
    /**
     * チャット API 経由でユーザー承認がないため自動許可。
     * 実際の可否は canUseTool で workspace 内に限定する。
     */
    allowedTools: [
      "Grep",
      "Read",
      "Glob",
      "Bash",
      "Edit",
      "Write",
      "NotebookEdit",
    ],
    /** テキスト・ツール呼び出しのストリームイベントを受け取る */
    includePartialMessages: true,
    ...(params.resume ? { resume: params.resume } : {}),
    ...(params.abortController
      ? { abortController: params.abortController }
      : {}),
  };
}
