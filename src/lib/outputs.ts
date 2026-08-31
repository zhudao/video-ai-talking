import type { Job } from "./api";

export type FinishedOutput = {
  key: string;
  jobId: string;
  videoId: string;
  title: string;
  scriptBody: string;
  templateId: string;
  ttsProvider?: "volcengine" | "dashscope";
  voiceType?: string;
  createdAt: string;
  href: string;
};

export function listFinishedOutputs(jobs: Job[]): FinishedOutput[] {
  const items: FinishedOutput[] = [];
  const ordered = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const job of ordered) {
    for (const video of job.videos) {
      if (video.status !== "done") continue;
      const title = video.script.title.trim() || "未命名成片";
      items.push({
        key: `${job.id}:${video.id}`,
        jobId: job.id,
        videoId: video.id,
        title,
        scriptBody: video.script.body.trim(),
        templateId: video.templateId,
        ttsProvider: job.voice?.provider,
        voiceType: job.voice?.voiceType,
        createdAt: job.createdAt,
        href: `/api/jobs/${job.id}/file/${video.id}`,
      });
    }
  }
  return items;
}
