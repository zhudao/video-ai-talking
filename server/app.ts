import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { generateScripts, testDeepSeek } from "./ai/deepseek.ts";
import { AppError, errorBody } from "./errors.ts";
import { pickLocalFiles } from "./file-picker.ts";
import type { Runner } from "./jobs/runner.ts";
import type { MaterialKind, MaterialRecord, Store } from "./store.ts";
import { loadTemplates } from "./templates.ts";
import { synthesizeDashscope } from "./tts/dashscope.ts";
import { synthesizeSpeech } from "./tts/volcengine.ts";
import { getDashscopeUploadPolicy } from "./upload/dashscope.ts";
import { VOICE_PREVIEW_TEXT } from "../src/lib/voices.ts";

export type AppDeps = {
  store: Store;
  runner: Runner;
  projectRoot: string;
  testSpeech?: typeof synthesizeSpeech;
  testDashscope?: typeof synthesizeDashscope;
  testVideoretalk?: (apiKey: string) => Promise<void>;
  testAi?: typeof testDeepSeek;
  generate?: typeof generateScripts;
  pickFiles?: () => Promise<string[] | null>;
};

function guessMime(filename: string, mime: string): string {
  if (mime && mime !== "application/octet-stream") return mime;
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".m4v") return "video/mp4";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/mp4";
  return mime || "application/octet-stream";
}

function publicMaterial(item: MaterialRecord) {
  return {
    ...item,
    url: `/files/materials/${item.id}.${item.ext}`,
  };
}

function isFileLike(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).name === "string"
  );
}

function parseKinds(value: unknown): MaterialKind[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const kinds = value.filter((item): item is MaterialKind => item === "image" || item === "video" || item === "audio");
  return kinds.length > 0 ? kinds : undefined;
}

function asFiles(value: unknown): File[] {
  if (Array.isArray(value)) return value.filter(isFileLike);
  if (isFileLike(value)) return [value];
  return [];
}

export const MAX_MATERIAL_BYTES = 80 * 1024 * 1024;

export function assertMaterialFileSize(size: number): void {
  if (size > MAX_MATERIAL_BYTES) {
    throw new AppError("invalid_material", "单个文件不能超过 80MB");
  }
}

