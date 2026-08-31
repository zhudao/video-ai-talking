import { useEffect, useState } from "react";
import type { Job, Template } from "@/lib/api";
import { listFinishedOutputs } from "@/lib/outputs";
import { formatJobVoice } from "@/lib/voices";
import { VideoPreviewDialog } from "./VideoPreviewDialog";
import { Button, Card } from "./ui";

export function OutputLibrary({
  open,
  jobs,
  templates,
  onClose,
  onDelete,
}: {
  open: boolean;
  jobs: Job[];
  templates: Template[];
  onClose: () => void;
  onDelete: (jobId: string, videoId: string) => Promise<void>;
}) {
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const items = listFinishedOutputs(jobs);
  const preview = items.find((item) => item.key === previewKey) ?? null;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !previewKey) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, previewKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button type="button" className="fixed inset-0 bg-foreground/40" aria-label="关闭成片库" onClick={onClose} />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="output-library-title"
        className="relative z-10 flex h-[92vh] max-h-[92vh] w-[min(88rem,96vw)] flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 id="output-library-title" className="text-base font-semibold">
              成片库
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">本机已生成的成片都会留在这里，可预览、下载或删除。</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有历史成片。生成完成后会出现在这里。</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((item) => {
                const templateName = templates.find((template) => template.id === item.templateId)?.name ?? item.templateId;
                const voiceLabel = formatJobVoice({
                  provider: item.ttsProvider,
                  voiceType: item.voiceType,
                });
                return (
                  <div key={item.key} className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      aria-label={`预览成片 ${item.title}`}
                      className="aspect-[9/16] w-full overflow-hidden rounded-lg border border-border bg-neutral-900"
                      onClick={() => setPreviewKey(item.key)}
                    >
                      <video src={item.href} className="h-full w-full object-cover" muted preload="metadata" />
                    </button>
                    <p className="truncate text-xs font-medium" title={item.title}>
                      {item.title}
                    </p>
                    <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground" title={item.scriptBody}>
                      {item.scriptBody || "未填写文案"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground" title={voiceLabel}>
                      配音 {voiceLabel}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">模板 {templateName}</p>
                    <div className="flex items-center justify-between gap-2">
                      <a
                        className="text-xs text-primary underline-offset-2 hover:underline"
                        href={item.href}
                        download
                        aria-label={`下载 ${item.title}`}
                      >
                        下载
                      </a>
                      {pendingDelete === item.key ? (
                        <button
                          type="button"
                          className="text-xs text-destructive"
                          aria-label={`确认删除 ${item.title}`}
                          onClick={() => void onDelete(item.jobId, item.videoId).then(() => setPendingDelete(null))}
                        >
                          确认删除
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          aria-label={`删除 ${item.title}`}
                          onClick={() => setPendingDelete(item.key)}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
      {preview ? (
        <VideoPreviewDialog
          title={`成片预览 ${preview.title}`}
          src={preview.href}
          onClose={() => setPreviewKey(null)}
        />
      ) : null}
    </div>
  );
}
