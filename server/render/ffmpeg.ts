import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { AppError, formatToolFailure } from "../errors.ts";
import type { Cue } from "../tts/volcengine.ts";
import type { TemplateSkin } from "../../src/lib/templates.ts";

export const FRAME_W = 1080;
export const FRAME_H = 1920;

export type RenderMaterial = {
  path: string;
  kind: "image" | "video";
};

export type TalkingClip = {
  startMs: number;
  endMs: number;
  source: "face" | "broll";
  path?: string;
  kind?: "image" | "video";
};

export type BuildTalkingFfmpegArgsInput = {
  lipsyncPath: string;
  clips: TalkingClip[];
  audioPath: string;
  title: string;
  subtitleCues: Cue[];
  bgmPath?: string | null;
  template: TemplateSkin;
  outPath: string;
  durationMs: number;
  fontFile?: string | null;
  showTitle?: boolean;
  showSubtitle?: boolean;
};

export type BuildFfmpegArgsInput = {
  materials: RenderMaterial[];
  audioPath: string;
  title: string;
  subtitleCues: Cue[];
  bgmPath?: string | null;
  template: TemplateSkin;
  outPath: string;
  durationMs: number;
  fontFile?: string | null;
  showTitle?: boolean;
  showSubtitle?: boolean;
};

const FONT_CANDIDATES = [
  "/System/Library/Fonts/PingFang.ttc",
  "/System/Library/Fonts/Hiragino Sans GB.ttc",
  "/System/Library/Fonts/STHeiti Light.ttc",
  "/Library/Fonts/Arial Unicode.ttf",
  "C:/Windows/Fonts/msyh.ttc",
  "C:/Windows/Fonts/msyh.ttf",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
  "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
];

export function findSystemFont(candidates = FONT_CANDIDATES): string | null {
  return candidates.find((file) => existsSync(file)) ?? null;
}

export function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\u2019")
    .replace(/:/g, "\\:")
    .replace(/%/g, "%%")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n");
}

const PUNCT_BREAK = /[，。！？；、,.!?;]/;

export function overlayCharsPerLine(fontSize: number, borderW = 0, boxBorderW = 0): number {
  const sidePad = FRAME_W * 0.16;
  const usable = FRAME_W - sidePad - (borderW + boxBorderW) * 2;
  const glyph = fontSize * 1.05;
  return Math.max(6, Math.floor(usable / glyph));
}

export function wrapLines(text: string, charsPerLine: number): string[] {
  const chars = [...text.replace(/\s+/g, " ").trim()];
  if (chars.length === 0) return [];
  if (chars.length <= charsPerLine) return [chars.join("")];
  const lines: string[] = [];
  let remaining = chars;
  const minBreak = Math.max(2, Math.ceil(charsPerLine * 0.4));
  while (remaining.length > 0 && lines.length < 3) {
    if (remaining.length <= charsPerLine) {
      lines.push(remaining.join(""));
      break;
    }
    let breakAt = charsPerLine;
    for (let i = charsPerLine - 1; i >= minBreak; i -= 1) {
      if (PUNCT_BREAK.test(remaining[i] ?? "")) {
        breakAt = i + 1;
        break;
      }
    }
    lines.push(remaining.slice(0, breakAt).join(""));
    remaining = remaining.slice(breakAt);
  }
  return lines;
}

export function wrapLine(text: string, charsPerLine: number): string {
  return wrapLines(text, charsPerLine).join("\n");
}

export function subtitleCharsPerLine(fontSize: number, borderW = 0): number {
  return overlayCharsPerLine(fontSize, borderW);
}

function scaleFilter(fit: "cover" | "contain"): string {
  if (fit === "contain") {
    return `scale=${FRAME_W}:${FRAME_H}:force_original_aspect_ratio=decrease,pad=${FRAME_W}:${FRAME_H}:(ow-iw)/2:(oh-ih)/2:color=0xF4F1EA,setsar=1`;
  }
  return `scale=${FRAME_W}:${FRAME_H}:force_original_aspect_ratio=increase,crop=${FRAME_W}:${FRAME_H},setsar=1`;
}

