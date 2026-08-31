import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  VIDEORETALK_POLL_ATTEMPTS,
  VIDEORETALK_POLL_INTERVAL_MS,
  buildVideoretalkRequest,
  runVideoretalk,
} from "../server/lipsync/videoretalk.ts";
import { ossUrlFromKey } from "../server/upload/dashscope.ts";

describe("videoretalk", () => {
  it("builds an async request that resolves oss:// urls and extends short videos", () => {
    const req = buildVideoretalkRequest({
      videoUrl: "oss://dashscope-instant/a.mp4",
      audioUrl: "oss://dashscope-instant/b.mp3",
    });
    expect(req.headers["X-DashScope-OssResourceResolve"]).toBe("enable");
    expect(req.headers["X-DashScope-Async"]).toBe("enable");
    expect(req.body.parameters.video_extension).toBe(true);
    expect(req.body.input.video_url).toContain("oss://");
    expect(ossUrlFromKey("dashscope-instant/a.mp4")).toBe("oss://dashscope-instant/a.mp4");
  });

  it("downloads the result after a mocked poll succeeds", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "vat-lip-"));
    const outPath = path.join(dir, "out.mp4");
    let calls = 0;
    await runVideoretalk({
      apiKey: "sk-test",
      videoUrl: "oss://v",
      audioUrl: "oss://a",
      outPath,
      pollAttempts: 3,
      pollIntervalMs: 0,
      fetchImpl: async (url) => {
        calls += 1;
        const href = String(url);
        if (href.includes("video-synthesis")) {
          return new Response(JSON.stringify({ output: { task_id: "t1" } }), { status: 200 });
        }
        if (href.includes("/tasks/t1")) {
          return new Response(
            JSON.stringify({ output: { task_status: "SUCCEEDED", video_url: "https://example.com/out.mp4" } }),
            { status: 200 },
          );
        }
        return new Response("mp4-bytes", { status: 200 });
      },
    });
    expect(await readFile(outPath, "utf8")).toBe("mp4-bytes");
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it("waits long enough for a real DashScope lipsync job", () => {
    expect(VIDEORETALK_POLL_INTERVAL_MS).toBe(10_000);
    expect(VIDEORETALK_POLL_ATTEMPTS).toBe(120);
    expect(VIDEORETALK_POLL_ATTEMPTS * VIDEORETALK_POLL_INTERVAL_MS).toBe(20 * 60 * 1000);
  });

  it("keeps polling through PENDING before timing out", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "vat-lip-"));
    await expect(
      runVideoretalk({
        apiKey: "sk-test",
        videoUrl: "oss://v",
        audioUrl: "oss://a",
        outPath: path.join(dir, "out.mp4"),
        pollAttempts: 2,
        pollIntervalMs: 0,
        fetchImpl: async (url) => {
          const href = String(url);
          if (href.includes("video-synthesis")) {
            return new Response(JSON.stringify({ output: { task_id: "t-pending" } }), { status: 200 });
          }
          return new Response(JSON.stringify({ output: { task_status: "PENDING" } }), { status: 200 });
        },
      }),
    ).rejects.toMatchObject({
      code: "lipsync_failed",
      message: expect.stringContaining("VideoRetalk 等待超时"),
    });
  });
});
