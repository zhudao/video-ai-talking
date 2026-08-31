import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app.ts";
import { createRunner } from "../server/jobs/runner.ts";
import { mockAppOverrides, mockRunnerOverrides } from "../server/mock-mode.ts";
import { createStore } from "../server/store.ts";

async function waitDone(app: ReturnType<typeof createApp>, id: string) {
  for (let i = 0; i < 80; i += 1) {
    const snap = await app.request(`/api/jobs/${id}`);
    const body = (await snap.json()) as { job: { stage: string; error?: string; videos: { status: string }[] } };
    if (body.job.stage === "done" || body.job.stage === "failed") return body.job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("job did not finish");
}

describe("http e2e with mocked providers", () => {
  it("links a reference video, generates one script, and finishes one talking job", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "vat-e2e-"));
    const store = createStore(path.join(root, "data"));
    const ref = path.join(root, "face.mp4");
    await writeFile(ref, "fake-video");
    const app = createApp({
      store,
      runner: createRunner({
        store,
        projectRoot: process.cwd(),
        ...mockRunnerOverrides(),
      }),
      projectRoot: process.cwd(),
      ...mockAppOverrides(),
    });

    expect((await (await app.request("/api/health")).json()).ok).toBe(true);
    const templates = (await (await app.request("/api/templates")).json()) as { templates: { id: string }[] };
    expect(templates.templates.some((item) => item.id === "red-bold")).toBe(true);

    const ai = await app.request("/api/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "sk-mock" }),
    });
    expect(ai.status).toBe(200);

    const tts = await app.request("/api/tts/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "dashscope", apiKey: "sk-mock", voiceType: "longanyang" }),
    });
    expect(tts.status).toBe(200);

    const lipsync = await app.request("/api/videoretalk/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "sk-lip" }),
    });
    expect(lipsync.status).toBe(200);

    const generated = await app.request("/api/scripts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "sk-mock", topic: "周末到店", count: 3 }),
    });
    expect(generated.status).toBe(200);
    const scripts = (await generated.json()) as { scripts: { title: string; body: string }[] };
    expect(scripts.scripts).toHaveLength(1);

    const linked = await app.request("/api/materials/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: [ref], kinds: ["video"] }),
    });
    expect(linked.status).toBe(200);
    const materials = (await linked.json()) as { materials: { id: string }[] };
    const referenceVideoId = materials.materials[0]?.id;
    expect(referenceVideoId).toBeTruthy();

    const created = await app.request("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tts: {
          provider: "volcengine",
          appId: "app",
          accessToken: "tok",
          voiceType: "BV001",
        },
        videoretalkApiKey: "sk-lip",
        referenceVideoId,
        scripts: scripts.scripts,
        templateIds: ["red-bold"],
      }),
    });
    expect(created.status).toBe(200);
    const job = (await created.json()) as { job: { id: string; videos: unknown[] } };
    expect(job.job.videos).toHaveLength(1);
    const done = await waitDone(app, job.job.id);
    expect(done.stage).toBe("done");
    expect(done.videos[0]?.status).toBe("done");

    const file = await app.request(`/api/jobs/${job.job.id}/file/${(await store.readJob(job.job.id)).videos[0]!.id}`);
    expect(file.status).toBe(302);

    const disk = await readFile(path.join(store.jobsDir, `${job.job.id}.json`), "utf8");
    expect(disk).not.toContain("tok");
    expect(disk).not.toContain("sk-mock");
    expect(disk).not.toContain("sk-lip");
  });
});
