import { writeFile } from "node:fs/promises";
import { AppError } from "../errors.ts";
import { VIDEORETALK_MODEL } from "../upload/dashscope.ts";

export const VIDEORETALK_SUBMIT_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis/";
export const VIDEORETALK_TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks";
export const VIDEORETALK_POLL_INTERVAL_MS = 10_000;
export const VIDEORETALK_POLL_ATTEMPTS = 120;

type FetchLike = typeof fetch;

export function buildVideoretalkRequest(input: { videoUrl: string; audioUrl: string }) {
  return {
    url: VIDEORETALK_SUBMIT_URL,
    headers: {
      Authorization: "",
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
      "X-DashScope-OssResourceResolve": "enable",
    },
    body: {
      model: VIDEORETALK_MODEL,
      input: {
        video_url: input.videoUrl,
        audio_url: input.audioUrl,
        ref_image_url: "",
      },
      parameters: { video_extension: true },
    },
  };
}

export async function runVideoretalk(input: {
  apiKey: string;
  videoUrl: string;
  audioUrl: string;
  outPath: string;
  fetchImpl?: FetchLike;
  pollAttempts?: number;
  pollIntervalMs?: number;
}): Promise<{ durationHint: number }> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new AppError("lipsync_failed", "请填写阿里百炼 API Key");
  const fetchImpl = input.fetchImpl ?? fetch;
  const req = buildVideoretalkRequest({ videoUrl: input.videoUrl, audioUrl: input.audioUrl });
  const submit = await fetchImpl(req.url, {
    method: "POST",
    headers: { ...req.headers, Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(req.body),
  });
  if (!submit.ok) {
    throw new AppError("lipsync_failed", `VideoRetalk 提交失败（HTTP ${submit.status}）`);
  }
  const submitted = (await submit.json()) as { output?: { task_id?: string } };
  const taskId = submitted.output?.task_id;
  if (!taskId) throw new AppError("lipsync_failed", "VideoRetalk 未返回任务 ID");

  const attempts = input.pollAttempts ?? VIDEORETALK_POLL_ATTEMPTS;
  const interval = input.pollIntervalMs ?? VIDEORETALK_POLL_INTERVAL_MS;
  for (let i = 0; i < attempts; i += 1) {
    if (interval > 0) await new Promise((resolve) => setTimeout(resolve, interval));
    const poll = await fetchImpl(`${VIDEORETALK_TASK_URL}/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!poll.ok) continue;
    const body = (await poll.json()) as {
      output?: { task_status?: string; video_url?: string; results?: { video_url?: string }; message?: string };
    };
    const status = (body.output?.task_status ?? "").toUpperCase();
    if (status === "SUCCEEDED") {
      const videoUrl = body.output?.results?.video_url || body.output?.video_url;
      if (!videoUrl) throw new AppError("lipsync_failed", "VideoRetalk 成功但没有成片地址");
      const file = await fetchImpl(videoUrl);
      if (!file.ok) throw new AppError("lipsync_failed", "下载对口型成片失败");
      await writeFile(input.outPath, Buffer.from(await file.arrayBuffer()));
      return { durationHint: 0 };
    }
    if (status === "FAILED") {
      throw new AppError("lipsync_failed", body.output?.message || "VideoRetalk 任务失败");
    }
  }
  const waitedMs = attempts * interval;
  const waited =
    waitedMs >= 60_000 ? `${Math.round(waitedMs / 60_000)} 分钟` : `${Math.round(waitedMs / 1000)} 秒`;
  throw new AppError("lipsync_failed", `VideoRetalk 等待超时（已等 ${waited}）`);
}
