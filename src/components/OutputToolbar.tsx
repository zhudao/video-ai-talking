import { AlertCircle, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { completeScripts, type JobScript } from "@/lib/job-expand";
import { canStartJob, requirementStep, startBlockedReason, type RequirementTarget } from "@/lib/job-ready";
import type { AppConfig } from "@/lib/config";
import { Button } from "./ui";

export function OutputToolbar({
  config,
  hasReference,
  scripts,
  templateIds,
  busy,
  onStart,
  onRequirementClick,
  showTitle = true,
}: {
  config: AppConfig;
  hasReference: boolean;
  scripts: JobScript[];
  templateIds: string[];
  busy: boolean;
  onStart: () => void;
  onRequirementClick?: (step: RequirementTarget) => void;
  showTitle?: boolean;
}) {
  const ready = canStartJob({ config, hasReference, scripts, templateIds, showTitle });
  const blocked = startBlockedReason({ config, hasReference, scripts, templateIds, showTitle });
  const complete = completeScripts(scripts, { requireTitle: showTitle }).length > 0;

  return (
    <div className="flex min-w-0 flex-col items-stretch lg:items-end">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="text-sm font-medium tabular-nums text-foreground">
          {complete && hasReference && templateIds.length === 1 ? "将生成 1 条口播成片" : "还不能生成"}
        </p>
        <Button
          type="button"
          className={cn("h-9 gap-1 px-5", !ready && !busy && "bg-primary/15 text-primary hover:bg-primary/25")}
          disabled={!ready || busy}
          onClick={onStart}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : ready ? <Play className="size-4" /> : <AlertCircle className="size-4" />}
          {busy ? "正在生成…" : "开始生成"}
        </Button>
      </div>
      {blocked && (
        <button
          type="button"
          className="mt-1 text-left text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onRequirementClick?.(requirementStep(blocked))}
        >
          {blocked}
        </button>
      )}
    </div>
  );
}
