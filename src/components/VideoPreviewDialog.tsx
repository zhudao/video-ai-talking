import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { Button } from "./ui";

export function VideoPreviewDialog({
  title,
  src,
  kind = "video",
  mediaLabel,
  showDownload = true,
  onClose,
}: {
  title: string;
  src: string;
  kind?: "image" | "video";
  mediaLabel?: string;
  showDownload?: boolean;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      <button type="button" aria-label="关闭预览遮罩" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[96vh] w-[min(34rem,calc((96vh-7rem)*9/16),calc(100vw-1.5rem))] flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id={titleId} className="min-w-0 text-sm font-semibold">
            {title}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
        <div className="mx-auto aspect-[9/16] w-full max-h-[calc(96vh-7rem)] overflow-hidden rounded-lg bg-neutral-900">
          {kind === "image" ? (
            <img src={src} alt={mediaLabel ?? "素材预览"} className="h-full w-full object-contain" />
          ) : (
            <video
              aria-label={mediaLabel ?? "成片播放"}
              className="h-full w-full object-contain"
              src={src}
              controls
              autoPlay
            />
          )}
        </div>
        {showDownload ? (
          <a
            className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-card px-2 text-xs font-medium hover:bg-muted"
            href={src}
            download
            aria-label="下载成片"
          >
            下载
          </a>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
