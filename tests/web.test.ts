import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app.ts";
import { createRunner } from "../server/jobs/runner.ts";
import { createStore } from "../server/store.ts";

async function setup(withDist: boolean) {
  const root = await mkdtemp(path.join(os.tmpdir(), "vat-web-"));
  if (withDist) {
    await mkdir(path.join(root, "dist", "assets"), { recursive: true });
    await writeFile(path.join(root, "dist", "index.html"), "<!doctype html><title>AI真人口播视频生成</title>");
    await writeFile(path.join(root, "dist", "assets", "app.js"), "console.log('ok')");
  }
  const store = createStore(path.join(root, "data"));
  const runner = createRunner({
    store,
    projectRoot: root,
    detect: async () => undefined,
    synthesize: async () => ({ durationMs: 500, cues: [] }),
    render: async () => undefined,
  });
  const app = createApp({
    store,
    runner,
    projectRoot: root,
    testSpeech: async () => ({ durationMs: 500, cues: [] }),
    testAi: async () => undefined,
  });
  return { app };
}

describe("production web hosting", () => {
  it("serves the built page and assets from the same origin as the API", async () => {
    const { app } = await setup(true);
    const page = await app.request("/");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("AI真人口播视频生成");

    const asset = await app.request("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(await asset.text()).toContain("console.log");

    const health = await app.request("/api/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true });
  });

  it("falls unknown page routes back to the built index", async () => {
    const { app } = await setup(true);
    const page = await app.request("/library");
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("AI真人口播视频生成");
  });

  it("keeps API 404s when the frontend has not been built", async () => {
    const { app } = await setup(false);
    const health = await app.request("/api/health");
    expect(health.status).toBe(200);
    const page = await app.request("/");
    expect(page.status).toBe(404);
  });
});
