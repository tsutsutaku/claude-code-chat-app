"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import type { ToolState, ToolPart } from "@/lib/use-agent-chat";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
  getStatusBadge,
} from "@/components/ai-elements/tool";
import { resolveToolOutput } from "@/lib/read-tool-display";

/** グループ全体としての状態を決定する */
function groupState(parts: ToolPart[]): ToolState {
  if (parts.some((p) => p.state === "output-error")) return "output-error";
  if (parts.some((p) => p.state === "input-streaming")) return "input-streaming";
  if (parts.some((p) => p.state === "input-available")) return "input-available";
  return "output-available";
}

/** エラーの数 */
function errorCount(parts: ToolPart[]) {
  return parts.filter((p) => p.state === "output-error").length;
}

type Props = {
  messageId: string;
  parts: ToolPart[];
};

export function ToolGroup({ messageId, parts }: Props) {
  const [open, setOpen] = useState(false);
  const state = groupState(parts);
  const errors = errorCount(parts);

  /** ヘッダーに表示するツール名のサマリー（最大5件） */
  const nameSummary = parts
    .slice(0, 5)
    .map((p) => p.toolName)
    .join(" · ") + (parts.length > 5 ? ` · …` : "");

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group not-prose mb-4 w-full rounded-lg border border-zinc-300/90 bg-white shadow-sm"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 rounded-t-lg bg-zinc-50/90 p-3 hover:bg-zinc-100/90">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <WrenchIcon className="mt-0.5 size-4 shrink-0 text-zinc-500" />
          <div className="min-w-0 flex-1 text-left">
            <div className="font-medium text-sm text-zinc-900">
              {parts.length} 件のツール実行
            </div>
            <div className="truncate text-zinc-600 text-xs" title={nameSummary}>
              {nameSummary}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {errors > 0 && (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-red-200 bg-red-50 text-xs font-medium text-red-700"
              >
                <XCircleIcon className="size-3" />
                {errors} エラー
              </Badge>
            )}
            {getStatusBadge(state)}
          </div>
        </div>
        <ChevronDownIcon className="size-4 shrink-0 text-zinc-500 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-2 border-t border-zinc-200 bg-zinc-50/40 p-3">
        {parts.map((part) => {
          const displayOutput = resolveToolOutput(part);
          return (
            <Tool
              key={`${messageId}-tool-${part.toolCallId}`}
              defaultOpen={false}
              className="mb-0 border-zinc-200 bg-white"
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
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
