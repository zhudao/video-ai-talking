import { randomUUID } from "node:crypto";
import { access, stat } from "node:fs/promises";
import { cuesFromScript, expandJob, JobExpandError } from "../../src/lib/job-expand.ts";
import { captionTimeline } from "../../src/lib/broll-timeline.ts";
import { canReuseLipsync, lipsyncFingerprint, spokenBodyFromScript } from "../../src/lib/lipsync-fingerprint.ts";
import { AppError } from "../errors.ts";
import { logInfo } from "../log.ts";
import { detectFfmpeg, buildTalkingFfmpegArgs, probeDurationMs, runFfmpeg } from "../render/ffmpeg.ts";
import type { Store, JobRecord, JobVideo } from "../store.ts";
import { requireTemplate } from "../templates.ts";
import { synthesizeDashscope } from "../tts/dashscope.ts";
import { synthesizeSpeech as synthesizeVolc, type TtsCredentials } from "../tts/volcengine.ts";
import { uploadLocalFileToDashscope } from "../upload/dashscope.ts";
import { runVideoretalk } from "../lipsync/videoretalk.ts";

export type CreateJobInput = {
  tts: TtsCredentials;
  videoretalkApiKey: string;
  referenceVideoId: string;
  scripts: { title: string; body: string; captions?: { id: string; text: string; cutaway?: boolean; materialId?: string }[] }[];
  templateIds: string[];
  bgmMaterialId?: string | null;
  showTitle?: boolean;
  showSubtitle?: boolean;
};

export type RunnerDeps = {
  store: Store;
  projectRoot?: string;
  synthesize?: typeof synthesizeVolc;
  render?: (args: string[]) => Promise<void>;
  detect?: typeof detectFfmpeg;
  uploadFile?: typeof uploadLocalFileToDashscope;
  lipsync?: typeof runVideoretalk;
  probe?: typeof probeDurationMs;
};

