import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../server/app.ts";
import { createRunner } from "../server/jobs/runner.ts";
import { createStore } from "../server/store.ts";
import { VOICE_PREVIEW_TEXT } from "../src/lib/voices.ts";

async function setup(opts?: {
  testSpeech?: (input: { text: string; voiceType: string; outPath: string }) => Promise<{ durationMs: number; cues: [] }>;
  testDashscope?: (input: { text: string; voiceType: string; outPath: string }) => Promise<{ durationMs: number; cues: [] }>;
}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "qm-prev-"));
  const store = createStore(root);
  const runner = createRunner({
    store,
    projectRoot: process.cwd(),
    detect: async () => undefined,
    synthesize: async () => ({ durationMs: 500, cues: [] }),
    render: async () => undefined,
  });
  const app = createApp({
    store,
    runner,
    projectRoot: process.cwd(),
    testSpeech: opts?.testSpeech ?? (async ({ outPath }) => {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(outPath, "volc-preview");
      return { durationMs: 500, cues: [] };
    }),
    testDashscope: opts?.testDashscope ?? (async ({ outPath }) => {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(outPath, "dash-preview");
      return { durationMs: 500, cues: [] };
    }),
    testAi: async () => undefined,
  });
  return { app, root };
}

describe("tts preview api", () => {
  it("returns synthesized audio for a short preview sentence", async () => {
    let seen = "";
    const { app } = await setup({
      testSpeech: async ({ text, voiceType, outPath }) => {
        seen = `${voiceType}:${text}`;
        const { writeFile } = await import("node:fs/promises");
        await writeFile(outPath, "volc-preview");
        return { durationMs: 800, cues: [] };
      },
    });
    const res = await app.request("/api/tts/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "volcengine",
        appId: "app",
        accessToken: "tok",
        voiceType: "BV001_streaming",
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/audio\/mpeg/);
    expect(await res.text()).toBe("volc-preview");
    expect(seen).toBe(`BV001_streaming:${VOICE_PREVIEW_TEXT}`);
  });

  it("previews dashscope with the same short sentence", async () => {
    let seen = "";
    const { app } = await setup({
      testDashscope: async ({ text, voiceType, outPath }) => {
        seen = `${voiceType}:${text}`;
        const { writeFile } = await import("node:fs/promises");
        await writeFile(outPath, "dash-preview");
        return { durationMs: 800, cues: [] };
      },
    });
    const res = await app.request("/api/tts/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "dashscope",
        apiKey: "sk-bai",
        voiceType: "longanyang",
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("dash-preview");
    expect(seen).toBe(`longanyang:${VOICE_PREVIEW_TEXT}`);
  });

  it("rejects preview without credentials", async () => {
    const { app } = await setup();
    const res = await app.request("/api/tts/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "volcengine", voiceType: "BV001_streaming" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_tts" });
  });
});
