import { mkdirSync } from "node:fs";
import { mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "./errors.ts";

export type MaterialKind = "image" | "video" | "audio";
export type MaterialSource = "upload" | "linked";

export type MaterialRecord = {
  id: string;
  filename: string;
  mime: string;
  kind: MaterialKind;
  ext: string;
  createdAt: string;
  source: MaterialSource;
  sourcePath?: string;
};

const MAX_LINKED_FILES = 200;

const MEDIA_EXT: Record<string, { mime: string; kind: MaterialKind; ext: string }> = {
  jpg: { mime: "image/jpeg", kind: "image", ext: "jpg" },
  jpeg: { mime: "image/jpeg", kind: "image", ext: "jpg" },
  png: { mime: "image/png", kind: "image", ext: "png" },
  webp: { mime: "image/webp", kind: "image", ext: "webp" },
  gif: { mime: "image/gif", kind: "image", ext: "gif" },
  mp4: { mime: "video/mp4", kind: "video", ext: "mp4" },
  webm: { mime: "video/webm", kind: "video", ext: "webm" },
  mov: { mime: "video/quicktime", kind: "video", ext: "mov" },
  m4v: { mime: "video/mp4", kind: "video", ext: "m4v" },
  mp3: { mime: "audio/mpeg", kind: "audio", ext: "mp3" },
  wav: { mime: "audio/wav", kind: "audio", ext: "wav" },
  m4a: { mime: "audio/mp4", kind: "audio", ext: "m4a" },
};

export type JobVideoStatus = "pending" | "voice" | "lipsync" | "video" | "done" | "failed";

export type JobVideo = {
  id: string;
  script: { title: string; body: string; captions?: { id: string; text: string; cutaway?: boolean; materialId?: string }[] };
  templateId: string;
  materialIds: string[];
  referenceVideoId?: string;
  status: JobVideoStatus;
  error?: string;
};

export type JobStage = "voice" | "lipsync" | "video" | "done" | "failed";

export type JobRecord = {
  id: string;
  stage: JobStage;
  percent: number;
  error?: string;
  errorCode?: string;
  videos: JobVideo[];
  materialIds: string[];
  templateIds: string[];
  referenceVideoId?: string;
  lipsyncFingerprint?: string;
  bgmMaterialId: string | null;
  showTitle?: boolean;
  showSubtitle?: boolean;
  voice?: { provider?: "volcengine" | "dashscope"; voiceType?: string };
  createdAt: string;
  updatedAt: string;
};

const SECRET_FIELDS = new Set([
  "apiKey",
  "accessToken",
  "ttsAccessToken",
  "dashscopeApiKey",
  "videoretalkApiKey",
  "authorization",
  "token",
  "tts",
]);

export function stripSecrets<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripSecrets(item)) as T;
  }
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_FIELDS.has(key)) continue;
    out[key] = stripSecrets(item);
  }
  return out as T;
}

export function kindFromMime(mime: string): MaterialKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  throw new AppError("invalid_material", "只支持图片、视频或音频文件");
}

export function extFromFilename(filename: string, mime: string): string {
  const fromName = path.extname(filename).replace(".", "").toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  if (mime === "image/gif") return "gif";
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "audio/wav" || mime === "audio/x-wav") return "wav";
  return "bin";
}

