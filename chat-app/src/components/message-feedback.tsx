"use client";

import { MessageAction, MessageActions } from "@/components/ai-elements/message";
import { getLangfuseWeb, USER_THUMBS_SCORE_NAME } from "@/lib/langfuse-web";
import { cn } from "@/lib/utils";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useCallback, useRef, useState } from "react";

type Props = {
  messageId: string;
  /** Langfuse トレース ID（無い場合はフィードバックを送れない） */
  traceId?: string;
};

export function AssistantMessageFeedback({ messageId, traceId }: Props) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** 直近で送信済みの「トレース×評価」（同じ組み合わせの二重送信を防ぐ） */
  const lastSentSigRef = useRef<string | null>(null);

  const sendScore = useCallback(
    async (value: 0 | 1) => {
      const lf = getLangfuseWeb();
      if (!lf || !traceId) return;
      setSubmitting(true);
      try {
        await lf.score({
          traceId,
          name: USER_THUMBS_SCORE_NAME,
          value,
          dataType: "BOOLEAN",
          metadata: { messageId, source: "chat-app" },
        });
        await lf.flushAsync();
      } finally {
        setSubmitting(false);
      }
    },
    [messageId, traceId]
  );

  const onPick = useCallback(
    (next: "up" | "down") => {
      setVote((prev) => {
        const togglingOff = prev === next;
        const newVote = togglingOff ? null : next;

        if (newVote === null) {
          lastSentSigRef.current = null;
        } else if (traceId) {
          const sig = `${traceId}:${newVote}`;
          if (lastSentSigRef.current !== sig) {
            lastSentSigRef.current = sig;
            queueMicrotask(() => {
              void (async () => {
                try {
                  await sendScore(newVote === "up" ? 1 : 0);
                } catch {
                  lastSentSigRef.current = null;
                }
              })();
            });
          }
        }

        return newVote;
      });
    },
    [sendScore, traceId]
  );

  const canSendToLangfuse = Boolean(
    traceId && getLangfuseWeb()
  );

  return (
    <div
      className="flex w-full justify-end border-t border-zinc-200/90 pt-2"
      data-message-id={messageId}
    >
      <MessageActions className="gap-0">
        <MessageAction
          tooltip={
            canSendToLangfuse
              ? "良い"
              : "評価のみ（Langfuse 未設定またはトレース未取得）"
          }
          label="良い"
          variant="ghost"
          size="icon-sm"
          disabled={submitting}
          className={cn(
            "size-8 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
            vote === "up" &&
              "bg-zinc-100 text-emerald-700 hover:bg-zinc-100 hover:text-emerald-800"
          )}
          aria-pressed={vote === "up"}
          onClick={() => onPick("up")}
        >
          <ThumbsUp className="size-4" strokeWidth={2} />
        </MessageAction>
        <MessageAction
          tooltip={
            canSendToLangfuse
              ? "悪い"
              : "評価のみ（Langfuse 未設定またはトレース未取得）"
          }
          label="悪い"
          variant="ghost"
          size="icon-sm"
          disabled={submitting}
          className={cn(
            "size-8 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
            vote === "down" &&
              "bg-zinc-100 text-amber-800 hover:bg-zinc-100 hover:text-amber-900"
          )}
          aria-pressed={vote === "down"}
          onClick={() => onPick("down")}
        >
          <ThumbsDown className="size-4" strokeWidth={2} />
        </MessageAction>
      </MessageActions>
    </div>
  );
}
