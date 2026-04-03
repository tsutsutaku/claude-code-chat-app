# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

A Next.js 16 chat application that uses the Claude Agent SDK to run a Claude Code agent against a local workspace. The agent can analyze and work on the `workspace/kurewari` project (household expense-splitting app).

## Development Commands

All commands run from `chat-app/`:

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run langfuse:seed-prompts  # Seed system prompts to Langfuse
```

## Architecture

### Request Flow

```
Browser (useChat from AI SDK)
  → POST /api/chat
  → @anthropic-ai/claude-agent-sdk query()
      ├── cwd: workspace/kurewari
      ├── model: claude-haiku-4-5
      ├── tools: Claude Code preset (Bash, Read, Write, Grep, etc.)
      ├── systemPrompt: Langfuse (prod label) → local fallback
      └── canUseTool: validates paths are within workspace/
  → Stream SDKMessage → UIMessage (stream-adapter.ts)
  → SSE response to browser
```

### Key Files

| File | Role |
|------|------|
| `src/app/api/chat/route.ts` | Main agent query endpoint |
| `src/lib/claude-session.ts` | Agent SDK config, system prompts, session management |
| `src/lib/use-agent-chat.ts` | Client-side chat hook |
| `src/lib/stream-adapter.ts` | Converts SDKMessage stream to UIMessage format |
| `src/lib/workspace-tool-permissions.ts` | Validates tool calls stay within workspace/ |
| `src/lib/langfuse-instrumentation.ts` | Langfuse tracing setup |
| `src/lib/langfuse-system-prompt.ts` | Fetches system prompts from Langfuse |

### Session Management

Sessions are stored in an in-memory `Map` in `claude-session.ts`. `POST /api/chat` creates or resumes a session by `sessionId`. Session endpoints live at `src/app/api/claude-sessions/`.

### Operating Modes

The system prompt has two modes toggled via the `developerMode` flag in the chat request:
- **Developer Mode**: Technical explanations with code details
- **Business Mode**: Plain language summaries, no code

## Agent Workspace

`workspace/kurewari/` is the agent's working directory (gitignored). It contains a full-stack expense-splitting app:
- `frontend/` — Next.js 14 (React Query, RSC)
- `api/` — Hono on Cloudflare Workers + Neon PostgreSQL + Drizzle ORM
- `packages/types/` — Shared Zod schemas
- `docs/` — Architecture and design docs (Japanese)

See `workspace/kurewari/CLAUDE.md` for agent guidance specific to that project.

## Required Environment Variables

```
ANTHROPIC_API_KEY           # Required
LANGFUSE_SECRET_KEY         # Optional — enables tracing
LANGFUSE_PUBLIC_KEY         # Optional
LANGFUSE_BASE_URL           # Optional
NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY  # Optional — client-side Langfuse
NEXT_PUBLIC_LANGFUSE_BASE_URL    # Optional
NEXT_PUBLIC_USER_ID         # Optional — Langfuse userId
```

Copy `.env.example` (or set manually) before running.

## Claude Agent SDK Reference

`claude_agent_sdk_v1.md` at the repo root contains the full TypeScript API reference for the Agent SDK used in this project.