export function createStore(rootDir: string) {
  const materialsDir = path.join(rootDir, "materials");
  const jobsDir = path.join(rootDir, "jobs");
  const outputsDir = path.join(rootDir, "outputs");
  const tmpDir = path.join(rootDir, "tmp");
  const materialsIndex = path.join(rootDir, "materials.json");

  mkdirSync(materialsDir, { recursive: true });
  mkdirSync(jobsDir, { recursive: true });
  mkdirSync(outputsDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  async function ensureDirs(): Promise<void> {
    await mkdir(materialsDir, { recursive: true });
    await mkdir(jobsDir, { recursive: true });
    await mkdir(outputsDir, { recursive: true });
    await mkdir(tmpDir, { recursive: true });
  }

  async function readMaterials(): Promise<MaterialRecord[]> {
    await ensureDirs();
    try {
      const raw = await readFile(materialsIndex, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as MaterialRecord[]) : [];
    } catch {
      return [];
    }
  }

  async function writeMaterials(items: MaterialRecord[]): Promise<void> {
    await ensureDirs();
    await writeFile(materialsIndex, JSON.stringify(items, null, 2));
  }

  function storedCopyPath(item: MaterialRecord): string {
    return path.join(materialsDir, `${item.id}.${item.ext}`);
  }

  function materialPath(item: MaterialRecord): string {
    return item.sourcePath ?? storedCopyPath(item);
  }

  async function addMaterial(input: {
    filename: string;
    mime: string;
    bytes: Uint8Array;
  }): Promise<MaterialRecord> {
    const kind = kindFromMime(input.mime);
    const ext = extFromFilename(input.filename, input.mime);
    const record: MaterialRecord = {
      id: randomUUID(),
      filename: input.filename,
      mime: input.mime,
      kind,
      ext,
      createdAt: new Date().toISOString(),
      source: "upload",
    };
    await ensureDirs();
    await writeFile(storedCopyPath(record), input.bytes);
    const items = await readMaterials();
    items.unshift(record);
    await writeMaterials(items);
    return record;
  }

  async function importFiles(
    inputPaths: string[],
    opts?: { kinds?: MaterialKind[] },
  ): Promise<{ added: MaterialRecord[]; skipped: number; truncated: boolean }> {
    const allowed = opts?.kinds && opts.kinds.length > 0 ? new Set(opts.kinds) : null;
    const existing = await readMaterials();
    const known = new Set(existing.flatMap((item) => (item.sourcePath ? [item.sourcePath] : [])));
    const added: MaterialRecord[] = [];
    let skipped = 0;
    let truncated = false;

    for (const inputPath of inputPaths) {
      if (added.length >= MAX_LINKED_FILES) {
        truncated = true;
        break;
      }
      const trimmed = inputPath.trim();
      if (!trimmed || !path.isAbsolute(trimmed)) {
        throw new AppError("invalid_material", "请选择本机文件");
      }
      let resolved: string;
      try {
        resolved = await realpath(trimmed);
      } catch {
        throw new AppError("invalid_material", "找不到这个文件");
      }
      const info = await stat(resolved);
      if (!info.isFile()) {
        throw new AppError("invalid_material", "请选择文件，而不是文件夹");
      }
      const ext = path.extname(resolved).slice(1).toLowerCase();
      const meta = MEDIA_EXT[ext];
      if (!meta || (allowed && !allowed.has(meta.kind))) {
        skipped += 1;
        continue;
      }
      if (known.has(resolved)) {
        skipped += 1;
        continue;
      }
      const record: MaterialRecord = {
        id: randomUUID(),
        filename: path.basename(resolved),
        mime: meta.mime,
        kind: meta.kind,
        ext: meta.ext,
        createdAt: new Date().toISOString(),
        source: "linked",
        sourcePath: resolved,
      };
      added.push(record);
      known.add(resolved);
    }

    if (added.length === 0 && skipped === 0) {
      throw new AppError("invalid_material", "没有可用的图片、视频或音频文件");
    }
    if (added.length > 0) {
      await writeMaterials([...added, ...existing]);
    }
    return { added, skipped, truncated };
  }

  async function deleteMaterial(id: string): Promise<void> {
    const items = await readMaterials();
    const found = items.find((item) => item.id === id);
    if (!found) throw new AppError("not_found", "素材不存在", 404);
    if (!found.sourcePath) {
      await rm(storedCopyPath(found), { force: true });
    }
    await writeMaterials(items.filter((item) => item.id !== id));
  }

  async function clearVisualMaterials(): Promise<{ removed: number }> {
    const items = await readMaterials();
    const kept: MaterialRecord[] = [];
    let removed = 0;
    for (const item of items) {
      if (item.kind === "audio") {
        kept.push(item);
        continue;
      }
      if (!item.sourcePath) {
        await rm(storedCopyPath(item), { force: true });
      }
      removed += 1;
    }
    await writeMaterials(kept);
    return { removed };
  }

  async function getMaterial(id: string): Promise<MaterialRecord> {
    const items = await readMaterials();
    const found = items.find((item) => item.id === id);
    if (!found) throw new AppError("not_found", "素材不存在", 404);
    return found;
  }

  function jobPath(id: string): string {
    return path.join(jobsDir, `${id}.json`);
  }

  async function saveJob(job: JobRecord): Promise<JobRecord> {
    const clean = stripSecrets(job);
    if ("tts" in (clean as Record<string, unknown>) || "apiKey" in (clean as Record<string, unknown>)) {
      throw new AppError("storage_failed", "任务不能包含密钥");
    }
    await ensureDirs();
    const next = { ...clean, updatedAt: new Date().toISOString() };
    const target = jobPath(next.id);
    const temp = `${target}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(next, null, 2));
    await rename(temp, target);
    return next;
  }

  async function readJob(id: string): Promise<JobRecord> {
    try {
      const raw = await readFile(jobPath(id), "utf8");
      return JSON.parse(raw) as JobRecord;
    } catch {
      throw new AppError("not_found", "任务不存在", 404);
    }
  }

  async function failInterruptedJobs(message = "服务重启后任务已中断，请重新生成"): Promise<void> {
    const jobs = await listJobs();
    for (const job of jobs) {
      if (job.stage === "voice" || job.stage === "lipsync" || job.stage === "video") {
        job.stage = "failed";
        job.error = message;
        job.errorCode = "interrupted";
        const current = job.videos.find((item) => item.status !== "done");
        if (current) current.status = "failed";
        await saveJob(job);
      }
    }
  }

  async function listJobs(): Promise<JobRecord[]> {
    await ensureDirs();
    const names = await readdir(jobsDir);
    const jobs: JobRecord[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      try {
        jobs.push(JSON.parse(await readFile(path.join(jobsDir, name), "utf8")) as JobRecord);
      } catch {
        // skip broken file
      }
    }
    return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function outputPath(jobId: string, videoId: string): string {
    return path.join(outputsDir, jobId, `${videoId}.mp4`);
  }

  function voicePath(jobId: string, videoId: string): string {
    return path.join(tmpDir, jobId, `${videoId}.mp3`);
  }

  function lipsyncPath(jobId: string, videoId: string): string {
    return path.join(tmpDir, jobId, `${videoId}.lipsync.mp4`);
  }

  async function ensureJobTmp(jobId: string): Promise<void> {
    await mkdir(path.join(tmpDir, jobId), { recursive: true });
    await mkdir(path.join(outputsDir, jobId), { recursive: true });
  }

  async function deleteOutput(jobId: string, videoId: string): Promise<void> {
    const job = await readJob(jobId);
    const video = job.videos.find((item) => item.id === videoId);
    if (!video || video.status !== "done") {
      throw new AppError("not_found", "成片还不存在", 404);
    }
    await rm(outputPath(jobId, videoId), { force: true });
    const videos = job.videos.filter((item) => item.id !== videoId);
    if (videos.length === 0) {
      await rm(jobPath(jobId), { force: true });
      await rm(path.join(outputsDir, jobId), { recursive: true, force: true });
      return;
    }
    await saveJob({ ...job, videos });
  }

  return {
    rootDir,
    materialsDir,
    jobsDir,
    outputsDir,
    tmpDir,
    ensureDirs,
    readMaterials,
    addMaterial,
    importFiles,
    deleteMaterial,
    clearVisualMaterials,
    getMaterial,
    materialPath,
    saveJob,
    readJob,
    listJobs,
    failInterruptedJobs,
    outputPath,
    voicePath,
    lipsyncPath,
    ensureJobTmp,
    deleteOutput,
  };
}

export type Store = ReturnType<typeof createStore>;
