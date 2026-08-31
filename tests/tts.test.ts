import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildTtsRequest, synthesizeSpeech, VOLC_TTS_URL } from "../server/tts/volcengine.ts";
import { DASHSCOPE_TTS_URL, buildDashscopeRequest, synthesizeDashscope } from "../server/tts/dashscope.ts";

describe("volcengine tts", () => {
  it("builds the public HTTP endpoint and keeps token only in the request", () => {
    const req = buildTtsRequest({
      appId: "app",
      accessToken: "secret-token",
      voiceType: "BV001_streaming",
      text: "你好",
      reqid: "req-1",
    });
    expect(req.url).toBe(VOLC_TTS_URL);
    expect(req.headers.Authorization).toBe("Bearer;secret-token");
    expect(req.body.request.text).toBe("你好");
    expect(req.body.audio.voice_type).toBe("BV001_streaming");
    expect(req.body.user.uid).toBe("video-ai-talking");
  });

  it("writes mocked audio and returns a full-text cue", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qm-tts-"));
    const outPath = path.join(dir, "out.mp3");
    const audio = Buffer.from("fake-mp3").toString("base64");
    const result = await synthesizeSpeech({
      appId: "app",
      accessToken: "tok",
      voiceType: "BV001",
      text: "厨房收纳",
      outPath,
      fetchImpl: async (url, init) => {
        expect(String(url)).toBe(VOLC_TTS_URL);
        const body = JSON.parse(String(init?.body)) as { request: { text: string } };
        expect(body.request.text).toBe("厨房收纳");
        return new Response(JSON.stringify({ code: 3000, data: audio, addition: { duration: "1800" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    expect(result.durationMs).toBe(1800);
    expect(result.cues[0]).toMatchObject({ text: "厨房收纳", startMs: 0, endMs: 1800 });
    expect(await readFile(outPath, "utf8")).toBe("fake-mp3");
  });

  it("explains grant-not-found and keeps the raw SaaS payload", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qm-tts-"));
    const raw = {
      reqid: "req-1",
      code: 3001,
      message: "load grant: requested grant not found in SaaS storage",
    };
    await expect(
      synthesizeSpeech({
        appId: "app",
        accessToken: "tok",
        voiceType: "BV001",
        text: "厨房收纳",
        outPath: path.join(dir, "out.mp3"),
        fetchImpl: async () =>
          new Response(JSON.stringify(raw), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }),
      }),
    ).rejects.toMatchObject({
      code: "tts_failed",
      message: expect.stringMatching(
        /【火山语音合成】[\s\S]*App ID[\s\S]*原始返回：[\s\S]*requested grant not found in SaaS storage/,
      ),
    });
  });

  it("keeps the raw payload when the SaaS response has no audio", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qm-tts-"));
    await expect(
      synthesizeSpeech({
        appId: "app",
        accessToken: "tok",
        voiceType: "BV001",
        text: "厨房收纳",
        outPath: path.join(dir, "out.mp3"),
        fetchImpl: async () =>
          new Response(JSON.stringify({ code: 3000, message: "ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      }),
    ).rejects.toMatchObject({
      code: "tts_failed",
      message: expect.stringMatching(/【火山语音合成】[\s\S]*没有返回音频[\s\S]*原始返回：[\s\S]*"code":3000/),
    });
  });
});

describe("dashscope tts", () => {
  it("builds the 百炼 SpeechSynthesizer request", () => {
    const req = buildDashscopeRequest({
      apiKey: "sk-bai",
      voiceType: "longanyang",
      text: "你好",
    });
    expect(req.url).toBe(DASHSCOPE_TTS_URL);
    expect(req.headers.Authorization).toBe("Bearer sk-bai");
    expect(req.body.model).toBe("cosyvoice-v3-flash");
    expect(req.body.input.voice).toBe("longanyang");
    expect(req.body.input.text).toBe("你好");
  });

  it("writes mocked audio from output.audio.data", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qm-ds-"));
    const outPath = path.join(dir, "out.mp3");
    const audio = Buffer.from("dash-mp3").toString("base64");
    const result = await synthesizeDashscope({
      apiKey: "sk-bai",
      voiceType: "longanyang",
      text: "厨房收纳",
      outPath,
      fetchImpl: async () =>
        new Response(JSON.stringify({ output: { audio: { data: audio } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    expect(result.durationMs).toBeGreaterThan(0);
    expect(await readFile(outPath, "utf8")).toBe("dash-mp3");
  });

  it("explains dashscope HTTP errors and keeps the raw payload", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qm-ds-"));
    const raw = { code: "InvalidApiKey", message: "No API key provided." };
    await expect(
      synthesizeDashscope({
        apiKey: "sk-bai",
        voiceType: "longanyang",
        text: "厨房收纳",
        outPath: path.join(dir, "out.mp3"),
        fetchImpl: async () =>
          new Response(JSON.stringify(raw), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
      }),
    ).rejects.toMatchObject({
      code: "tts_failed",
      message: expect.stringMatching(/【阿里百炼语音合成】[\s\S]*API Key[\s\S]*原始返回：[\s\S]*InvalidApiKey/),
    });
  });
});
