"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/use-agent-chat";

type SessionItem = { id: string; title: string; updatedAt: string };

type Props = {
  className?: string;
  activeSessionId: string | null;
  onNewChat: () => void;
  onLoadSession: (messages: ChatMessage[], sessionId: string) => void;
  /** 増えるたびに一覧を再取得（応答完了後に Chat から加算） */
  sessionListVersion?: number;
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

export function ConversationSidebar({
  className,
  activeSessionId,
  onNewChat,
  onLoadSession,
  sessionListVersion = 0,
}: Props) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/claude-sessions");
      const data = (await res.json()) as {
        sessions?: SessionItem[];
        error?: string;
      };
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      if (data.error) setError(data.error);
    } catch {
      setError("一覧の取得に失敗しました");
      setSessions([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  /** 応答完了などで sessionListVersion が増えたら、JSONL 書き込み待ちのあとで一覧だけ更新 */
  useEffect(() => {
    if (sessionListVersion < 1) return;
    const t = window.setTimeout(() => {
      void refresh(true);
    }, 450);
    return () => window.clearTimeout(t);
  }, [sessionListVersion, refresh]);

  const handleSelect = async (id: string) => {
    try {
      const res = await fetch(`/api/claude-sessions/${encodeURIComponent(id)}`);
      if (!res.ok) {
        setError("会話の読み込みに失敗しました");
        return;
      }
      const data = (await res.json()) as { messages?: ChatMessage[]; sessionId?: string };
      const msgs = data.messages ?? [];
      const sid = data.sessionId ?? id;
      onLoadSession(msgs, sid);
    } catch {
      setError("会話の読み込みに失敗しました");
    }
  };

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[min(100%,15.5rem)] shrink-0 flex-col border-r border-zinc-200 bg-white sm:w-[min(100%,17rem)]",
        className
      )}
    >
      <div className="shrink-0 border-b border-zinc-200 p-3">
        <Button
          type="button"
          variant="default"
          className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={onNewChat}
        >
          新しい会話
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-2 py-2">
        <p className="shrink-0 px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
          保存されたセッション
        </p>
        <ScrollArea className="min-h-0 flex-1 pr-2">
          {loading ? (
            <p className="px-2 text-sm text-zinc-500">読み込み中…</p>
          ) : error ? (
            <p className="px-2 text-sm text-amber-700">{error}</p>
          ) : sessions.length === 0 ? (
            <p className="px-2 text-sm leading-relaxed text-zinc-500">
              JSONL がありません。Claude Code のプロジェクトフォルダを{" "}
              <code className="rounded bg-zinc-100 px-1 text-[12px]">CLAUDE_SESSIONS_DIR</code>{" "}
              で指定できます。
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => void handleSelect(s.id)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                      activeSessionId === s.id
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    <span className="line-clamp-2 font-medium leading-snug">{s.title}</span>
                    <span className="text-[11px] text-zinc-400">{formatTime(s.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>
    </aside>
  );
}
