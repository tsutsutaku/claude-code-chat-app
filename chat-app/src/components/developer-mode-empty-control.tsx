"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CodeIcon, BriefcaseIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  developerMode: boolean;
  onDeveloperModeChange: (value: boolean) => void;
  className?: string;
};

/** 初期画面（メッセージ 0 件）のみ表示。会話開始後は Chat 側で非表示にする */
export function DeveloperModeEmptyControl({
  developerMode,
  onDeveloperModeChange,
  className,
}: Props) {
  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-zinc-200/90 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm",
          className
        )}
      >
        {developerMode ? (
          <CodeIcon className="size-4 shrink-0 text-primary" aria-hidden />
        ) : (
          <BriefcaseIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="developer-mode-empty"
              className="cursor-pointer text-sm font-medium text-zinc-800"
            >
              開発者モード
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  aria-label="開発者モードの詳細"
                >
                  <Info className="size-4" strokeWidth={2} />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                variant="light"
                side="left"
                align="start"
                className="max-w-sm flex-col items-start gap-2 px-3 py-2.5 text-left"
              >
                <p className="text-xs font-semibold leading-tight text-zinc-900">
                  開発者モードとは
                </p>
                <div className="space-y-2 text-[11px] leading-relaxed text-zinc-600">
                  <p>
                    <span className="font-medium text-zinc-900">ON</span>
                    ：コード・スキーマ・SQL・実装の仕組みなど、技術的な詳細を含めて回答します。エンジニア向けの説明に向いています。
                  </p>
                  <p>
                    <span className="font-medium text-zinc-900">OFF</span>
                    ：ビジネス向けです。コードや専門用語を避け、業務上の意味や流れを平易な言葉で説明します。
                  </p>
                  <p className="border-t border-zinc-200 pt-2 text-[10px] text-zinc-500">
                    メッセージを送るとこのトグルは非表示になり、会話中は変更できません。「新しい会話」で空の画面に戻すと、再度選べます。
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="max-w-56 text-[11px] leading-snug text-zinc-500">
            {developerMode
              ? "コード・技術詳細を含めて回答"
              : "平易な説明（ビジネス向け）"}
          </p>
        </div>
        <Switch
          id="developer-mode-empty"
          checked={developerMode}
          onCheckedChange={onDeveloperModeChange}
          aria-label="開発者モード"
        />
      </div>
    </TooltipProvider>
  );
}
