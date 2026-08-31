import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./ui";

function Switch({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
      )}
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-card shadow-sm transition-[left]",
          checked ? "left-4" : "left-0.5",
        )}
      />
    </button>
  );
}

export function VisibilityControls({
  showTitle,
  showSubtitle,
  onShowTitleChange,
  onShowSubtitleChange,
}: {
  showTitle: boolean;
  showSubtitle: boolean;
  onShowTitleChange: (next: boolean) => void;
  onShowSubtitleChange: (next: boolean) => void;
}) {
  const [pending, setPending] = useState<"title" | "subtitle" | null>(null);
  const pendingLabel = pending === "title" ? "标题" : "字幕";

  function requestChange(role: "title" | "subtitle", next: boolean) {
    if (next) {
      if (role === "title") onShowTitleChange(true);
      else onShowSubtitleChange(true);
      return;
    }
    setPending(role);
  }

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>显示标题</span>
          <Switch checked={showTitle} label="显示标题" onCheckedChange={(next) => requestChange("title", next)} />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>显示字幕</span>
          <Switch checked={showSubtitle} label="显示字幕" onCheckedChange={(next) => requestChange("subtitle", next)} />
        </label>
        <span className="text-[10px] text-muted-foreground/75">会同步影响最终成片</span>
      </div>
      {pending ? (
        <div className="rounded-lg border border-border bg-muted/40 p-2 text-xs">
          <p>关闭后，最终成片将不再显示{pendingLabel}。确定关闭吗？</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setPending(null)}>
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (pending === "title") onShowTitleChange(false);
                else onShowSubtitleChange(false);
                setPending(null);
              }}
            >
              确认关闭
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