function drawtextFilter(
  look: TemplateSkin["title"],
  text: string,
  fontFile: string | null,
  enable?: string,
): string {
  const parts = [
    `drawtext=text='${escapeDrawtext(text)}'`,
    `fontsize=${look.fontSize}`,
    `fontcolor=${look.color}`,
    `borderw=${look.borderW}`,
    `bordercolor=${look.borderColor}`,
    "x=(w-text_w)/2",
    `y=${look.yExpr}`,
    "line_spacing=10",
  ];
  if (look.boxColor) {
    parts.push("box=1", `boxcolor=${look.boxColor}`);
    if (look.boxBorderW) parts.push(`boxborderw=${look.boxBorderW}`);
  }
  if (fontFile) parts.push(`fontfile='${escapeDrawtext(fontFile)}'`);
  if (enable) parts.push(`enable='${enable}'`);
  return parts.join(":");
}

export function buildTalkingFfmpegArgs(input: BuildTalkingFfmpegArgsInput): string[] {
  const durationSec = Math.max(input.durationMs / 1000, 1);
  const fontFile = input.fontFile === undefined ? findSystemFont() : input.fontFile;
  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error", "-i", input.lipsyncPath];
  const brollKeys: string[] = [];
  for (const clip of input.clips) {
    if (clip.source !== "broll" || !clip.path) continue;
    if (brollKeys.includes(clip.path)) continue;
    brollKeys.push(clip.path);
    if (clip.kind === "image") {
      args.push("-loop", "1", "-i", clip.path);
    } else {
      args.push("-stream_loop", "-1", "-an", "-i", clip.path);
    }
  }
  args.push("-i", input.audioPath);
  if (input.bgmPath) args.push("-stream_loop", "-1", "-i", input.bgmPath);

  const filters: string[] = [];
  const labels: string[] = [];
  input.clips.forEach((clip, index) => {
    const dur = Math.max((clip.endMs - clip.startMs) / 1000, 0.04);
    const label = `s${index}`;
    if (clip.source === "broll" && clip.path) {
      const inputIndex = 1 + brollKeys.indexOf(clip.path);
      filters.push(
        `[${inputIndex}:v]${scaleFilter(input.template.mediaFit)},trim=duration=${dur.toFixed(3)},setpts=PTS-STARTPTS[${label}]`,
      );
    } else {
      const start = (clip.startMs / 1000).toFixed(3);
      const end = (clip.endMs / 1000).toFixed(3);
      filters.push(
        `[0:v]${scaleFilter(input.template.mediaFit)},trim=${start}:${end},setpts=PTS-STARTPTS[${label}]`,
      );
    }
    labels.push(`[${label}]`);
  });
  if (labels.length === 0) {
    filters.push(`[0:v]${scaleFilter(input.template.mediaFit)}[vcat]`);
  } else {
    filters.push(`${labels.join("")}concat=n=${labels.length}:v=1:a=0[vcat]`);
  }

  const showTitle = input.showTitle !== false;
  const showSubtitle = input.showSubtitle !== false;
  let last = "vcat";
  let overlay = 0;
  function pushDraw(
    look: TemplateSkin["title"],
    text: string,
    yExpr: string,
    enable?: string,
    final = false,
  ): void {
    const out = final ? "vout" : `vt${overlay}`;
    overlay += 1;
    filters.push(`[${last}]${drawtextFilter({ ...look, yExpr }, text, fontFile, enable)}[${out}]`);
    last = out;
  }
  if (showTitle && input.title.trim()) {
    const titleLook = input.template.title;
    const titleLines = wrapLines(
      input.title,
      overlayCharsPerLine(titleLook.fontSize, titleLook.borderW, titleLook.boxBorderW ?? 0),
    );
    titleLines.forEach((line, index) => {
      const y = index === 0 ? input.template.title.yExpr : `${input.template.title.yExpr}+${index * (input.template.title.fontSize + 10)}`;
      pushDraw(input.template.title, line, y);
    });
  }
  const cues = showSubtitle ? input.subtitleCues.filter((cue) => cue.text.trim()) : [];
  const perLine = overlayCharsPerLine(
    input.template.subtitle.fontSize,
    input.template.subtitle.borderW,
    input.template.subtitle.boxBorderW ?? 0,
  );
  const lineHeight = input.template.subtitle.fontSize + 10;
  const subtitleOverlays = cues.flatMap((cue) =>
    wrapLines(cue.text, perLine).map((line, lineIndex) => ({ cue, line, lineIndex })),
  );
  if (subtitleOverlays.length === 0) {
    filters.push(`[${last}]copy[vout]`);
  } else {
    subtitleOverlays.forEach((item, index) => {
      const start = (item.cue.startMs / 1000).toFixed(3);
      const end = (item.cue.endMs / 1000).toFixed(3);
      const y =
        item.lineIndex === 0
          ? input.template.subtitle.yExpr
          : `${input.template.subtitle.yExpr}+${item.lineIndex * lineHeight}`;
      pushDraw(
        input.template.subtitle,
        item.line,
        y,
        `between(t\\,${start}\\,${end})`,
        index === subtitleOverlays.length - 1,
      );
    });
  }

  const voiceIndex = 1 + brollKeys.length;
  filters.push(
    `[${voiceIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=0:${durationSec.toFixed(3)},asetpts=PTS-STARTPTS[voice]`,
  );
  if (input.bgmPath) {
    filters.push(
      `[${voiceIndex + 1}:a]volume=0.18,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=0:${durationSec.toFixed(3)},asetpts=PTS-STARTPTS[bgm]`,
    );
    filters.push("[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]");
  } else {
    filters.push("[voice]anull[aout]");
  }

  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-t",
    durationSec.toFixed(3),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    input.outPath,
  );
  return args;
}