export function createApp(deps: AppDeps) {
  const { store, runner, projectRoot } = deps;
  const speech = deps.testSpeech ?? synthesizeSpeech;
  const dashscope = deps.testDashscope ?? synthesizeDashscope;
  const pingVideoretalk = deps.testVideoretalk ?? (async (apiKey: string) => {
    await getDashscopeUploadPolicy(apiKey);
  });
  const pingAi = deps.testAi ?? testDeepSeek;
  const writeScripts = deps.generate ?? generateScripts;
  const pickFiles = deps.pickFiles ?? pickLocalFiles;

  const app = new Hono();
  app.use(
    "*",
    cors({
      origin: ["http://127.0.0.1:5175", "http://localhost:5175"],
    }),
  );

  app.onError((error, c) => {
    const body = errorBody(error);
    return c.json({ error: body.error, message: body.message }, body.status as 400);
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.post("/api/ai/test", async (c) => {
    const body = await c.req.json<{ apiKey?: string }>();
    await pingAi(body.apiKey ?? "");
    return c.json({ ok: true });
  });

  app.post("/api/videoretalk/test", async (c) => {
    const body = await c.req.json<{ apiKey?: string }>();
    await pingVideoretalk(body.apiKey ?? "");
    return c.json({ ok: true });
  });

  app.post("/api/tts/test", async (c) => {
    const body = await c.req.json<{
      provider?: string;
      appId?: string;
      accessToken?: string;
      voiceType?: string;
      apiKey?: string;
    }>();
    await store.ensureDirs();
    const outPath = path.join(store.tmpDir, `tts-test-${Date.now()}.mp3`);
    if (body.provider === "dashscope") {
      if (!body.apiKey || !body.voiceType) {
        throw new AppError("invalid_tts", "请填写阿里百炼 API Key 和音色");
      }
      await dashscope({
        apiKey: body.apiKey,
        voiceType: body.voiceType,
        text: "连接测试",
        outPath,
      });
      return c.json({ ok: true });
    }
    if (!body.appId || !body.accessToken || !body.voiceType) {
      throw new AppError("invalid_tts", "请填写 App ID、Access Token 和音色");
    }
    await speech({
      appId: body.appId,
      accessToken: body.accessToken,
      voiceType: body.voiceType,
      text: "连接测试",
      outPath,
    });
    return c.json({ ok: true });
  });

  app.post("/api/tts/preview", async (c) => {
    const body = await c.req.json<{
      provider?: string;
      appId?: string;
      accessToken?: string;
      voiceType?: string;
      apiKey?: string;
    }>();
    await store.ensureDirs();
    const outPath = path.join(store.tmpDir, `tts-preview-${Date.now()}.mp3`);
    if (body.provider === "dashscope") {
      if (!body.apiKey || !body.voiceType) {
        throw new AppError("invalid_tts", "请填写阿里百炼 API Key 和音色");
      }
      await dashscope({
        apiKey: body.apiKey,
        voiceType: body.voiceType,
        text: VOICE_PREVIEW_TEXT,
        outPath,
      });
    } else {
      if (!body.appId || !body.accessToken || !body.voiceType) {
        throw new AppError("invalid_tts", "请填写 App ID、Access Token 和音色");
      }
      await speech({
        appId: body.appId,
        accessToken: body.accessToken,
        voiceType: body.voiceType,
        text: VOICE_PREVIEW_TEXT,
        outPath,
      });
    }
    return c.body(await readFile(outPath), 200, { "Content-Type": "audio/mpeg" });
  });

  app.get("/api/templates", (c) => c.json({ templates: loadTemplates(projectRoot) }));

  app.get("/api/materials", async (c) => {
    const items = await store.readMaterials();
    return c.json({
      materials: items.map(publicMaterial),
    });
  });

  app.post("/api/materials", async (c) => {
    const form = await c.req.formData();
    const files = asFiles(form.getAll("file"));
    if (files.length === 0) {
      throw new AppError("invalid_material", "请选择要上传的文件");
    }
    const materials = [];
    for (const file of files) {
      assertMaterialFileSize(file.size);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const record = await store.addMaterial({
        filename: file.name,
        mime: guessMime(file.name, file.type),
        bytes,
      });
      materials.push(publicMaterial(record));
    }
    return c.json({ materials, material: materials[0] });
  });

  app.post("/api/materials/link/browse", async (c) => {
    let kinds: MaterialKind[] | undefined;
    try {
      const body = await c.req.json<{ kinds?: unknown }>();
      kinds = parseKinds(body.kinds);
    } catch {
      kinds = undefined;
    }
    const selected = await pickFiles();
    if (!selected || selected.length === 0) {
      return c.json({ cancelled: true, added: 0, skipped: 0, truncated: false, materials: [] });
    }
    const result = await store.importFiles(selected, { kinds });
    return c.json({
      cancelled: false,
      added: result.added.length,
      skipped: result.skipped,
      truncated: result.truncated,
      materials: result.added.map(publicMaterial),
    });
  });

  app.post("/api/materials/link", async (c) => {
    const body = await c.req.json<{ paths?: string[]; kinds?: unknown }>();
    const result = await store.importFiles(body.paths ?? [], { kinds: parseKinds(body.kinds) });
    return c.json({
      added: result.added.length,
      skipped: result.skipped,
      truncated: result.truncated,
      materials: result.added.map(publicMaterial),
    });
  });

  app.delete("/api/materials", async (c) => {
    const result = await store.clearVisualMaterials();
    return c.json({ ok: true, removed: result.removed });
  });

  app.delete("/api/materials/:id", async (c) => {
    await store.deleteMaterial(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.get("/files/materials/:filename", async (c) => {
    const filename = c.req.param("filename");
    const id = filename.replace(/\.[^.]+$/, "");
    const item = await store.getMaterial(id);
    const filePath = store.materialPath(item);
    try {
      await access(filePath);
    } catch {
      throw new AppError("not_found", "原文件已不存在，请重新添加素材", 404);
    }
    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": item.mime || "application/octet-stream",
      },
    });
  });

  app.post("/api/scripts/generate", async (c) => {
    const body = await c.req.json<{ apiKey?: string; topic?: string; count?: number; durationSec?: number }>();
    return c.json(
      await writeScripts({
        apiKey: body.apiKey ?? "",
        topic: body.topic ?? "",
        count: body.count,
        durationSec: body.durationSec,
      }),
    );
  });

  app.get("/api/jobs", async (c) => c.json({ jobs: await store.listJobs() }));

  app.post("/api/jobs", async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const tts = (body.tts ?? {}) as Record<string, string>;
    const job = await runner.createJob({
      tts: {
        provider: tts.provider === "dashscope" ? "dashscope" : "volcengine",
        appId: tts.appId ?? "",
        accessToken: tts.accessToken ?? "",
        voiceType: tts.voiceType ?? "",
        apiKey: tts.apiKey ?? "",
      },
      videoretalkApiKey: String(body.videoretalkApiKey ?? ""),
      referenceVideoId: String(body.referenceVideoId ?? ""),
      scripts: Array.isArray(body.scripts) ? (body.scripts as { title: string; body: string }[]) : [],
      templateIds: Array.isArray(body.templateIds) ? body.templateIds.map(String) : [],
      showTitle: body.showTitle !== false,
      showSubtitle: body.showSubtitle !== false,
      bgmMaterialId: body.bgmMaterialId ? String(body.bgmMaterialId) : null,
    });
    return c.json({ job });
  });

  app.get("/api/jobs/:id", async (c) => c.json({ job: await store.readJob(c.req.param("id")) }));

  app.post("/api/jobs/:id/regenerate", async (c) => {
    const body = await c.req.json<{ tts?: Record<string, string>; videoretalkApiKey?: string }>();
    const tts = body.tts ?? {};
    const job = await runner.regenerateJob(
      c.req.param("id"),
      {
        provider: tts.provider === "dashscope" ? "dashscope" : "volcengine",
        appId: tts.appId ?? "",
        accessToken: tts.accessToken ?? "",
        voiceType: tts.voiceType ?? "",
        apiKey: tts.apiKey ?? "",
      },
      String(body.videoretalkApiKey ?? ""),
    );
    return c.json({ job });
  });

  app.delete("/api/jobs/:id/file/:videoId", async (c) => {
    await store.deleteOutput(c.req.param("id"), c.req.param("videoId"));
    return c.json({ ok: true });
  });

  app.get("/api/jobs/:id/file/:videoId", async (c) => {
    const job = await store.readJob(c.req.param("id"));
    const video = job.videos.find((item) => item.id === c.req.param("videoId"));
    if (!video || video.status !== "done") {
      throw new AppError("not_found", "成片还不存在", 404);
    }
    return c.redirect(`/files/outputs/${job.id}/${video.id}.mp4`);
  });

  app.use(
    "/files/outputs/*",
    serveStatic({
      root: store.outputsDir,
      rewriteRequestPath: (p) => p.replace("/files/outputs", ""),
    }),
  );

  const webRoot = path.join(projectRoot, "dist");
  app.use(
    "/assets/*",
    serveStatic({
      root: webRoot,
    }),
  );
  app.get("*", async (c, next) => {
    const pathname = new URL(c.req.url).pathname;
    if (pathname.startsWith("/api") || pathname.startsWith("/files") || pathname.startsWith("/assets")) {
      return next();
    }
    try {
      return c.html(await readFile(path.join(webRoot, "index.html"), "utf8"));
    } catch {
      return c.notFound();
    }
  });

  return app;
}
