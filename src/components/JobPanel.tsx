import { api, type Job, type Template } from "@/lib/api";
import { Button } from "./ui";

const STAGE_LABEL: Record<Job["stage"], string> = {
  voice: "正在配音",
  lipsync: "正在对口型",
  video: "正在成片",
  done: "已完成",
  failed: "已失败",
};

const VIDEO_LABEL: Record<Job["videos"][number]["status"], string> = {
  pending: "等待中",
  voice: "配音中",
  lipsync: "对口型中",
  video: "成片中",
  done: "可下载",
  failed: "失败",
};

export function JobPanel({
  job,
  templates,
  onRegenerate,
  regenerating,
  compact = false,
}: {
  job: Job | null;
  templates: Template[];
  onRegenerate: () => void;
  regenerating: boolean;
  compact?: boolean;
}) {
  if (!job) {
    return (
      <p className="text-xs text-muted-foreground">
        {compact
          ? "这一轮还没开始生成。点「开始生成」后进度会出现在这里；历史成片请看「成片库」。"
          : "还没有任务。配好素材和文案后点「开始生成」。"}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {STAGE_LABEL[job.stage]} · {job.percent}%
        </p>
        {(job.stage === "failed" || job.stage === "done") && (
          <Button type="button" variant="secondary" size="sm" disabled={regenerating} onClick={onRegenerate}>
            {regenerating ? "重新生成中…" : "重新生成"}
          </Button>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${job.percent}%` }} />
      </div>
      {job.stage === "lipsync" ? (
        <p className="text-xs text-muted-foreground">百炼对口型通常要几分钟，请保持页面开着。</p>
      ) : null}
      {job.error && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-sans text-xs text-destructive">
          {job.error}
        </pre>
      )}
      <div className="space-y-1.5">
        {job.videos.map((video, index) => {
          const templateName = templates.find((item) => item.id === video.templateId)?.name ?? video.templateId;
          return (
            <div key={video.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">
                #{index + 1} {video.script.title} · {templateName} · {VIDEO_LABEL[video.status]}
              </span>
              {video.status === "done" && (
                <a className="shrink-0 text-primary underline-offset-2 hover:underline" href={api.fileUrl(job.id, video.id)} download>
                  下载
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