export function buildFfmpegArgs(input: BuildFfmpegArgsInput): string[] {
  if (input.materials.length === 0) {
    throw new AppError("render_failed", "没有可用于成片的素材");
  }
  const durationSec = Math.max(input.durationMs / 1000, 1);
  const slice = durationSec / input.materials.length;
  const fontFile = input.fontFile === undefined ? findSystemFont() : input.fontFile;
  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"];

  input.materials.forEach((material) => {
    if (material.kind === "image") {
      args.push("-loop", "1", "-t", slice.toFixed(3), "-i", material.path);
    } else {
      args.push("-i", material.path);
    }
  });
  args.push("-i", input.audioPath);
  if (input.bgmPath) {
    args.push("-stream_loop", "-1", "-i", input.bgmPath);
  }

  const videoLabels: string[] = [];
  const filters: string[] = [];
  input.materials.forEach((material, index) => {
    const label = `v${index}`;
    const trimmed =
      material.kind === "video"
        ? `[${index}:v]${scaleFilter(input.template.mediaFit)},trim=duration=${slice.toFixed(3)},setpts=PTS-STARTPTS[${label}]`
        : `[${index}:v]${scaleFilter(input.template.mediaFit)},setpts=PTS-STARTPTS[${label}]`;
    filters.push(trimmed);
    videoLabels.push(`[${label}]`);
  });

  const concatIn = videoLabels.join("");
  filters.push(`${concatIn}concat=n=${input.materials.length}:v=1:a=0[vcat]`);

  const showTitle = input.showTitle !== false;
  const showSubtitle = input.showSubtitle !== false;
  let last = "vcat";
  let overlay = 0;
  function pushDraw(
    look: TemplateSkin["title"],
    text: string,
    yExpr: string,
    enable?: string,
    final = false,
  ): void {
    const out = final ? "vout" : `vt${overlay}`;
    overlay += 1;
    filters.push(`[${last}]${drawtextFilter({ ...look, yExpr }, text, fontFile, enable)}[${out}]`);
    last = out;
  }

  if (showTitle && input.title.trim()) {
    const titleLook = input.template.title;
    const titleLines = wrapLines(
      input.title,
      overlayCharsPerLine(titleLook.fontSize, titleLook.borderW, titleLook.boxBorderW ?? 0),
    );
    titleLines.forEach((line, index) => {
      const y = index === 0 ? input.template.title.yExpr : `${input.template.title.yExpr}+${index * (input.template.title.fontSize + 10)}`;
      pushDraw(input.template.title, line, y);
    });
  }

  const cues = showSubtitle ? input.subtitleCues.filter((cue) => cue.text.trim()) : [];
  const perLine = overlayCharsPerLine(
    input.template.subtitle.fontSize,
    input.template.subtitle.borderW,
    input.template.subtitle.boxBorderW ?? 0,
  );
  const lineHeight = input.template.subtitle.fontSize + 10;
  const subtitleOverlays = cues.flatMap((cue) =>
    wrapLines(cue.text, perLine).map((line, lineIndex) => ({ cue, line, lineIndex })),
  );
  if (subtitleOverlays.length === 0) {
    filters.push(`[${last}]copy[vout]`);
  } else {
    subtitleOverlays.forEach((item, index) => {
      const start = (item.cue.startMs / 1000).toFixed(3);
      const end = (item.cue.endMs / 1000).toFixed(3);
      const y =
        item.lineIndex === 0
          ? input.template.subtitle.yExpr
          : `${input.template.subtitle.yExpr}+${item.lineIndex * lineHeight}`;
      pushDraw(
        input.template.subtitle,
        item.line,
        y,
        `between(t\\,${start}\\,${end})`,
        index === subtitleOverlays.length - 1,
      );
    });
  }

  const voiceIndex = input.materials.length;
  filters.push(
    `[${voiceIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=0:${durationSec.toFixed(3)},asetpts=PTS-STARTPTS[voice]`,
  );
  if (input.bgmPath) {
    const bgmIndex = voiceIndex + 1;
    filters.push(
      `[${bgmIndex}:a]volume=0.18,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=0:${durationSec.toFixed(3)},asetpts=PTS-STARTPTS[bgm]`,
    );
    filters.push("[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]");
  } else {
    filters.push("[voice]anull[aout]");
  }

  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-t",
    durationSec.toFixed(3),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    input.outPath,
  );
  return args;
}

