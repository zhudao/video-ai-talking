import { useState } from "react";
import { api, type Job } from "@/lib/api";
import { VideoPreviewDialog } from "./VideoPreviewDialog";

export function OutputGallery({ job }: { job: Job | null }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const done = job?.videos.filter((item) => item.status === "done") ?? [];
  const current = done.find((item) => item.id === openId) ?? null;
  const currentIndex = current ? done.findIndex((item) => item.id === current.id) + 1 : 0;

  if (!job || done.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">成片</p>
      <div className="flex flex-wrap gap-3">
        {done.map((video, index) => {
          const title = video.script.title.trim() || `成片 ${index + 1}`;
          const href = api.fileUrl(job.id, video.id);
          return (
            <div key={video.id} className="flex w-[140px] flex-col gap-1.5">
              <button
                type="button"
                aria-label={`预览成片 #${index + 1} ${title}`}
                className="aspect-[9/16] w-full overflow-hidden rounded-xl border border-border bg-neutral-900"
                onClick={() => setOpenId(video.id)}
              >
                <video src={href} className="h-full w-full object-cover" muted preload="metadata" />
              </button>
              <a
                className="text-center text-xs text-primary underline-offset-2 hover:underline"
                href={href}
                download
                aria-label={`下载 #${index + 1} ${title}`}
              >
                下载
              </a>
            </div>
          );
        })}
      </div>
      {current ? (
        <VideoPreviewDialog
          title={`成片预览 #${currentIndex} ${current.script.title.trim() || `成片 ${currentIndex}`}`}
          src={api.fileUrl(job.id, current.id)}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}