export function createRunner(deps: RunnerDeps) {
  const store = deps.store;
  const synthesize =
    deps.synthesize ??
    (async (input) => {
      if ((input.provider ?? "volcengine") === "dashscope") {
        return synthesizeDashscope({
          apiKey: input.apiKey ?? "",
          voiceType: input.voiceType,
          text: input.text,
          outPath: input.outPath,
        });
      }
      return synthesizeVolc(input);
    });
  const render = deps.render ?? runFfmpeg;
  const detect = deps.detect ?? detectFfmpeg;
  const uploadFile = deps.uploadFile ?? uploadLocalFileToDashscope;
  const lipsync = deps.lipsync ?? runVideoretalk;
  const probe = deps.probe ?? probeDurationMs;
  const projectRoot = deps.projectRoot ?? process.cwd();

  let busyJobId: string | null = null;

  function assertNotBusy(): void {
    if (busyJobId) {
      throw new AppError("job_busy", "已有任务正在生成，请等当前任务结束后再开始");
    }
  }

  async function persist(job: JobRecord): Promise<JobRecord> {
    return store.saveJob(job);
  }

  function progress(job: JobRecord): number {
    if (job.stage === "done") return 100;
    if (job.stage === "video") return 80;
    if (job.stage === "lipsync") return 50;
    if (job.stage === "voice") return 20;
    return 0;
  }

  async function materialStamp(id: string): Promise<string> {
    const record = await store.getMaterial(id);
    const file = store.materialPath(record);
    const info = await stat(file);
    return `${info.size}:${Math.round(info.mtimeMs)}`;
  }

  async function runJob(jobId: string, tts: TtsCredentials, videoretalkApiKey: string, forceLipsync = false): Promise<void> {
    busyJobId = jobId;
    let job: JobRecord | null = null;
    try {
      job = await store.readJob(jobId);
      await detect();
      await store.ensureJobTmp(jobId);
      const video = job.videos[0];
      if (!video) throw new AppError("render_failed", "任务条目丢失");
      const referenceId = job.referenceVideoId || video.referenceVideoId;
      if (!referenceId) throw new AppError("invalid_reference", "请添加一段口播真人视频");
      const reference = await store.getMaterial(referenceId);
      if (reference.kind !== "video") {
        throw new AppError("invalid_reference", "口播真人视频必须是视频");
      }
      const stamp = await materialStamp(referenceId);
      const nextFp = lipsyncFingerprint({
        referenceId,
        referenceStamp: stamp,
        spokenBody: spokenBodyFromScript(video.script),
        ttsProvider: tts.provider ?? "volcengine",
        voiceType: tts.voiceType,
      });
      const lipsyncFile = store.lipsyncPath(jobId, video.id);
      let lipsyncReady = false;
      if (!forceLipsync) {
        try {
          await access(lipsyncFile);
          lipsyncReady = canReuseLipsync({
            previous: job.lipsyncFingerprint,
            next: nextFp,
            lipsyncExists: true,
          });
        } catch {
          lipsyncReady = false;
        }
      }

      if (!lipsyncReady) {
        job.stage = "voice";
        job.error = undefined;
        job.errorCode = undefined;
        job.percent = progress(job);
        job = await persist(job);
        const voiceFile = store.voicePath(jobId, video.id);
        await synthesize({
          ...tts,
          text: video.script.body,
          outPath: voiceFile,
        });

        job.stage = "lipsync";
        job.videos[0] = { ...video, status: "lipsync" };
        job.percent = progress(job);
        job = await persist(job);
        if (!videoretalkApiKey.trim()) {
          throw new AppError("lipsync_failed", "对口型需要先填写 AI口播对口型配置");
        }
        const videoOss = await uploadFile({ apiKey: videoretalkApiKey, filePath: store.materialPath(reference) });
        const audioOss = await uploadFile({ apiKey: videoretalkApiKey, filePath: voiceFile });
        await lipsync({
          apiKey: videoretalkApiKey,
          videoUrl: videoOss,
          audioUrl: audioOss,
          outPath: lipsyncFile,
        });
        job.lipsyncFingerprint = nextFp;
        job = await persist(job);
      }

      job.stage = "video";
      job.videos[0] = { ...job.videos[0]!, status: "video" };
      job.percent = progress(job);
      job = await persist(job);

      const template = requireTemplate(video.templateId, projectRoot);
      let bgmPath: string | null = null;
      if (job.bgmMaterialId) {
        const bgm = await store.getMaterial(job.bgmMaterialId);
        if (bgm.kind !== "audio") throw new AppError("invalid_materials", "BGM 必须是音频文件");
        bgmPath = store.materialPath(bgm);
      }
      const voiceFile = store.voicePath(jobId, video.id);
      let durationMs = Math.max(video.script.body.length * 220, 2000);
      try {
        durationMs = await probe(voiceFile);
      } catch {
        try {
          durationMs = await probe(lipsyncFile);
        } catch {
          // keep estimate
        }
      }
      const clips = captionTimeline(video.script.captions ?? [], durationMs);
      const talkingClips = [];
      for (const clip of clips) {
        if (clip.source === "broll" && clip.materialId) {
          const material = await store.getMaterial(clip.materialId);
          talkingClips.push({
            startMs: clip.startMs,
            endMs: clip.endMs,
            source: "broll" as const,
            path: store.materialPath(material),
            kind: material.kind === "image" ? "image" as const : "video" as const,
          });
        } else {
          talkingClips.push({
            startMs: clip.startMs,
            endMs: clip.endMs,
            source: "face" as const,
          });
        }
      }
      const args = buildTalkingFfmpegArgs({
        lipsyncPath: lipsyncFile,
        clips: talkingClips,
        audioPath: voiceFile,
        title: video.script.title,
        subtitleCues: cuesFromScript(video.script, durationMs),
        bgmPath,
        template,
        outPath: store.outputPath(jobId, video.id),
        durationMs,
        showTitle: job.showTitle !== false,
        showSubtitle: job.showSubtitle !== false,
      });
      await render(args);
      job.videos[0] = { ...job.videos[0]!, status: "done" };
      job.stage = "done";
      job.percent = 100;
      await persist(job);
      logInfo("job done", { id: jobId });
    } catch (error) {
      const code = error instanceof AppError ? error.code : "render_failed";
      const message = error instanceof Error ? error.message : "生成失败";
      if (job) {
        job.stage = "failed";
        job.error = message;
        job.errorCode = code;
        if (job.videos[0]) job.videos[0].status = "failed";
        await persist(job);
      }
      logInfo("job failed", { id: jobId, code, message });
    } finally {
      if (busyJobId === jobId) busyJobId = null;
    }
  }

  async function createJob(input: CreateJobInput): Promise<JobRecord> {
    assertNotBusy();
    busyJobId = "pending";
    try {
      const provider = input.tts.provider ?? "volcengine";
      if (provider === "dashscope") {
        if (!input.tts.apiKey || !input.tts.voiceType) {
          throw new AppError("invalid_tts", "请先填写阿里百炼 API Key 和音色");
        }
      } else if (!input.tts.appId || !input.tts.accessToken || !input.tts.voiceType) {
        throw new AppError("invalid_tts", "请先填写火山 TTS 的 App ID、Access Token 和音色");
      }
      if (!input.videoretalkApiKey.trim()) {
        throw new AppError("lipsync_failed", "对口型需要先填写 AI口播对口型配置");
      }
      const reference = await store.getMaterial(input.referenceVideoId);
      if (reference.kind !== "video") {
        throw new AppError("invalid_reference", "口播真人视频必须是视频");
      }
      if (input.bgmMaterialId) {
        const bgm = await store.getMaterial(input.bgmMaterialId);
        if (bgm.kind !== "audio") throw new AppError("invalid_materials", "BGM 必须是音频文件");
      }

      let rows;
      try {
        rows = expandJob({
          scripts: input.scripts,
          templateIds: input.templateIds,
          referenceVideoId: reference.id,
          requireTitle: input.showTitle !== false,
        });
      } catch (error) {
        if (error instanceof JobExpandError) {
          throw new AppError(error.code, error.message);
        }
        throw error;
      }

      const videos: JobVideo[] = rows.map((row) => ({
        id: randomUUID(),
        script: row.script,
        templateId: row.templateId,
        materialIds: [],
        referenceVideoId: row.referenceVideoId,
        status: "pending",
      }));

      const now = new Date().toISOString();
      const job: JobRecord = {
        id: randomUUID(),
        stage: "voice",
        percent: 0,
        videos,
        materialIds: [],
        templateIds: input.templateIds.slice(0, 1),
        referenceVideoId: reference.id,
        bgmMaterialId: input.bgmMaterialId ?? null,
        showTitle: input.showTitle !== false,
        showSubtitle: input.showSubtitle !== false,
        voice: { provider, voiceType: input.tts.voiceType },
        createdAt: now,
        updatedAt: now,
      };
      const saved = await persist(job);
      void runJob(saved.id, input.tts, input.videoretalkApiKey);
      return saved;
    } catch (error) {
      busyJobId = null;
      throw error;
    }
  }

  async function regenerateJob(id: string, tts: TtsCredentials, videoretalkApiKey: string): Promise<JobRecord> {
    assertNotBusy();
    busyJobId = "pending";
    try {
      const provider = tts.provider ?? "volcengine";
      if (provider === "dashscope") {
        if (!tts.apiKey || !tts.voiceType) {
          throw new AppError("invalid_tts", "重新生成需要再次提供阿里百炼凭证");
        }
      } else if (!tts.appId || !tts.accessToken || !tts.voiceType) {
        throw new AppError("invalid_tts", "重新生成需要再次提供 TTS 凭证");
      }
      if (!videoretalkApiKey.trim()) {
        throw new AppError("lipsync_failed", "对口型需要先填写 AI口播对口型配置");
      }
      const existing = await store.readJob(id);
      const next: JobRecord = {
        ...existing,
        stage: "voice",
        percent: 0,
        error: undefined,
        errorCode: undefined,
        videos: existing.videos.map((video) => ({ ...video, status: "pending", error: undefined })),
        voice: { provider, voiceType: tts.voiceType },
        updatedAt: new Date().toISOString(),
      };
      const saved = await persist(next);
      void runJob(saved.id, tts, videoretalkApiKey);
      return saved;
    } catch (error) {
      busyJobId = null;
      throw error;
    }
  }

  return {
    createJob,
    regenerateJob,
    isBusy: () => Boolean(busyJobId),
    runJob,
  };
}

export type Runner = ReturnType<typeof createRunner>;
