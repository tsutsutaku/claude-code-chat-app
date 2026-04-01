"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { resolveToolOutput } from "@/lib/read-tool-display";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolOutput } from "@/components/ai-elements/tool";
import { ToolGroup } from "@/components/tool-group";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { DeveloperModeEmptyControl } from "@/components/developer-mode-empty-control";
import { AssistantMessageFeedback } from "@/components/message-feedback";
import { useAgentChat, type ChatMessage, type ChatStatus, type MessagePart, type ToolPart, type TextPart } from "@/lib/use-agent-chat";
import { cn } from "@/lib/utils";

/** 連続するツールパートをグループ化する */
type PartGroup =
  | { type: "text"; part: TextPart; index: number }
  | { type: "tool-group"; parts: ToolPart[]; key: string };

function groupParts(parts: MessagePart[], messageId: string): PartGroup[] {
  const groups: PartGroup[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type === "text") {
      groups.push({ type: "text", part, index: i });
    } else if (part.type === "tool") {
      const last = groups[groups.length - 1];
      if (last?.type === "tool-group") {
        last.parts.push(part);
      } else {
        groups.push({
          type: "tool-group",
          parts: [part],
          key: `${messageId}-tg-${i}`,
        });
      }
    }
  }
  return groups;
}

function hasAssistantContent(message: ChatMessage): boolean {
  if (message.role !== "assistant") return false;
  return message.parts.some(
    (p) => (p.type === "text" && p.text.trim()) || p.type === "tool"
  );
}

const STORAGE_KEY = "chat-developer-mode";

export function Chat() {
  // SSR と初回クライアント描画を一致させる（localStorage は effect で同期）
  const [developerMode, setDeveloperMode] = useState(true);

  useLayoutEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setDeveloperMode(stored === "true");
    }
  }, []);

  const handleDeveloperModeChange = (value: boolean) => {
    setDeveloperMode(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  };

  const { messages, sendMessage, status, stop, newConversation, loadConversation } = useAgentChat(
    "/api/chat",
    { extraBody: { developerMode } }
  );
  const [input, setInput] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  /** 応答完了のたびに加算し、サイドバーでセッション一覧を再取得する */
  const [sessionListVersion, setSessionListVersion] = useState(0);
  const prevStatusRef = useRef<ChatStatus>(status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === "streaming" && status === "idle") {
      setSessionListVersion((v) => v + 1);
    }
  }, [status]);

  const awaitingFirstToken = useMemo(() => {
    if (status !== "submitted" && status !== "streaming") return false;
    const last = messages[messages.length - 1];
    if (!last) return false;
    if (last.role === "user") return true;
    if (last.role === "assistant") return !hasAssistantContent(last);
    return false;
  }, [messages, status]);

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-row">
      <ConversationSidebar
        activeSessionId={activeSessionId}
        sessionListVersion={sessionListVersion}
        onNewChat={() => {
          newConversation();
          setActiveSessionId(null);
        }}
        onLoadSession={(msgs, sessionId) => {
          loadConversation(msgs, sessionId);
          setActiveSessionId(sessionId);
        }}
      />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col px-[4.5rem] sm:px-[7.5rem] md:px-[10.5rem] lg:px-[15rem]">
      <Conversation className="min-h-0 w-full min-w-0">
        <ConversationContent className="w-full min-w-0 max-w-none px-0 py-4 sm:px-0">
          {messages.length === 0 ? (
            <div className="relative w-full">
              <div className="pointer-events-auto absolute top-0 right-0 z-10">
                <DeveloperModeEmptyControl
                  developerMode={developerMode}
                  onDeveloperModeChange={handleDeveloperModeChange}
                />
              </div>
              <ConversationEmptyState
                className="gap-4 pt-14 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:text-zinc-900 [&_p]:max-w-md [&_p]:text-zinc-500"
                title="Claude Agent Chat"
                description="workspace/ 内のファイルを参照・操作できるエージェントです"
              />
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const isAssistantStreaming =
                  message.role === "assistant" &&
                  (status === "streaming" || status === "submitted") &&
                  message.id === messages[messages.length - 1]?.id;

                return (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {groupParts(message.parts, message.id).map((group) => {
                      if (group.type === "tool-group") {
                        if (group.parts.length === 1) {
                          const part = group.parts[0];
                          const displayOutput = resolveToolOutput(part);
                          return (
                            <Tool
                              key={group.key}
                              defaultOpen={false}
                            >
                              <ToolHeader
                                type="dynamic-tool"
                                state={part.state}
                                toolName={part.toolName}
                                title={part.toolName}
                                subtitle={part.subtitle ?? undefined}
                              />
                              <ToolContent>
                                <ToolOutput
                                  output={displayOutput}
                                  errorText={part.errorText ?? undefined}
                                />
                              </ToolContent>
                            </Tool>
                          );
                        }
                        return (
                          <ToolGroup
                            key={group.key}
                            messageId={message.id}
                            parts={group.parts}
                          />
                        );
                      }

                      const { part, index } = group;
                      return message.role === "assistant" ? (
                        <MessageResponse
                          key={`${message.id}-text-${index}`}
                          isAnimating={
                            (status === "streaming" || status === "submitted") &&
                            message.id === messages[messages.length - 1]?.id
                          }
                        >
                          {part.text}
                        </MessageResponse>
                      ) : (
                        <p
                          key={`${message.id}-text-${index}`}
                          className="whitespace-pre-wrap text-base leading-relaxed text-zinc-950"
                        >
                          {part.text}
                        </p>
                      );
                    })}
                  </MessageContent>
                  {!isAssistantStreaming && message.role === "assistant" && (
                    <AssistantMessageFeedback
                      messageId={message.id}
                      traceId={message.langfuseTraceId}
                    />
                  )}
                </Message>
                );
              })}
              {awaitingFirstToken && (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer className="text-base" duration={2}>
                      調査中…
                    </Shimmer>
                  </MessageContent>
                </Message>
              )}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="flex w-full min-w-0 shrink-0 border-t border-zinc-200/80 bg-zinc-50/90 pb-4 pt-3 backdrop-blur-sm">
        <div
          className={cn(
            "min-w-0 w-full transition-[filter]",
            "**:data-[slot=input-group]:rounded-2xl",
            "**:data-[slot=input-group]:border-zinc-200/90",
            "**:data-[slot=input-group]:bg-white",
            "**:data-[slot=input-group]:shadow-[0_4px_32px_-12px_rgba(15,23,42,0.1)]",
            "**:data-[slot=input-group]:transition-[box-shadow,border-color]",
            "focus-within:**:data-[slot=input-group]:border-zinc-300",
            "focus-within:**:data-[slot=input-group]:shadow-[0_8px_40px_-12px_rgba(15,23,42,0.14)]"
          )}
        >
          <PromptInput
            className="w-full"
            onSubmit={() => {
              if (input.trim()) {
                sendMessage(input);
                setInput("");
              }
            }}
          >
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="メッセージを入力…"
              className="no-scrollbar min-h-[88px] resize-none border-0 bg-transparent py-4 pl-4 pr-2 text-base leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-0 md:min-h-[104px]"
            />
            <PromptInputSubmit
              className="mb-2 mr-2 size-10 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 [&_svg]:text-primary-foreground"
              status={status as import("ai").ChatStatus}
              onStop={stop}
            />
          </PromptInput>
        </div>
      </div>
      </div>
    </div>
  );
}
