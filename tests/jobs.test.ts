import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app.ts";
import { AppError } from "../server/errors.ts";
import { createRunner } from "../server/jobs/runner.ts";
import { createStore } from "../server/store.ts";

const tts = { appId: "app", accessToken: "tok", voiceType: "BV001" };
const videoretalkApiKey = "sk-lip";

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), "vat-job-"));
  const store = createStore(root);
  const video = await store.addMaterial({
    filename: "ref.mp4",
    mime: "video/mp4",
    bytes: new Uint8Array([1, 2, 3, 4]),
  });
  const rendered: string[] = [];
  let lipsyncCalls = 0;
  const runner = createRunner({
    store,
    projectRoot: process.cwd(),
    detect: async () => undefined,
    synthesize: async (input) => {
      await writeFile(input.outPath, "voice");
      return { durationMs: 1200, cues: [{ text: input.text, startMs: 0, endMs: 1200 }] };
    },
    uploadFile: async () => "oss://tmp/file",
    probe: async () => 1200,
    lipsync: async (input) => {
      lipsyncCalls += 1;
      await writeFile(input.outPath, "lipsync");
    },
    render: async (args) => {
      rendered.push(args.at(-1) ?? "");
      const out = args.at(-1);
      if (out) await writeFile(out, "mp4");
    },
  });
  const app = createApp({
    store,
    runner,
    projectRoot: process.cwd(),
    testSpeech: async () => ({ durationMs: 500, cues: [] }),
    testAi: async () => undefined,
  });
  return {
    store,
    runner,
    app,
    video,
    rendered,
    root,
    lipsyncCount: () => lipsyncCalls,
  };
}

async function waitDone(store: ReturnType<typeof createStore>, id: string) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const job = await store.readJob(id);
      if (job.stage === "done" || job.stage === "failed") return job;
    } catch {
      // write may still be landing
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return store.readJob(id);
}

