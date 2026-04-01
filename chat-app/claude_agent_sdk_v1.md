# Agent SDKリファレンス - TypeScript

TypeScript Agent SDKの完全なAPIリファレンス。すべての関数、型、インターフェースを含みます。

---

<script src="/components/typescript-sdk-type-links.js" defer />

<Note>
**新しいV2インターフェース（プレビュー）をお試しください：** `send()` と `receive()` パターンを備えた簡素化されたインターフェースが利用可能になり、マルチターン会話がより簡単になりました。[TypeScript V2プレビューの詳細](/docs/ja/agent-sdk/typescript-v2-preview)
</Note>

## インストール

```bash
npm install @anthropic-ai/claude-agent-sdk
```

## 関数

### `query()`

Claude Codeとやり取りするための主要な関数です。メッセージが到着するたびにストリーミングする非同期ジェネレーターを作成します。

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query
```

#### パラメーター

| パラメーター | 型 | 説明 |
| :-------- | :--- | :---------- |
| `prompt` | `string \| AsyncIterable<`[`SDKUserMessage`](#sdkusermessage)`>` | 文字列としての入力プロンプト、またはストリーミングモード用の非同期イテラブル |
| `options` | [`Options`](#options) | オプションの設定オブジェクト（以下のOptions型を参照） |

#### 戻り値

追加メソッドを持つ `AsyncGenerator<`[`SDKMessage`](#sdkmessage)`, void>` を拡張した [`Query`](#query-1) オブジェクトを返します。

### `tool()`

SDK MCPサーバーで使用するための型安全なMCPツール定義を作成します。

```typescript
function tool<Schema extends ZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: z.infer<ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>
): SdkMcpToolDefinition<Schema>
```

#### パラメーター

| パラメーター | 型 | 説明 |
| :-------- | :--- | :---------- |
| `name` | `string` | ツールの名前 |
| `description` | `string` | ツールの機能の説明 |
| `inputSchema` | `Schema extends ZodRawShape` | ツールの入力パラメーターを定義するZodスキーマ |
| `handler` | `(args, extra) => Promise<`[`CallToolResult`](#calltoolresult)`>` | ツールのロジックを実行する非同期関数 |

### `createSdkMcpServer()`

アプリケーションと同じプロセスで実行されるMCPサーバーインスタンスを作成します。

```typescript
function createSdkMcpServer(options: {
  name: string;
  version?: string;
  tools?: Array<SdkMcpToolDefinition<any>>;
}): McpSdkServerConfigWithInstance
```

#### パラメーター

| パラメーター | 型 | 説明 |
| :-------- | :--- | :---------- |
| `options.name` | `string` | MCPサーバーの名前 |
| `options.version` | `string` | オプションのバージョン文字列 |
| `options.tools` | `Array<SdkMcpToolDefinition>` | [`tool()`](#tool) で作成されたツール定義の配列 |

## 型

### `Options`

`query()` 関数の設定オブジェクト。

| プロパティ | 型 | デフォルト | 説明 |
| :------- | :--- | :------ | :---------- |
| `abortController` | `AbortController` | `new AbortController()` | 操作をキャンセルするためのコントローラー |
| `additionalDirectories` | `string[]` | `[]` | Claudeがアクセスできる追加ディレクトリ |
| `agents` | `Record<string, [`AgentDefinition`](#agentdefinition)>` | `undefined` | プログラムでサブエージェントを定義 |
| `allowDangerouslySkipPermissions` | `boolean` | `false` | パーミッションのバイパスを有効にする。`permissionMode: 'bypassPermissions'` 使用時に必須 |
| `allowedTools` | `string[]` | 全ツール | 許可されたツール名のリスト |
| `betas` | [`SdkBeta`](#sdkbeta)`[]` | `[]` | ベータ機能を有効にする（例：`['context-1m-2025-08-07']`） |
| `canUseTool` | [`CanUseTool`](#canusetool) | `undefined` | ツール使用のカスタムパーミッション関数 |
| `continue` | `boolean` | `false` | 最新の会話を続行 |
| `cwd` | `string` | `process.cwd()` | 現在の作業ディレクトリ |
| `disallowedTools` | `string[]` | `[]` | 禁止されたツール名のリスト |
| `enableFileCheckpointing` | `boolean` | `false` | 巻き戻し用のファイル変更追跡を有効にする。[ファイルチェックポイント](/docs/ja/agent-sdk/file-checkpointing)を参照 |
| `env` | `Dict<string>` | `process.env` | 環境変数 |
| `executable` | `'bun' \| 'deno' \| 'node'` | 自動検出 | 使用するJavaScriptランタイム |
| `executableArgs` | `string[]` | `[]` | 実行ファイルに渡す引数 |
| `extraArgs` | `Record<string, string \| null>` | `{}` | 追加の引数 |
| `fallbackModel` | `string` | `undefined` | プライマリが失敗した場合に使用するモデル |
| `forkSession` | `boolean` | `false` | `resume` で再開する際、元のセッションを続行する代わりに新しいセッションIDにフォークする |
| `hooks` | `Partial<Record<`[`HookEvent`](#hookevent)`, `[`HookCallbackMatcher`](#hookcallbackmatcher)`[]>>` | `{}` | イベント用のフックコールバック |
| `includePartialMessages` | `boolean` | `false` | 部分メッセージイベントを含める |
| `maxBudgetUsd` | `number` | `undefined` | クエリの最大予算（USD） |
| `maxThinkingTokens` | `number` | `undefined` | 思考プロセスの最大トークン数 |
| `maxTurns` | `number` | `undefined` | 最大会話ターン数 |
| `mcpServers` | `Record<string, [`McpServerConfig`](#mcpserverconfig)>` | `{}` | MCPサーバーの設定 |
| `model` | `string` | CLIのデフォルト | 使用するClaudeモデル |
| `outputFormat` | `{ type: 'json_schema', schema: JSONSchema }` | `undefined` | エージェント結果の出力フォーマットを定義。詳細は[構造化出力](/docs/ja/agent-sdk/structured-outputs)を参照 |
| `pathToClaudeCodeExecutable` | `string` | 組み込み実行ファイルを使用 | Claude Code実行ファイルへのパス |
| `permissionMode` | [`PermissionMode`](#permissionmode) | `'default'` | セッションのパーミッションモード |
| `permissionPromptToolName` | `string` | `undefined` | パーミッションプロンプト用のMCPツール名 |
| `plugins` | [`SdkPluginConfig`](#sdkpluginconfig)`[]` | `[]` | ローカルパスからカスタムプラグインを読み込む。詳細は[プラグイン](/docs/ja/agent-sdk/plugins)を参照 |
| `resume` | `string` | `undefined` | 再開するセッションID |
| `resumeSessionAt` | `string` | `undefined` | 特定のメッセージUUIDでセッションを再開 |
| `sandbox` | [`SandboxSettings`](#sandboxsettings) | `undefined` | サンドボックスの動作をプログラムで設定。詳細は[サンドボックス設定](#sandboxsettings)を参照 |
| `settingSources` | [`SettingSource`](#settingsource)`[]` | `[]`（設定なし） | 読み込むファイルシステム設定を制御。省略時は設定は読み込まれません。**注意：** CLAUDE.mdファイルを読み込むには `'project'` を含める必要があります |
| `stderr` | `(data: string) => void` | `undefined` | stderr出力のコールバック |
| `strictMcpConfig` | `boolean` | `false` | 厳密なMCPバリデーションを強制 |
| `systemPrompt` | `string \| { type: 'preset'; preset: 'claude_code'; append?: string }` | `undefined`（最小限のプロンプト） | システムプロンプトの設定。カスタムプロンプトには文字列を渡すか、Claude Codeのシステムプロンプトを使用するには `{ type: 'preset', preset: 'claude_code' }` を使用。プリセットオブジェクト形式を使用する場合、`append` を追加して追加の指示でシステムプロンプトを拡張可能 |
| `tools` | `string[] \| { type: 'preset'; preset: 'claude_code' }` | `undefined` | ツールの設定。ツール名の配列を渡すか、プリセットを使用してClaude Codeのデフォルトツールを取得 |

### `Query`

`query()` 関数が返すインターフェース。

```typescript
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  rewindFiles(userMessageUuid: string): Promise<void>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
  supportedCommands(): Promise<SlashCommand[]>;
  supportedModels(): Promise<ModelInfo[]>;
  mcpServerStatus(): Promise<McpServerStatus[]>;
  accountInfo(): Promise<AccountInfo>;
}
```

#### メソッド

| メソッド | 説明 |
| :----- | :---------- |
| `interrupt()` | クエリを中断する（ストリーミング入力モードでのみ利用可能） |
| `rewindFiles(userMessageUuid)` | 指定されたユーザーメッセージ時点の状態にファイルを復元する。`enableFileCheckpointing: true` が必要。[ファイルチェックポイント](/docs/ja/agent-sdk/file-checkpointing)を参照 |
| `setPermissionMode()` | パーミッションモードを変更する（ストリーミング入力モードでのみ利用可能） |
| `setModel()` | モデルを変更する（ストリーミング入力モードでのみ利用可能） |
| `setMaxThinkingTokens()` | 最大思考トークン数を変更する（ストリーミング入力モードでのみ利用可能） |
| `supportedCommands()` | 利用可能なスラッシュコマンドを返す |
| `supportedModels()` | 表示情報付きの利用可能なモデルを返す |
| `mcpServerStatus()` | 接続されたMCPサーバーのステータスを返す |
| `accountInfo()` | アカウント情報を返す |

### `AgentDefinition`

プログラムで定義されるサブエージェントの設定。

```typescript
type AgentDefinition = {
  description: string;
  tools?: string[];
  prompt: string;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
}
```

| フィールド | 必須 | 説明 |
|:------|:---------|:------------|
| `description` | はい | このエージェントをいつ使用するかの自然言語による説明 |
| `tools` | いいえ | 許可されたツール名の配列。省略時はすべてのツールを継承 |
| `prompt` | はい | エージェントのシステムプロンプト |
| `model` | いいえ | このエージェントのモデルオーバーライド。省略時はメインモデルを使用 |

### `SettingSource`

SDKが設定を読み込むファイルシステムベースの設定ソースを制御します。

```typescript
type SettingSource = 'user' | 'project' | 'local';
```

| 値 | 説明 | 場所 |
|:------|:------------|:---------|
| `'user'` | グローバルユーザー設定 | `~/.claude/settings.json` |
| `'project'` | 共有プロジェクト設定（バージョン管理対象） | `.claude/settings.json` |
| `'local'` | ローカルプロジェクト設定（gitignore対象） | `.claude/settings.local.json` |

#### デフォルトの動作

`settingSources` が**省略**または**undefined**の場合、SDKはファイルシステム設定を**読み込みません**。これによりSDKアプリケーションの分離が提供されます。

#### settingSourcesを使用する理由

**すべてのファイルシステム設定を読み込む（レガシー動作）：**
```typescript
// SDK v0.0.xと同様にすべての設定を読み込む
const result = query({
  prompt: "Analyze this code",
  options: {
    settingSources: ['user', 'project', 'local']  // すべての設定を読み込む
  }
});
```

**特定の設定ソースのみを読み込む：**
```typescript
// プロジェクト設定のみを読み込み、ユーザーとローカルは無視
const result = query({
  prompt: "Run CI checks",
  options: {
    settingSources: ['project']  // .claude/settings.jsonのみ
  }
});
```

**テストおよびCI環境：**
```typescript
// ローカル設定を除外してCIでの一貫した動作を確保
const result = query({
  prompt: "Run tests",
  options: {
    settingSources: ['project'],  // チーム共有設定のみ
    permissionMode: 'bypassPermissions'
  }
});
```

**SDK専用アプリケーション：**
```typescript
// すべてをプログラムで定義（デフォルトの動作）
// ファイルシステム依存なし - settingSourcesのデフォルトは[]
const result = query({
  prompt: "Review this PR",
  options: {
    // settingSources: [] がデフォルト、指定不要
    agents: { /* ... */ },
    mcpServers: { /* ... */ },
    allowedTools: ['Read', 'Grep', 'Glob']
  }
});
```

**CLAUDE.mdプロジェクト指示の読み込み：**
```typescript
// CLAUDE.mdファイルを含めるためにプロジェクト設定を読み込む
const result = query({
  prompt: "Add a new feature following project conventions",
  options: {
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code'  // CLAUDE.mdを使用するために必須
    },
    settingSources: ['project'],  // プロジェクトディレクトリからCLAUDE.mdを読み込む
    allowedTools: ['Read', 'Write', 'Edit']
  }
});
```

#### 設定の優先順位

複数のソースが読み込まれた場合、設定は以下の優先順位（高い順）でマージされます：
1. ローカル設定（`.claude/settings.local.json`）
2. プロジェクト設定（`.claude/settings.json`）
3. ユーザー設定（`~/.claude/settings.json`）

プログラムオプション（`agents`、`allowedTools` など）は常にファイルシステム設定をオーバーライドします。

### `PermissionMode`

```typescript
type PermissionMode =
  | 'default'           // 標準のパーミッション動作
  | 'acceptEdits'       // ファイル編集を自動承認
  | 'bypassPermissions' // すべてのパーミッションチェックをバイパス
  | 'plan'              // 計画モード - 実行なし
```

### `CanUseTool`

ツール使用を制御するためのカスタムパーミッション関数型。

```typescript
type CanUseTool = (
  toolName: string,
  input: ToolInput,
  options: {
    signal: AbortSignal;
    suggestions?: PermissionUpdate[];
  }
) => Promise<PermissionResult>;
```

### `PermissionResult`

パーミッションチェックの結果。

```typescript
type PermissionResult = 
  | {
      behavior: 'allow';
      updatedInput: ToolInput;
      updatedPermissions?: PermissionUpdate[];
    }
  | {
      behavior: 'deny';
      message: string;
      interrupt?: boolean;
    }
```

### `McpServerConfig`

MCPサーバーの設定。

```typescript
type McpServerConfig = 
  | McpStdioServerConfig
  | McpSSEServerConfig
  | McpHttpServerConfig
  | McpSdkServerConfigWithInstance;
```

#### `McpStdioServerConfig`

```typescript
type McpStdioServerConfig = {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}
```

#### `McpSSEServerConfig`

```typescript
type McpSSEServerConfig = {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}
```

#### `McpHttpServerConfig`

```typescript
type McpHttpServerConfig = {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}
```

#### `McpSdkServerConfigWithInstance`

```typescript
type McpSdkServerConfigWithInstance = {
  type: 'sdk';
  name: string;
  instance: McpServer;
}
```

### `SdkPluginConfig`

SDKでプラグインを読み込むための設定。

```typescript
type SdkPluginConfig = {
  type: 'local';
  path: string;
}
```

| フィールド | 型 | 説明 |
|:------|:-----|:------------|
| `type` | `'local'` | `'local'` でなければならない（現在ローカルプラグインのみサポート） |
| `path` | `string` | プラグインディレクトリへの絶対パスまたは相対パス |

**例：**
```typescript
plugins: [
  { type: 'local', path: './my-plugin' },
  { type: 'local', path: '/absolute/path/to/plugin' }
]
```

プラグインの作成と使用に関する完全な情報は、[プラグイン](/docs/ja/agent-sdk/plugins)を参照してください。

## メッセージ型

### `SDKMessage`

クエリが返すすべての可能なメッセージのユニオン型。

```typescript
type SDKMessage = 
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKUserMessageReplay
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | SDKCompactBoundaryMessage;
```

### `SDKAssistantMessage`

アシスタントの応答メッセージ。

```typescript
type SDKAssistantMessage = {
  type: 'assistant';
  uuid: UUID;
  session_id: string;
  message: APIAssistantMessage; // Anthropic SDKから
  parent_tool_use_id: string | null;
}
```

### `SDKUserMessage`

ユーザー入力メッセージ。

```typescript
type SDKUserMessage = {
  type: 'user';
  uuid?: UUID;
  session_id: string;
  message: APIUserMessage; // Anthropic SDKから
  parent_tool_use_id: string | null;
}
```

### `SDKUserMessageReplay`

必須UUIDを持つリプレイされたユーザーメッセージ。

```typescript
type SDKUserMessageReplay = {
  type: 'user';
  uuid: UUID;
  session_id: string;
  message: APIUserMessage;
  parent_tool_use_id: string | null;
}
```

### `SDKResultMessage`

最終結果メッセージ。

```typescript
type SDKResultMessage =
  | {
      type: 'result';
      subtype: 'success';
      uuid: UUID;
      session_id: string;
      duration_ms: number;
      duration_api_ms: number;
      is_error: boolean;
      num_turns: number;
      result: string;
      total_cost_usd: number;
      usage: NonNullableUsage;
      modelUsage: { [modelName: string]: ModelUsage };
      permission_denials: SDKPermissionDenial[];
      structured_output?: unknown;
    }
  | {
      type: 'result';
      subtype:
        | 'error_max_turns'
        | 'error_during_execution'
        | 'error_max_budget_usd'
        | 'error_max_structured_output_retries';
      uuid: UUID;
      session_id: string;
      duration_ms: number;
      duration_api_ms: number;
      is_error: boolean;
      num_turns: number;
      total_cost_usd: number;
      usage: NonNullableUsage;
      modelUsage: { [modelName: string]: ModelUsage };
      permission_denials: SDKPermissionDenial[];
      errors: string[];
    }
```

### `SDKSystemMessage`

システム初期化メッセージ。

```typescript
type SDKSystemMessage = {
  type: 'system';
  subtype: 'init';
  uuid: UUID;
  session_id: string;
  apiKeySource: ApiKeySource;
  cwd: string;
  tools: string[];
  mcp_servers: {
    name: string;
    status: string;
  }[];
  model: string;
  permissionMode: PermissionMode;
  slash_commands: string[];
  output_style: string;
}
```

### `SDKPartialAssistantMessage`

ストリーミング部分メッセージ（`includePartialMessages` がtrueの場合のみ）。

```typescript
type SDKPartialAssistantMessage = {
  type: 'stream_event';
  event: RawMessageStreamEvent; // Anthropic SDKから
  parent_tool_use_id: string | null;
  uuid: UUID;
  session_id: string;
}
```

### `SDKCompactBoundaryMessage`

会話コンパクション境界を示すメッセージ。

```typescript
type SDKCompactBoundaryMessage = {
  type: 'system';
  subtype: 'compact_boundary';
  uuid: UUID;
  session_id: string;
  compact_metadata: {
    trigger: 'manual' | 'auto';
    pre_tokens: number;
  };
}
```

### `SDKPermissionDenial`

拒否されたツール使用に関する情報。

```typescript
type SDKPermissionDenial = {
  tool_name: string;
  tool_use_id: string;
  tool_input: ToolInput;
}
```

## フック型

フックの使用方法、例、一般的なパターンに関する包括的なガイドは、[フックガイド](/docs/ja/agent-sdk/hooks)を参照してください。

### `HookEvent`

利用可能なフックイベント。

```typescript
type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'Notification'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'Stop'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'PreCompact'
  | 'PermissionRequest';
```

### `HookCallback`

フックコールバック関数型。

```typescript
type HookCallback = (
  input: HookInput, // すべてのフック入力型のユニオン
  toolUseID: string | undefined,
  options: { signal: AbortSignal }
) => Promise<HookJSONOutput>;
```

### `HookCallbackMatcher`

オプションのマッチャーを持つフック設定。

```typescript
interface HookCallbackMatcher {
  matcher?: string;
  hooks: HookCallback[];
}
```

### `HookInput`

すべてのフック入力型のユニオン型。

```typescript
type HookInput =
  | PreToolUseHookInput
  | PostToolUseHookInput
  | PostToolUseFailureHookInput
  | NotificationHookInput
  | UserPromptSubmitHookInput
  | SessionStartHookInput
  | SessionEndHookInput
  | StopHookInput
  | SubagentStartHookInput
  | SubagentStopHookInput
  | PreCompactHookInput
  | PermissionRequestHookInput;
```

### `BaseHookInput`

すべてのフック入力型が拡張するベースインターフェース。

```typescript
type BaseHookInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
}
```

#### `PreToolUseHookInput`

```typescript
type PreToolUseHookInput = BaseHookInput & {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: unknown;
}
```

#### `PostToolUseHookInput`

```typescript
type PostToolUseHookInput = BaseHookInput & {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
}
```

#### `PostToolUseFailureHookInput`

```typescript
type PostToolUseFailureHookInput = BaseHookInput & {
  hook_event_name: 'PostToolUseFailure';
  tool_name: string;
  tool_input: unknown;
  error: string;
  is_interrupt?: boolean;
}
```

#### `NotificationHookInput`

```typescript
type NotificationHookInput = BaseHookInput & {
  hook_event_name: 'Notification';
  message: string;
  title?: string;
}
```

#### `UserPromptSubmitHookInput`

```typescript
type UserPromptSubmitHookInput = BaseHookInput & {
  hook_event_name: 'UserPromptSubmit';
  prompt: string;
}
```

#### `SessionStartHookInput`

```typescript
type SessionStartHookInput = BaseHookInput & {
  hook_event_name: 'SessionStart';
  source: 'startup' | 'resume' | 'clear' | 'compact';
}
```

#### `SessionEndHookInput`

```typescript
type SessionEndHookInput = BaseHookInput & {
  hook_event_name: 'SessionEnd';
  reason: ExitReason;  // EXIT_REASONS配列からの文字列
}
```

#### `StopHookInput`

```typescript
type StopHookInput = BaseHookInput & {
  hook_event_name: 'Stop';
  stop_hook_active: boolean;
}
```

#### `SubagentStartHookInput`

```typescript
type SubagentStartHookInput = BaseHookInput & {
  hook_event_name: 'SubagentStart';
  agent_id: string;
  agent_type: string;
}
```

#### `SubagentStopHookInput`

```typescript
type SubagentStopHookInput = BaseHookInput & {
  hook_event_name: 'SubagentStop';
  stop_hook_active: boolean;
}
```

#### `PreCompactHookInput`

```typescript
type PreCompactHookInput = BaseHookInput & {
  hook_event_name: 'PreCompact';
  trigger: 'manual' | 'auto';
  custom_instructions: string | null;
}
```

#### `PermissionRequestHookInput`

```typescript
type PermissionRequestHookInput = BaseHookInput & {
  hook_event_name: 'PermissionRequest';
  tool_name: string;
  tool_input: unknown;
  permission_suggestions?: PermissionUpdate[];
}
```

### `HookJSONOutput`

フックの戻り値。

```typescript
type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput;
```

#### `AsyncHookJSONOutput`

```typescript
type AsyncHookJSONOutput = {
  async: true;
  asyncTimeout?: number;
}
```

#### `SyncHookJSONOutput`

```typescript
type SyncHookJSONOutput = {
  continue?: boolean;
  suppressOutput?: boolean;
  stopReason?: string;
  decision?: 'approve' | 'block';
  systemMessage?: string;
  reason?: string;
  hookSpecificOutput?:
    | {
        hookEventName: 'PreToolUse';
        permissionDecision?: 'allow' | 'deny' | 'ask';
        permissionDecisionReason?: string;
        updatedInput?: Record<string, unknown>;
      }
    | {
        hookEventName: 'UserPromptSubmit';
        additionalContext?: string;
      }
    | {
        hookEventName: 'SessionStart';
        additionalContext?: string;
      }
    | {
        hookEventName: 'PostToolUse';
        additionalContext?: string;
      };
}
```

## ツール入力型

すべての組み込みClaude Codeツールの入力スキーマのドキュメント。これらの型は `@anthropic-ai/claude-agent-sdk` からエクスポートされ、型安全なツールインタラクションに使用できます。

### `ToolInput`

**注意：** これは明確さのためのドキュメント専用の型です。すべてのツール入力型のユニオンを表します。

```typescript
type ToolInput =
  | AgentInput
  | AskUserQuestionInput
  | BashInput
  | BashOutputInput
  | FileEditInput
  | FileReadInput
  | FileWriteInput
  | GlobInput
  | GrepInput
  | KillShellInput
  | NotebookEditInput
  | WebFetchInput
  | WebSearchInput
  | TodoWriteInput
  | ExitPlanModeInput
  | ListMcpResourcesInput
  | ReadMcpResourceInput;
```

### Task

**ツール名：** `Task`

```typescript
interface AgentInput {
  /**
   * タスクの短い（3〜5語の）説明
   */
  description: string;
  /**
   * エージェントが実行するタスク
   */
  prompt: string;
  /**
   * このタスクに使用する特殊エージェントのタイプ
   */
  subagent_type: string;
}
```

複雑なマルチステップタスクを自律的に処理する新しいエージェントを起動します。

### AskUserQuestion

**ツール名：** `AskUserQuestion`

```typescript
interface AskUserQuestionInput {
  /**
   * ユーザーに尋ねる質問（1〜4問）
   */
  questions: Array<{
    /**
     * ユーザーに尋ねる完全な質問。明確で具体的であり、
     * 疑問符で終わる必要があります。
     */
    question: string;
    /**
     * チップ/タグとして表示される非常に短いラベル（最大12文字）。
     * 例："Auth method"、"Library"、"Approach"
     */
    header: string;
    /**
     * 利用可能な選択肢（2〜4オプション）。「その他」オプションは
     * 自動的に提供されます。
     */
    options: Array<{
      /**
       * このオプションの表示テキスト（1〜5語）
       */
      label: string;
      /**
       * このオプションの意味の説明
       */
      description: string;
    }>;
    /**
     * 複数選択を許可する場合はtrueに設定
     */
    multiSelect: boolean;
  }>;
  /**
   * パーミッションシステムによって入力されるユーザーの回答。
   * 質問テキストを選択されたオプションラベルにマッピング。
   * 複数選択の回答はカンマ区切り。
   */
  answers?: Record<string, string>;
}
```

実行中にユーザーに明確化の質問をします。使用方法の詳細は[承認とユーザー入力の処理](/docs/ja/agent-sdk/user-input#handle-clarifying-questions)を参照してください。

### Bash

**ツール名：** `Bash`

```typescript
interface BashInput {
  /**
   * 実行するコマンド
   */
  command: string;
  /**
   * オプションのタイムアウト（ミリ秒、最大600000）
   */
  timeout?: number;
  /**
   * このコマンドが何をするかの明確で簡潔な説明（5〜10語）
   */
  description?: string;
  /**
   * このコマンドをバックグラウンドで実行する場合はtrueに設定
   */
  run_in_background?: boolean;
}
```

オプションのタイムアウトとバックグラウンド実行を備えた永続的なシェルセッションでbashコマンドを実行します。

### BashOutput

**ツール名：** `BashOutput`

```typescript
interface BashOutputInput {
  /**
   * 出力を取得するバックグラウンドシェルのID
   */
  bash_id: string;
  /**
   * 出力行をフィルタリングするオプションの正規表現
   */
  filter?: string;
}
```

実行中または完了したバックグラウンドbashシェルから出力を取得します。

### Edit

**ツール名：** `Edit`

```typescript
interface FileEditInput {
  /**
   * 変更するファイルの絶対パス
   */
  file_path: string;
  /**
   * 置換するテキスト
   */
  old_string: string;
  /**
   * 置換後のテキスト（old_stringと異なる必要があります）
   */
  new_string: string;
  /**
   * old_stringのすべての出現を置換（デフォルトfalse）
   */
  replace_all?: boolean;
}
```

ファイル内で正確な文字列置換を実行します。

### Read

**ツール名：** `Read`

```typescript
interface FileReadInput {
  /**
   * 読み取るファイルの絶対パス
   */
  file_path: string;
  /**
   * 読み取りを開始する行番号
   */
  offset?: number;
  /**
   * 読み取る行数
   */
  limit?: number;
}
```

テキスト、画像、PDF、Jupyterノートブックを含むローカルファイルシステムからファイルを読み取ります。

### Write

**ツール名：** `Write`

```typescript
interface FileWriteInput {
  /**
   * 書き込むファイルの絶対パス
   */
  file_path: string;
  /**
   * ファイルに書き込む内容
   */
  content: string;
}
```

ローカルファイルシステムにファイルを書き込みます。既存の場合は上書きします。

### Glob

**ツール名：** `Glob`

```typescript
interface GlobInput {
  /**
   * ファイルとマッチさせるglobパターン
   */
  pattern: string;
  /**
   * 検索するディレクトリ（デフォルトはcwd）
   */
  path?: string;
}
```

あらゆるサイズのコードベースで動作する高速なファイルパターンマッチング。

### Grep

**ツール名：** `Grep`

```typescript
interface GrepInput {
  /**
   * 検索する正規表現パターン
   */
  pattern: string;
  /**
   * 検索するファイルまたはディレクトリ（デフォルトはcwd）
   */
  path?: string;
  /**
   * ファイルをフィルタリングするglobパターン（例："*.js"）
   */
  glob?: string;
  /**
   * 検索するファイルタイプ（例："js"、"py"、"rust"）
   */
  type?: string;
  /**
   * 出力モード："content"、"files_with_matches"、または"count"
   */
  output_mode?: 'content' | 'files_with_matches' | 'count';
  /**
   * 大文字小文字を区別しない検索
   */
  '-i'?: boolean;
  /**
   * 行番号を表示（contentモード用）
   */
  '-n'?: boolean;
  /**
   * 各マッチの前に表示する行数
   */
  '-B'?: number;
  /**
   * 各マッチの後に表示する行数
   */
  '-A'?: number;
  /**
   * 各マッチの前後に表示する行数
   */
  '-C'?: number;
  /**
   * 出力を最初のN行/エントリに制限
   */
  head_limit?: number;
  /**
   * マルチラインモードを有効にする
   */
  multiline?: boolean;
}
```

正規表現サポートを備えたripgrepベースの強力な検索ツール。

### KillBash

**ツール名：** `KillBash`

```typescript
interface KillShellInput {
  /**
   * 終了するバックグラウンドシェルのID
   */
  shell_id: string;
}
```

IDで指定された実行中のバックグラウンドbashシェルを終了します。

### NotebookEdit

**ツール名：** `NotebookEdit`

```typescript
interface NotebookEditInput {
  /**
   * Jupyterノートブックファイルの絶対パス
   */
  notebook_path: string;
  /**
   * 編集するセルのID
   */
  cell_id?: string;
  /**
   * セルの新しいソース
   */
  new_source: string;
  /**
   * セルのタイプ（codeまたはmarkdown）
   */
  cell_type?: 'code' | 'markdown';
  /**
   * 編集のタイプ（replace、insert、delete）
   */
  edit_mode?: 'replace' | 'insert' | 'delete';
}
```

Jupyterノートブックファイルのセルを編集します。

### WebFetch

**ツール名：** `WebFetch`

```typescript
interface WebFetchInput {
  /**
   * コンテンツを取得するURL
   */
  url: string;
  /**
   * 取得したコンテンツに対して実行するプロンプト
   */
  prompt: string;
}
```

URLからコンテンツを取得し、AIモデルで処理します。

### WebSearch

**ツール名：** `WebSearch`

```typescript
interface WebSearchInput {
  /**
   * 使用する検索クエリ
   */
  query: string;
  /**
   * これらのドメインからの結果のみを含める
   */
  allowed_domains?: string[];
  /**
   * これらのドメインからの結果を含めない
   */
  blocked_domains?: string[];
}
```

ウェブを検索し、フォーマットされた結果を返します。

### TodoWrite

**ツール名：** `TodoWrite`

```typescript
interface TodoWriteInput {
  /**
   * 更新されたTodoリスト
   */
  todos: Array<{
    /**
     * タスクの説明
     */
    content: string;
    /**
     * タスクのステータス
     */
    status: 'pending' | 'in_progress' | 'completed';
    /**
     * タスク説明の能動態形式
     */
    activeForm: string;
  }>;
}
```

進捗追跡のための構造化されたタスクリストを作成・管理します。

### ExitPlanMode

**ツール名：** `ExitPlanMode`

```typescript
interface ExitPlanModeInput {
  /**
   * ユーザーの承認のために実行する計画
   */
  plan: string;
}
```

計画モードを終了し、ユーザーに計画の承認を求めます。

### ListMcpResources

**ツール名：** `ListMcpResources`

```typescript
interface ListMcpResourcesInput {
  /**
   * リソースをフィルタリングするオプションのサーバー名
   */
  server?: string;
}
```

接続されたサーバーから利用可能なMCPリソースを一覧表示します。

### ReadMcpResource

**ツール名：** `ReadMcpResource`

```typescript
interface ReadMcpResourceInput {
  /**
   * MCPサーバー名
   */
  server: string;
  /**
   * 読み取るリソースURI
   */
  uri: string;
}
```

サーバーから特定のMCPリソースを読み取ります。

## ツール出力型

すべての組み込みClaude Codeツールの出力スキーマのドキュメント。これらの型は各ツールが返す実際のレスポンスデータを表します。

### `ToolOutput`

**注意：** これは明確さのためのドキュメント専用の型です。すべてのツール出力型のユニオンを表します。

```typescript
type ToolOutput =
  | TaskOutput
  | AskUserQuestionOutput
  | BashOutput
  | BashOutputToolOutput
  | EditOutput
  | ReadOutput
  | WriteOutput
  | GlobOutput
  | GrepOutput
  | KillBashOutput
  | NotebookEditOutput
  | WebFetchOutput
  | WebSearchOutput
  | TodoWriteOutput
  | ExitPlanModeOutput
  | ListMcpResourcesOutput
  | ReadMcpResourceOutput;
```

### Task

**ツール名：** `Task`

```typescript
interface TaskOutput {
  /**
   * サブエージェントからの最終結果メッセージ
   */
  result: string;
  /**
   * トークン使用統計
   */
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  /**
   * 合計コスト（USD）
   */
  total_cost_usd?: number;
  /**
   * 実行時間（ミリ秒）
   */
  duration_ms?: number;
}
```

委任されたタスクの完了後にサブエージェントからの最終結果を返します。

### AskUserQuestion

**ツール名：** `AskUserQuestion`

```typescript
interface AskUserQuestionOutput {
  /**
   * 尋ねられた質問
   */
  questions: Array<{
    question: string;
    header: string;
    options: Array<{
      label: string;
      description: string;
    }>;
    multiSelect: boolean;
  }>;
  /**
   * ユーザーが提供した回答。
   * 質問テキストを回答文字列にマッピング。
   * 複数選択の回答はカンマ区切り。
   */
  answers: Record<string, string>;
}
```

尋ねられた質問とユーザーの回答を返します。

### Bash

**ツール名：** `Bash`

```typescript
interface BashOutput {
  /**
   * stdoutとstderrの結合出力
   */
  output: string;
  /**
   * コマンドの終了コード
   */
  exitCode: number;
  /**
   * タイムアウトによりコマンドが終了されたかどうか
   */
  killed?: boolean;
  /**
   * バックグラウンドプロセスのシェルID
   */
  shellId?: string;
}
```

終了ステータス付きのコマンド出力を返します。バックグラウンドコマンドはshellIdとともに即座に返されます。

### BashOutput

**ツール名：** `BashOutput`

```typescript
interface BashOutputToolOutput {
  /**
   * 前回のチェック以降の新しい出力
   */
  output: string;
  /**
   * 現在のシェルステータス
   */
  status: 'running' | 'completed' | 'failed';
  /**
   * 終了コード（完了時）
   */
  exitCode?: number;
}
```

バックグラウンドシェルからの増分出力を返します。

### Edit

**ツール名：** `Edit`

```typescript
interface EditOutput {
  /**
   * 確認メッセージ
   */
  message: string;
  /**
   * 実行された置換の数
   */
  replacements: number;
  /**
   * 編集されたファイルパス
   */
  file_path: string;
}
```

置換数付きの成功した編集の確認を返します。

### Read

**ツール名:** `Read`

```typescript
type ReadOutput = 
  | TextFileOutput
  | ImageFileOutput
  | PDFFileOutput
  | NotebookFileOutput;

interface TextFileOutput {
  /**
   * 行番号付きのファイル内容
   */
  content: string;
  /**
   * ファイルの総行数
   */
  total_lines: number;
  /**
   * 実際に返された行数
   */
  lines_returned: number;
}

interface ImageFileOutput {
  /**
   * Base64エンコードされた画像データ
   */
  image: string;
  /**
   * 画像のMIMEタイプ
   */
  mime_type: string;
  /**
   * ファイルサイズ（バイト）
   */
  file_size: number;
}

interface PDFFileOutput {
  /**
   * ページ内容の配列
   */
  pages: Array<{
    page_number: number;
    text?: string;
    images?: Array<{
      image: string;
      mime_type: string;
    }>;
  }>;
  /**
   * 総ページ数
   */
  total_pages: number;
}

interface NotebookFileOutput {
  /**
   * Jupyterノートブックのセル
   */
  cells: Array<{
    cell_type: 'code' | 'markdown';
    source: string;
    outputs?: any[];
    execution_count?: number;
  }>;
  /**
   * ノートブックのメタデータ
   */
  metadata?: Record<string, any>;
}
```

ファイルタイプに適した形式でファイル内容を返します。

### Write

**ツール名:** `Write`

```typescript
interface WriteOutput {
  /**
   * 成功メッセージ
   */
  message: string;
  /**
   * 書き込まれたバイト数
   */
  bytes_written: number;
  /**
   * 書き込まれたファイルパス
   */
  file_path: string;
}
```

ファイルの書き込みが成功した後に確認を返します。

### Glob

**ツール名:** `Glob`

```typescript
interface GlobOutput {
  /**
   * 一致するファイルパスの配列
   */
  matches: string[];
  /**
   * 見つかった一致数
   */
  count: number;
  /**
   * 使用された検索ディレクトリ
   */
  search_path: string;
}
```

globパターンに一致するファイルパスを、更新日時順にソートして返します。

### Grep

**ツール名:** `Grep`

```typescript
type GrepOutput = 
  | GrepContentOutput
  | GrepFilesOutput
  | GrepCountOutput;

interface GrepContentOutput {
  /**
   * コンテキスト付きの一致行
   */
  matches: Array<{
    file: string;
    line_number?: number;
    line: string;
    before_context?: string[];
    after_context?: string[];
  }>;
  /**
   * 一致の総数
   */
  total_matches: number;
}

interface GrepFilesOutput {
  /**
   * 一致を含むファイル
   */
  files: string[];
  /**
   * 一致を含むファイル数
   */
  count: number;
}

interface GrepCountOutput {
  /**
   * ファイルごとの一致数
   */
  counts: Array<{
    file: string;
    count: number;
  }>;
  /**
   * 全ファイルの一致総数
   */
  total: number;
}
```

output_modeで指定された形式で検索結果を返します。

### KillBash

**ツール名:** `KillBash`

```typescript
interface KillBashOutput {
  /**
   * 成功メッセージ
   */
  message: string;
  /**
   * 終了されたシェルのID
   */
  shell_id: string;
}
```

バックグラウンドシェルの終了後に確認を返します。

### NotebookEdit

**ツール名:** `NotebookEdit`

```typescript
interface NotebookEditOutput {
  /**
   * 成功メッセージ
   */
  message: string;
  /**
   * 実行された編集の種類
   */
  edit_type: 'replaced' | 'inserted' | 'deleted';
  /**
   * 影響を受けたセルID
   */
  cell_id?: string;
  /**
   * 編集後のノートブックの総セル数
   */
  total_cells: number;
}
```

Jupyterノートブックの変更後に確認を返します。

### WebFetch

**ツール名:** `WebFetch`

```typescript
interface WebFetchOutput {
  /**
   * プロンプトに対するAIモデルの応答
   */
  response: string;
  /**
   * フェッチされたURL
   */
  url: string;
  /**
   * リダイレクト後の最終URL
   */
  final_url?: string;
  /**
   * HTTPステータスコード
   */
  status_code?: number;
}
```

フェッチされたWebコンテンツのAI分析結果を返します。

### WebSearch

**ツール名:** `WebSearch`

```typescript
interface WebSearchOutput {
  /**
   * 検索結果
   */
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    /**
     * 利用可能な場合の追加メタデータ
     */
    metadata?: Record<string, any>;
  }>;
  /**
   * 結果の総数
   */
  total_results: number;
  /**
   * 検索されたクエリ
   */
  query: string;
}
```

Webからフォーマットされた検索結果を返します。

### TodoWrite

**ツール名:** `TodoWrite`

```typescript
interface TodoWriteOutput {
  /**
   * 成功メッセージ
   */
  message: string;
  /**
   * 現在のTodo統計
   */
  stats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
}
```

現在のタスク統計とともに確認を返します。

### ExitPlanMode

**ツール名:** `ExitPlanMode`

```typescript
interface ExitPlanModeOutput {
  /**
   * 確認メッセージ
   */
  message: string;
  /**
   * ユーザーがプランを承認したかどうか
   */
  approved?: boolean;
}
```

プランモード終了後に確認を返します。

### ListMcpResources

**ツール名:** `ListMcpResources`

```typescript
interface ListMcpResourcesOutput {
  /**
   * 利用可能なリソース
   */
  resources: Array<{
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
    server: string;
  }>;
  /**
   * リソースの総数
   */
  total: number;
}
```

利用可能なMCPリソースのリストを返します。

### ReadMcpResource

**ツール名:** `ReadMcpResource`

```typescript
interface ReadMcpResourceOutput {
  /**
   * リソースの内容
   */
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
  /**
   * リソースを提供したサーバー
   */
  server: string;
}
```

リクエストされたMCPリソースの内容を返します。

## パーミッションタイプ

### `PermissionUpdate`

パーミッションを更新するための操作。

```typescript
type PermissionUpdate = 
  | {
      type: 'addRules';
      rules: PermissionRuleValue[];
      behavior: PermissionBehavior;
      destination: PermissionUpdateDestination;
    }
  | {
      type: 'replaceRules';
      rules: PermissionRuleValue[];
      behavior: PermissionBehavior;
      destination: PermissionUpdateDestination;
    }
  | {
      type: 'removeRules';
      rules: PermissionRuleValue[];
      behavior: PermissionBehavior;
      destination: PermissionUpdateDestination;
    }
  | {
      type: 'setMode';
      mode: PermissionMode;
      destination: PermissionUpdateDestination;
    }
  | {
      type: 'addDirectories';
      directories: string[];
      destination: PermissionUpdateDestination;
    }
  | {
      type: 'removeDirectories';
      directories: string[];
      destination: PermissionUpdateDestination;
    }
```

### `PermissionBehavior`

```typescript
type PermissionBehavior = 'allow' | 'deny' | 'ask';
```

### `PermissionUpdateDestination`

```typescript
type PermissionUpdateDestination = 
  | 'userSettings'     // グローバルユーザー設定
  | 'projectSettings'  // ディレクトリごとのプロジェクト設定
  | 'localSettings'    // Gitignoreされたローカル設定
  | 'session'          // 現在のセッションのみ
```

### `PermissionRuleValue`

```typescript
type PermissionRuleValue = {
  toolName: string;
  ruleContent?: string;
}
```

## その他のタイプ

### `ApiKeySource`

```typescript
type ApiKeySource = 'user' | 'project' | 'org' | 'temporary';
```

### `SdkBeta`

`betas`オプションで有効にできる利用可能なベータ機能。詳細については[ベータヘッダー](/docs/ja/api/beta-headers)を参照してください。

```typescript
type SdkBeta = 'context-1m-2025-08-07';
```

| 値 | 説明 | 互換モデル |
|:------|:------------|:------------------|
| `'context-1m-2025-08-07'` | 100万トークンの[コンテキストウィンドウ](/docs/ja/build-with-claude/context-windows)を有効にする | Claude Opus 4.6、Claude Sonnet 4.5、Claude Sonnet 4 |

### `SlashCommand`

利用可能なスラッシュコマンドに関する情報。

```typescript
type SlashCommand = {
  name: string;
  description: string;
  argumentHint: string;
}
```

### `ModelInfo`

利用可能なモデルに関する情報。

```typescript
type ModelInfo = {
  value: string;
  displayName: string;
  description: string;
}
```

### `McpServerStatus`

接続されたMCPサーバーのステータス。

```typescript
type McpServerStatus = {
  name: string;
  status: 'connected' | 'failed' | 'needs-auth' | 'pending';
  serverInfo?: {
    name: string;
    version: string;
  };
}
```

### `AccountInfo`

認証済みユーザーのアカウント情報。

```typescript
type AccountInfo = {
  email?: string;
  organization?: string;
  subscriptionType?: string;
  tokenSource?: string;
  apiKeySource?: string;
}
```

### `ModelUsage`

結果メッセージで返されるモデルごとの使用統計。

```typescript
type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
}
```

### `ConfigScope`

```typescript
type ConfigScope = 'local' | 'user' | 'project';
```

### `NonNullableUsage`

すべてのnullableフィールドをnon-nullableにした[`Usage`](#usage)のバージョン。

```typescript
type NonNullableUsage = {
  [K in keyof Usage]: NonNullable<Usage[K]>;
}
```

### `Usage`

トークン使用統計（`@anthropic-ai/sdk`より）。

```typescript
type Usage = {
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}
```

### `CallToolResult`

MCPツール結果タイプ（`@modelcontextprotocol/sdk/types.js`より）。

```typescript
type CallToolResult = {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    // 追加フィールドはタイプによって異なります
  }>;
  isError?: boolean;
}
```

### `AbortError`

中止操作用のカスタムエラークラス。

```typescript
class AbortError extends Error {}
```

## サンドボックス設定

### `SandboxSettings`

サンドボックス動作の設定。コマンドサンドボックスの有効化やネットワーク制限をプログラムで設定するために使用します。

```typescript
type SandboxSettings = {
  enabled?: boolean;
  autoAllowBashIfSandboxed?: boolean;
  excludedCommands?: string[];
  allowUnsandboxedCommands?: boolean;
  network?: NetworkSandboxSettings;
  ignoreViolations?: SandboxIgnoreViolations;
  enableWeakerNestedSandbox?: boolean;
}
```

| プロパティ | タイプ | デフォルト | 説明 |
| :------- | :--- | :------ | :---------- |
| `enabled` | `boolean` | `false` | コマンド実行のサンドボックスモードを有効にする |
| `autoAllowBashIfSandboxed` | `boolean` | `false` | サンドボックスが有効な場合にbashコマンドを自動承認する |
| `excludedCommands` | `string[]` | `[]` | サンドボックス制限を常にバイパスするコマンド（例：`['docker']`）。これらはモデルの関与なしに自動的にサンドボックス外で実行されます |
| `allowUnsandboxedCommands` | `boolean` | `false` | モデルがサンドボックス外でのコマンド実行をリクエストすることを許可する。`true`の場合、モデルはツール入力で`dangerouslyDisableSandbox`を設定でき、[パーミッションシステム](#permissions-fallback-for-unsandboxed-commands)にフォールバックします |
| `network` | [`NetworkSandboxSettings`](#networksandboxsettings) | `undefined` | ネットワーク固有のサンドボックス設定 |
| `ignoreViolations` | [`SandboxIgnoreViolations`](#sandboxignoreviolations) | `undefined` | 無視するサンドボックス違反の設定 |
| `enableWeakerNestedSandbox` | `boolean` | `false` | 互換性のためにより弱いネストされたサンドボックスを有効にする |

<Note>
**ファイルシステムとネットワークのアクセス制限**はサンドボックス設定では設定されません。代わりに、[パーミッションルール](https://code.claude.com/docs/ja/settings#permission-settings)から導出されます：

- **ファイルシステム読み取り制限**: Read denyルール
- **ファイルシステム書き込み制限**: Edit allow/denyルール
- **ネットワーク制限**: WebFetch allow/denyルール

コマンド実行のサンドボックスにはサンドボックス設定を使用し、ファイルシステムとネットワークのアクセス制御にはパーミッションルールを使用してください。
</Note>

#### 使用例

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const result = await query({
  prompt: "Build and test my project",
  options: {
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,
      network: {
        allowLocalBinding: true
      }
    }
  }
});
```

<Warning>
**Unixソケットのセキュリティ**: `allowUnixSockets`オプションは強力なシステムサービスへのアクセスを許可する可能性があります。例えば、`/var/run/docker.sock`を許可すると、Docker APIを通じて実質的にホストシステムへの完全なアクセスが許可され、サンドボックスの分離がバイパスされます。厳密に必要なUnixソケットのみを許可し、各ソケットのセキュリティへの影響を理解してください。
</Warning>

### `NetworkSandboxSettings`

サンドボックスモードのネットワーク固有の設定。

```typescript
type NetworkSandboxSettings = {
  allowLocalBinding?: boolean;
  allowUnixSockets?: string[];
  allowAllUnixSockets?: boolean;
  httpProxyPort?: number;
  socksProxyPort?: number;
}
```

| プロパティ | タイプ | デフォルト | 説明 |
| :------- | :--- | :------ | :---------- |
| `allowLocalBinding` | `boolean` | `false` | プロセスがローカルポートにバインドすることを許可する（例：開発サーバー用） |
| `allowUnixSockets` | `string[]` | `[]` | プロセスがアクセスできるUnixソケットパス（例：Dockerソケット） |
| `allowAllUnixSockets` | `boolean` | `false` | すべてのUnixソケットへのアクセスを許可する |
| `httpProxyPort` | `number` | `undefined` | ネットワークリクエスト用のHTTPプロキシポート |
| `socksProxyPort` | `number` | `undefined` | ネットワークリクエスト用のSOCKSプロキシポート |

### `SandboxIgnoreViolations`

特定のサンドボックス違反を無視するための設定。

```typescript
type SandboxIgnoreViolations = {
  file?: string[];
  network?: string[];
}
```

| プロパティ | タイプ | デフォルト | 説明 |
| :------- | :--- | :------ | :---------- |
| `file` | `string[]` | `[]` | 違反を無視するファイルパスパターン |
| `network` | `string[]` | `[]` | 違反を無視するネットワークパターン |

### サンドボックス外コマンドのパーミッションフォールバック

`allowUnsandboxedCommands`が有効な場合、モデルはツール入力で`dangerouslyDisableSandbox: true`を設定することで、サンドボックス外でのコマンド実行をリクエストできます。これらのリクエストは既存のパーミッションシステムにフォールバックし、`canUseTool`ハンドラーが呼び出されるため、カスタム認可ロジックを実装できます。

<Note>
**`excludedCommands` vs `allowUnsandboxedCommands`:**
- `excludedCommands`: 常にサンドボックスを自動的にバイパスするコマンドの静的リスト（例：`['docker']`）。モデルはこれを制御できません。
- `allowUnsandboxedCommands`: モデルがツール入力で`dangerouslyDisableSandbox: true`を設定することで、実行時にサンドボックス外での実行をリクエストするかどうかを決定できるようにします。
</Note>

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const result = await query({
  prompt: "Deploy my application",
  options: {
    sandbox: {
      enabled: true,
      allowUnsandboxedCommands: true  // モデルがサンドボックス外実行をリクエスト可能
    },
    permissionMode: "default",
    canUseTool: async (tool, input) => {
      // モデルがサンドボックスのバイパスをリクエストしているか確認
      if (tool === "Bash" && input.dangerouslyDisableSandbox) {
        // モデルはこのコマンドをサンドボックス外で実行したい
        console.log(`Unsandboxed command requested: ${input.command}`);

        // trueを返して許可、falseを返して拒否
        return isCommandAuthorized(input.command);
      }
      return true;
    }
  }
});
```

このパターンにより以下が可能になります：

- **モデルリクエストの監査**: モデルがサンドボックス外実行をリクエストした際にログを記録
- **許可リストの実装**: 特定のコマンドのみサンドボックス外での実行を許可
- **承認ワークフローの追加**: 特権操作に明示的な認可を要求

<Warning>
`dangerouslyDisableSandbox: true`で実行されるコマンドは完全なシステムアクセスを持ちます。`canUseTool`ハンドラーでこれらのリクエストを慎重に検証してください。

`permissionMode`が`bypassPermissions`に設定され、`allowUnsandboxedCommands`が有効な場合、モデルは承認プロンプトなしにサンドボックス外でコマンドを自律的に実行できます。この組み合わせは、モデルがサンドボックスの分離をサイレントにエスケープすることを実質的に許可します。
</Warning>

## 関連項目

- [SDK概要](/docs/ja/agent-sdk/overview) - 一般的なSDKの概念
- [Python SDKリファレンス](/docs/ja/agent-sdk/python) - Python SDKドキュメント
- [CLIリファレンス](https://code.claude.com/docs/ja/cli-reference) - コマンドラインインターフェース
- [一般的なワークフロー](https://code.claude.com/docs/ja/common-workflows) - ステップバイステップガイド