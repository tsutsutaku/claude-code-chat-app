# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

A Next.js chat application (Amplify フロントエンド) + Amazon Bedrock AgentCore バックエンド。
AgentCore 上でエージェント (Claude Agent SDK) が kurewari プロジェクトのワークスペースを分析し、SSE でフロントエンドにストリーミングする。

## Architecture

```
Browser (useAgentChat)
 → POST /api/chat                              (Amplify / Next.js proxy)
 → InvokeAgentRuntime                         (AWS SDK → AgentCore)
 → POST /invocations                          (AgentCore Container: Node.js)
 → @anthropic-ai/claude-agent-sdk query()
 ├── cwd: /tmp/workspace/kurewari
 ├── model: claude-haiku-4-5
 ├── tools: Claude Code preset
 └── canUseTool: validates paths within workspace
 → SSE (UIMessage Stream) → Amplify proxy → Browser
```

## Directory Structure

```
/
├── agent/                       # AgentCore プロジェクト（バックエンド）
│   ├── agentcore/
│   │   ├── agentcore.json       # エージェント定義
│   │   ├── aws-targets.json     # デプロイ先 AWS アカウント・リージョン
│   │   └── .env.local           # ローカル開発用シークレット（gitignored）
│   └── app/ChatAgent/
│       ├── Dockerfile           # Node.js 22 ARM64 コンテナ
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── server.ts        # HTTP server (GET /ping, POST /invocations)
│           ├── claude-session.ts
│           ├── stream-adapter.ts
│           ├── langfuse-instrumentation.ts
│           ├── langfuse-system-prompt.ts
│           ├── workspace-tool-permissions.ts
│           ├── tool-subtitle.ts
│           ├── bash-tool-display.ts
│           └── read-tool-display.ts
├── chat-app/                    # Amplify フロントエンド（Next.js 16）
│   └── src/
│       ├── app/api/chat/route.ts  # AgentCore への薄いプロキシ
│       └── ...
├── amplify.yml                  # Amplify Hosting ビルド定義
└── CLAUDE.md
```

## Development Commands

### AgentCore バックエンド (`agent/app/ChatAgent/`)

```bash
npm install
npm run build        # TypeScript コンパイル
npm start            # サーバー起動 (port 8080)
```

AgentCore CLI でのローカルテスト:

```bash
cd agent
agentcore dev        # ローカル開発サーバー
agentcore dev "質問してみる"   # 別ターミナルから invoke
```

### デプロイ

```bash
cd agent
# aws-targets.json に AWS アカウント ID とリージョンを設定してから:
agentcore deploy -y
# デプロイ後に ARN を確認:
agentcore status
```

### フロントエンド (`chat-app/`)

```bash
npm install
npm run dev         # http://localhost:3000
npm run build
npm run lint
```

## Required Environment Variables

### AgentCore コンテナ（`agent/agentcore/.env.local`）

```
ANTHROPIC_API_KEY   # 必須
LANGFUSE_SECRET_KEY # オプション
LANGFUSE_PUBLIC_KEY # オプション
LANGFUSE_BASE_URL   # オプション
```

### Amplify フロントエンド（Amplify コンソールで設定）

```
AGENTCORE_AGENT_ARN  # デプロイ後に agentcore status で確認（必須）
AWS_REGION           # AgentCore デプロイ先リージョン（必須）
NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY  # オプション
NEXT_PUBLIC_LANGFUSE_BASE_URL    # オプション
NEXT_PUBLIC_USER_ID              # オプション
```

## AgentCore CLI Reference

```bash
npm install -g @aws/agentcore   # インストール
agentcore create                # プロジェクト作成（ウィザード）
agentcore deploy -y             # デプロイ
agentcore status                # ARN・デプロイ状態確認
agentcore invoke "テスト"       # デプロイ済みエージェントを呼ぶ
agentcore logs                  # ログストリーム
```

## Key Files

| File | Role |
|------|------|
| `agent/app/ChatAgent/src/server.ts` | HTTP エントリポイント（/ping, /invocations） |
| `agent/app/ChatAgent/src/claude-session.ts` | Claude Agent SDK オプション・WORKSPACE_PATH |
| `agent/app/ChatAgent/src/stream-adapter.ts` | SDKMessage → UIMessage SSE 変換 |
| `chat-app/src/app/api/chat/route.ts` | Amplify プロキシ（InvokeAgentRuntime） |
| `chat-app/src/lib/use-agent-chat.ts` | クライアント側チャットフック |

## Notes

- AgentCore コンテナは長時間起動する（サーバーレスではない）のでインメモリの `sessionStore` が機能する
- `WORKSPACE_PATH` は `/tmp/workspace` 固定（コンテナの書き込み可能領域）
- Amplify 実行ロールに `bedrock-agentcore:InvokeAgentRuntime` IAM 権限が必要
- ストリーミングレスポンスは AgentCore の SSE → Amplify プロキシ → ブラウザとパイプされる
