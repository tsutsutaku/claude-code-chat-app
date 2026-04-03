# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Next.js チャット（Amplify ホスティング）+ **AWS Lambda（Function URL・レスポンスストリーミング）** 上の Claude Agent SDK。
CloudFormation の `AWS::ApiGatewayV2::Integration` には **`InvokeMode` が無い**ため、長い SSE 用に **Lambda Function URL**（`InvokeMode: RESPONSE_STREAM`）で HTTPS 公開する。Amplify の `/api/chat` は **`fetch(AGENT_API_URL/invocations)` のみ**。

注: API Gateway + Lambda でストリーミングは機能するが、`InvokeMode: RESPONSE_STREAM` は CFN スキーマ未対応のため `deploy.sh` が `sam deploy` 後に `aws apigatewayv2 update-integration` で設定する。

参考: [Amplify と AgentCore のハンズオン（別構成）](https://qiita.com/minorun365/items/11be2c3565923b96ab54)

## Architecture

```
Browser (useAgentChat)
 → POST /api/chat                         (Amplify / Next.js: fetch のみ)
 → POST {AGENT_API_URL}/invocations       (Lambda Function URL → レスポンスストリーミング)
 → @anthropic-ai/claude-agent-sdk query()
 ├── cwd: /tmp/workspace/kurewari
 ├── model: claude-haiku-4-5
 ├── tools: Claude Code preset
 └── canUseTool: validates paths within workspace
 → SSE (UIMessage Stream) → /api/chat → Browser
```

## Directory Structure

```
/
├── agent/
│   ├── sam/
│   │   ├── template.yaml        # SAM: Lambda + API Gateway HTTP API
│   │   └── deploy.sh            # sam deploy + InvokeMode post-deploy CLI 設定
│   └── app/ChatAgent/
│       ├── Makefile             # sam build 用
│       ├── package.json
│       └── src/
│           ├── lambda-handler.ts  # Lambda Function URL + streamifyResponse
│           ├── server.ts          # ローカル HTTP (port 8080)
│           ├── invocation.ts      # /invocations 共通ロジック
│           ├── claude-session.ts
│           └── ...
├── chat-app/
│   └── src/app/api/chat/route.ts  # AGENT_API_URL へ fetch
├── amplify.yml
└── CLAUDE.md
```

## Development Commands

### ChatAgent（`agent/app/ChatAgent/`）

```bash
npm install
npm run build
npm start            # http://localhost:8080  (/ping, /invocations)
```

### SAM デプロイ（`agent/sam/`）

```bash
cd agent/sam
# 初回（guided でパラメータを入力し samconfig.toml に保存）:
sam deploy --guided
# 2 回目以降:
./deploy.sh   # sam build → sam deploy → InvokeMode: RESPONSE_STREAM を CLI で設定
# Outputs の HttpApiUrl が .api-url に保存される → Amplify の AGENT_API_URL に設定
```

### フロントエンド（`chat-app/`）

```bash
npm install
npm run dev         # http://localhost:3000
# .env に AGENTCORE_LOCAL_URL=http://localhost:8080 でローカルエージェントに接続
npm run build
npm run lint
```

## Required Environment Variables

### Lambda（SAM パラメータまたはコンソール）

- `ANTHROPIC_API_KEY`（必須）
- `LANGFUSE_*`（任意）

### Amplify（コンソール → 環境変数）

```
AGENT_API_URL          # 必須: sam deploy の HttpApiUrl（末尾スラッシュなし）
AGENT_API_KEY          # 任意: API Gateway で API キーを付けた場合
NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY   # 任意
NEXT_PUBLIC_LANGFUSE_BASE_URL     # 任意
NEXT_PUBLIC_USER_ID               # 任意
AGENTCORE_LOCAL_URL               # 任意: ローカル開発時のみ（本番では未設定）
```

## Key Files

| File | Role |
|------|------|
| `agent/app/ChatAgent/src/invocation.ts` | Claude query + UIMessage SSE 生成 |
| `agent/app/ChatAgent/src/lambda-handler.ts` | HTTP API v2 形式イベント + レスポンスストリーミング |
| `agent/sam/template.yaml` | Lambda + Function URL |
| `chat-app/src/app/api/chat/route.ts` | `fetch(AGENT_API_URL/invocations)` プロキシ |

## Notes

- Lambda の `/tmp` にワークスペースを展開する場合はデプロイ手順でバンドルするか、起動時に取得する必要がある（現状のサンプルは空の workspace 前提）。
- 同一 Lambda インスタンス内では `invocation.ts` の `sessionStore` が有効。コールドスタートや別インスタンスではセッションは引き継がれない場合がある。
- Amplify 側に **Bedrock / InvokeAgentRuntime の IAM は不要**（サーバーは公開 HTTP の API Gateway を fetch するだけ）。
