# claude-code-chat-app

[Claude Agent SDK](https://docs.anthropic.com/en/docs/claude-code/sdk) を使ったチャット UI（Next.js）です。エージェントはリポジトリ外の **`workspace/` ディレクトリ**を作業ディレクトリとして参照します（Git には含めません）。

## 構成

| パス | 説明 |
|------|------|
| `chat-app/` | Next.js 16 アプリ（App Router） |
| `workspace/` | エージェントの cwd（`.gitignore` で除外） |
| `.agents/` など | エージェント用スキル・設定 |

## 前提

- Node.js 20 以上推奨
- Anthropic API（Claude Agent SDK 用）
- （任意）[Langfuse](https://langfuse.com) でトレース・プロンプト管理・ユーザー評価

## セットアップ

```bash
cd chat-app
npm install
```

`chat-app/.env` を用意します（`.env*` は Git に含まれません）。

| 変数 | 必須 | 説明 |
|------|------|------|
| `ANTHROPIC_API_KEY` | はい | Claude Agent SDK 用 |
| `LANGFUSE_SECRET_KEY` / `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_BASE_URL` | いいえ | サーバー側トレース・プロンプト取得 |
| `NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY` / `NEXT_PUBLIC_LANGFUSE_BASE_URL` | いいえ | ブラウザからフィードバック（スコア）送信 |
| `NEXT_PUBLIC_USER_ID` | いいえ | Langfuse の `userId`（開発用など） |

開発サーバー:

```bash
cd chat-app
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## Langfuse（任意）

- システムプロンプトは Langfuse のテキストプロンプト（`production` ラベル）から取得可能。初回はシード用スクリプトで登録できます。

```bash
cd chat-app
npm run langfuse:seed-prompts
```

- オフラインでコード内フォールバックのみ使う場合: `LANGFUSE_SYSTEM_PROMPT_SOURCE=local`

## ビルド

```bash
cd chat-app
npm run build
npm run start
```

## リポジトリ

https://github.com/tsutsutaku/claude-code-chat-app

## ライセンス

未設定（必要に応じて追加してください）。