export function explainFfmpegFailure(stderr: string, code: number | null): string {
  const raw = stderr.trim() || `(退出码 ${code})`;
  if (/Library not loaded|dyld|image not found/i.test(raw)) {
    return formatToolFailure(
      "本机 FFmpeg",
      "动态库缺失，常见于 Homebrew 卸载了 lame 等依赖。请执行 brew reinstall ffmpeg 后重试。",
      raw,
    );
  }
  return formatToolFailure("本机 FFmpeg", `进程异常退出（退出码 ${code}），请根据原始返回排查。`, raw);
}

function runCommand(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on("error", () => {
      reject(new AppError("ffmpeg_missing", `本机找不到 ${bin}，请先安装 FFmpeg 并确保可在终端运行`, 400));
    });
    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new AppError("render_failed", explainFfmpegFailure(stderr, code)));
    });
  });
}

export async function detectFfmpeg(): Promise<void> {
  await runCommand("ffmpeg", ["-version"]);
  await runCommand("ffprobe", ["-version"]);
}

export async function probeDurationMs(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.on("error", () => reject(new Error("ffprobe missing")));
    child.on("close", (code: number | null) => {
      const seconds = Number(stdout.trim());
      if (code === 0 && Number.isFinite(seconds) && seconds > 0) {
        resolve(Math.round(seconds * 1000));
        return;
      }
      reject(new Error("ffprobe duration"));
    });
  });
}

export async function runFfmpeg(args: string[]): Promise<void> {
  await runCommand("ffmpeg", args);
}