describe("jobs runner", () => {
  it("creates one talking job, writes no secrets, and renders one file", async () => {
    const { store, runner, video, rendered } = await setup();
    const job = await runner.createJob({
      tts,
      videoretalkApiKey,
      referenceVideoId: video.id,
      scripts: [
        { title: "一", body: "正文一" },
        { title: "二", body: "正文二" },
      ],
      templateIds: ["red-bold", "plain-white"],
    });
    expect(job.videos).toHaveLength(1);
    expect(job.referenceVideoId).toBe(video.id);
    expect(job.voice).toEqual({ provider: "volcengine", voiceType: "BV001" });
    const done = await waitDone(store, job.id);
    expect(done.stage).toBe("done");
    expect(done.videos.map((item) => item.status)).toEqual(["done"]);
    expect(rendered).toHaveLength(1);
    const disk = await readFile(path.join(store.jobsDir, `${job.id}.json`), "utf8");
    expect(disk).not.toContain("tok");
    expect(disk).not.toContain("accessToken");
    expect(disk).not.toContain("sk-test");
  });

  it("skips VideoRetalk on regenerate when the lipsync fingerprint is unchanged", async () => {
    const { store, runner, video, rendered, lipsyncCount } = await setup();
    const job = await runner.createJob({
      tts,
      videoretalkApiKey,
      referenceVideoId: video.id,
      scripts: [{ title: "一", body: "正文" }],
      templateIds: ["red-bold"],
    });
    expect((await waitDone(store, job.id)).stage).toBe("done");
    expect(lipsyncCount()).toBe(1);
    const again = await runner.regenerateJob(job.id, tts, videoretalkApiKey);
    expect(again.id).toBe(job.id);
    expect((await waitDone(store, job.id)).stage).toBe("done");
    expect(lipsyncCount()).toBe(1);
    expect(rendered).toHaveLength(2);
  });

  it("rejects a second job while busy", async () => {
    const { store, video } = await setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const runner = createRunner({
      store,
      projectRoot: process.cwd(),
      detect: async () => undefined,
      synthesize: async () => {
        await gate;
        return { durationMs: 800, cues: [] };
      },
      uploadFile: async () => "oss://tmp/file",
      probe: async () => 800,
      lipsync: async () => undefined,
      render: async () => undefined,
    });
    const first = runner.createJob({
      tts,
      videoretalkApiKey,
      referenceVideoId: video.id,
      scripts: [{ title: "一", body: "正文" }],
      templateIds: ["red-bold"],
    });
    await first;
    await expect(
      runner.createJob({
        tts,
        videoretalkApiKey,
        referenceVideoId: video.id,
        scripts: [{ title: "二", body: "正文" }],
        templateIds: ["red-bold"],
      }),
    ).rejects.toMatchObject({ code: "job_busy" });
    release();
  });

  it("records failure message and regenerate overwrites the same job", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "vat-job-"));
    const store = createStore(root);
    const video = await store.addMaterial({
      filename: "ref.mp4",
      mime: "video/mp4",
      bytes: new Uint8Array([1, 2, 3, 4]),
    });
    let shouldFail = true;
    const runner = createRunner({
      store,
      projectRoot: process.cwd(),
      detect: async () => undefined,
      synthesize: async (input) => {
        if (shouldFail) throw new AppError("tts_failed", "音色不可用");
        await writeFile(input.outPath, "voice");
        return { durationMs: 900, cues: [] };
      },
      uploadFile: async () => "oss://tmp/file",
      probe: async () => 900,
      lipsync: async (input) => {
        await writeFile(input.outPath, "lipsync");
      },
      render: async (args) => {
        const out = args.at(-1);
        if (out) await writeFile(out, "mp4");
      },
    });
    const job = await runner.createJob({
      tts,
      videoretalkApiKey,
      referenceVideoId: video.id,
      scripts: [{ title: "一", body: "正文" }],
      templateIds: ["red-bold"],
    });
    const failed = await waitDone(store, job.id);
    expect(failed.stage).toBe("failed");
    expect(failed.error).toContain("音色不可用");
    shouldFail = false;
    const again = await runner.regenerateJob(job.id, tts, videoretalkApiKey);
    expect(again.id).toBe(job.id);
    const done = await waitDone(store, job.id);
    expect(done.stage).toBe("done");
  });

  it("uses the VideoRetalk key for upload and lipsync, not the CosyVoice key", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "vat-job-"));
    const store = createStore(root);
    const video = await store.addMaterial({
      filename: "ref.mp4",
      mime: "video/mp4",
      bytes: new Uint8Array([1, 2, 3, 4]),
    });
    const uploaded: string[] = [];
    const lipsyncKeys: string[] = [];
    const ttsKeys: string[] = [];
    const runner = createRunner({
      store,
      projectRoot: process.cwd(),
      detect: async () => undefined,
      synthesize: async (input) => {
        ttsKeys.push(input.apiKey ?? "");
        await writeFile(input.outPath, "voice");
        return { durationMs: 900, cues: [] };
      },
      uploadFile: async (input) => {
        uploaded.push(input.apiKey);
        return "oss://tmp/file";
      },
      probe: async () => 900,
      lipsync: async (input) => {
        lipsyncKeys.push(input.apiKey);
        await writeFile(input.outPath, "lipsync");
      },
      render: async (args) => {
        const out = args.at(-1);
        if (out) await writeFile(out, "mp4");
      },
    });
    const job = await runner.createJob({
      tts: { provider: "dashscope", apiKey: "sk-tts", voiceType: "longanyang" },
      videoretalkApiKey: "sk-lip",
      referenceVideoId: video.id,
      scripts: [{ title: "一", body: "正文" }],
      templateIds: ["red-bold"],
    });
    const done = await waitDone(store, job.id);
    expect(done.stage).toBe("done");
    expect(ttsKeys).toEqual(["sk-tts"]);
    expect(uploaded).toEqual(["sk-lip", "sk-lip"]);
    expect(lipsyncKeys).toEqual(["sk-lip"]);
  });

  it("exposes job HTTP create and snapshot", async () => {
    const { app, video, store } = await setup();
    const created = await app.request("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tts,
        videoretalkApiKey,
        referenceVideoId: video.id,
        scripts: [{ title: "一", body: "正文" }],
        templateIds: ["red-bold"],
      }),
    });
    expect(created.status).toBe(200);
    const body = (await created.json()) as { job: { id: string } };
    const done = await waitDone(store, body.job.id);
    const snap = await app.request(`/api/jobs/${done.id}`);
    expect(snap.status).toBe(200);
    const listed = await app.request("/api/templates");
    expect((await listed.json() as { templates: unknown[] }).templates).toHaveLength(8);
  });

  it("deletes a finished output through HTTP", async () => {
    const { app, store } = await setup();
    await store.saveJob({
      id: "job-del",
      stage: "done",
      percent: 100,
      videos: [
        {
          id: "v1",
          script: { title: "成片", body: "正文" },
          templateId: "red-bold",
          materialIds: [],
          status: "done",
        },
      ],
      materialIds: [],
      templateIds: ["red-bold"],
      bgmMaterialId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await store.ensureJobTmp("job-del");
    await writeFile(store.outputPath("job-del", "v1"), "mp4");
    const deleted = await app.request("/api/jobs/job-del/file/v1", { method: "DELETE" });
    expect(deleted.status).toBe(200);
    await expect(store.readJob("job-del")).rejects.toMatchObject({ code: "not_found" });
  });
});
