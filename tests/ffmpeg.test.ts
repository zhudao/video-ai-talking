import { describe, expect, it } from "vitest";
import {
  buildFfmpegArgs,
  buildTalkingFfmpegArgs,
  explainFfmpegFailure,
  FRAME_H,
  FRAME_W,
  overlayCharsPerLine,
  subtitleCharsPerLine,
  wrapLines,
} from "../server/render/ffmpeg.ts";
import { parseTemplates } from "../src/lib/templates";
import { readFileSync } from "node:fs";

const skins = parseTemplates(JSON.parse(readFileSync("templates/skins.json", "utf8")));
const template = skins[0]!;
const yellow = skins.find((item) => item.id === "shiny-yellow")!;

function estimatedLineWidth(text: string, fontSize: number, borderW: number, boxBorderW = 0): number {
  return [...text].length * fontSize + borderW * 2 + boxBorderW * 2;
}

describe("ffmpeg args", () => {
  it("includes materials, voice, drawtext, optional bgm and mp4 output", () => {
    const args = buildFfmpegArgs({
      materials: [
        { path: "/tmp/a.jpg", kind: "image" },
        { path: "/tmp/b.mp4", kind: "video" },
      ],
      audioPath: "/tmp/voice.mp3",
      title: "厨房收纳",
      subtitleCues: [{ text: "先把抽屉分区", startMs: 0, endMs: 2000 }],
      bgmPath: "/tmp/bgm.mp3",
      template,
      outPath: "/tmp/out.mp4",
      durationMs: 4000,
      fontFile: "/tmp/font.ttf",
    });
    const joined = args.join(" ");
    expect(args).toContain("/tmp/a.jpg");
    expect(args).toContain("/tmp/b.mp4");
    expect(args).toContain("/tmp/voice.mp3");
    expect(args).toContain("/tmp/bgm.mp3");
    expect(args).toContain("/tmp/out.mp4");
    expect(joined).toContain("drawtext");
    expect(joined).toContain("厨房收纳");
    expect(joined).toContain("amix");
    expect(args).toContain("libx264");
    expect(args.at(-1)).toBe("/tmp/out.mp4");
  });

  it("omits title or subtitle drawtext when those overlays are turned off", () => {
    const hiddenTitle = buildFfmpegArgs({
      materials: [{ path: "/tmp/a.jpg", kind: "image" }],
      audioPath: "/tmp/voice.mp3",
      title: "厨房收纳",
      subtitleCues: [{ text: "先把抽屉分区", startMs: 0, endMs: 2000 }],
      template,
      outPath: "/tmp/out.mp4",
      durationMs: 2000,
      fontFile: "/tmp/font.ttf",
      showTitle: false,
      showSubtitle: true,
    }).join(" ");
    expect(hiddenTitle).not.toContain("厨房收纳");
    expect(hiddenTitle).toContain("先把抽屉分区");

    const hiddenSubtitle = buildFfmpegArgs({
      materials: [{ path: "/tmp/a.jpg", kind: "image" }],
      audioPath: "/tmp/voice.mp3",
      title: "厨房收纳",
      subtitleCues: [{ text: "先把抽屉分区", startMs: 0, endMs: 2000 }],
      template,
      outPath: "/tmp/out.mp4",
      durationMs: 2000,
      fontFile: "/tmp/font.ttf",
      showTitle: true,
      showSubtitle: false,
    }).join(" ");
    expect(hiddenSubtitle).toContain("厨房收纳");
    expect(hiddenSubtitle).not.toContain("先把抽屉分区");
  });

  it("draws wrapped subtitle lines as separate overlays so FFmpeg actually breaks the line", () => {
    const args = buildFfmpegArgs({
      materials: [{ path: "/tmp/a.jpg", kind: "image" }],
      audioPath: "/tmp/voice.mp3",
      title: "标题",
      subtitleCues: [
        { text: "营销云，就是把所有营销环节整合到一起的超级工具", startMs: 0, endMs: 14000 },
      ],
      template,
      outPath: "/tmp/out.mp4",
      durationMs: 14000,
      fontFile: "/tmp/font.ttf",
    }).join(" ");
    const lines = wrapLines(
      "营销云，就是把所有营销环节整合到一起的超级工具",
      subtitleCharsPerLine(template.subtitle.fontSize),
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(args).toContain(line);
    }
    expect(args.match(/drawtext=/g)?.length).toBeGreaterThanOrEqual(1 + lines.length);
    expect(args).toContain("between(t\\,0.000\\,14.000)");
  });

  it("wraps a long title to fit the 1080 frame and prefers a punctuation break", () => {
    const title = "一机解锁咖啡馆，打工人的续命神器";
    const perLine = overlayCharsPerLine(yellow.title.fontSize, yellow.title.borderW);
    const lines = wrapLines(title, perLine);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe(title);
    expect(lines.some((line) => /[，。！？；、]/.test(line.slice(-1)))).toBe(true);
    for (const line of lines) {
      expect([...line].length).toBeLessThanOrEqual(perLine);
      expect(estimatedLineWidth(line, yellow.title.fontSize, yellow.title.borderW)).toBeLessThan(FRAME_W * 0.92);
    }

    const args = buildFfmpegArgs({
      materials: [{ path: "/tmp/a.jpg", kind: "image" }],
      audioPath: "/tmp/voice.mp3",
      title,
      subtitleCues: [{ text: "还在天天排队买咖啡吗？", startMs: 0, endMs: 2000 }],
      template: yellow,
      outPath: "/tmp/out.mp4",
      durationMs: 2000,
      fontFile: "/tmp/font.ttf",
    }).join(" ");
    for (const line of lines) {
      expect(args).toContain(line);
    }

    for (const skin of skins) {
      const count = overlayCharsPerLine(skin.title.fontSize, skin.title.borderW, skin.title.boxBorderW ?? 0);
      for (const line of wrapLines(title, count)) {
        expect(
          estimatedLineWidth(line, skin.title.fontSize, skin.title.borderW, skin.title.boxBorderW ?? 0),
        ).toBeLessThan(FRAME_W * 0.92);
      }
    }
  });

  it("draws title plates for boxed skins", () => {
    const boxed = parseTemplates(JSON.parse(readFileSync("templates/skins.json", "utf8"))).find(
      (item) => item.id === "classic-blue",
    )!;
    const joined = buildFfmpegArgs({
      materials: [{ path: "/tmp/a.jpg", kind: "image" }],
      audioPath: "/tmp/voice.mp3",
      title: "今天真的便宜",
      subtitleCues: [{ text: "好物推荐", startMs: 0, endMs: 2000 }],
      template: boxed,
      outPath: "/tmp/out.mp4",
      durationMs: 2000,
      fontFile: "/tmp/font.ttf",
    }).join(" ");
    expect(joined).toContain("box=1");
    expect(joined).toContain("boxcolor=0x2867D6@0.91");
  });

  it("draws solid white and hollow white subtitle skins", () => {
    const loaded = parseTemplates(JSON.parse(readFileSync("templates/skins.json", "utf8")));
    const pureWhite = loaded.find((item) => item.id === "pure-white")!;
    const hollow = loaded.find((item) => item.id === "hollow-white")!;
    const solid = buildFfmpegArgs({
      materials: [{ path: "/tmp/a.jpg", kind: "image" }],
      audioPath: "/tmp/voice.mp3",
      title: "纯白标题",
      subtitleCues: [{ text: "纯白字幕", startMs: 0, endMs: 2000 }],
      template: pureWhite,
      outPath: "/tmp/out.mp4",
      durationMs: 2000,
      fontFile: "/tmp/font.ttf",
    }).join(" ");
    expect(solid).toContain("fontcolor=0xFFFFFF");
    expect(solid).toContain("borderw=0");
    const outline = buildFfmpegArgs({
      materials: [{ path: "/tmp/a.jpg", kind: "image" }],
      audioPath: "/tmp/voice.mp3",
      title: "空心标题",
      subtitleCues: [{ text: "空心字幕", startMs: 0, endMs: 2000 }],
      template: hollow,
      outPath: "/tmp/out.mp4",
      durationMs: 2000,
      fontFile: "/tmp/font.ttf",
    }).join(" ");
    expect(outline).toContain("fontcolor=0xFFFFFF@0");
    expect(outline).toContain("bordercolor=0xFFFFFF");
    expect(outline).toMatch(/borderw=[5-8]/);
  });
});

describe("talking ffmpeg args", () => {
  it("keeps 9:16 cover, loops b-roll silently, and mixes TTS audio", () => {
    const args = buildTalkingFfmpegArgs({
      lipsyncPath: "/tmp/face.mp4",
      clips: [
        { startMs: 0, endMs: 1000, source: "face" },
        { startMs: 1000, endMs: 2000, source: "broll", path: "/tmp/cut.jpg", kind: "image" },
        { startMs: 2000, endMs: 3000, source: "broll", path: "/tmp/cut.mp4", kind: "video" },
      ],
      audioPath: "/tmp/voice.mp3",
      title: "口播标题",
      subtitleCues: [{ text: "这一句切走", startMs: 1000, endMs: 2000 }],
      template,
      outPath: "/tmp/out.mp4",
      durationMs: 3000,
      fontFile: "/tmp/font.ttf",
    });
    const joined = args.join(" ");
    expect(args).toContain("/tmp/face.mp4");
    expect(args).toContain("-loop");
    expect(args).toContain("/tmp/cut.jpg");
    expect(args).toContain("-stream_loop");
    expect(args).toContain("-an");
    expect(args).toContain("/tmp/cut.mp4");
    expect(args).toContain("/tmp/voice.mp3");
    expect(joined).toContain(`${FRAME_W}:${FRAME_H}`);
    expect(joined).toContain("force_original_aspect_ratio=increase");
    expect(joined).toContain("口播标题");
    expect(joined).not.toContain("[cut.mp4]amix");
    expect(args.at(-1)).toBe("/tmp/out.mp4");
  });
});

describe("ffmpeg failure message", () => {
  it("explains missing Homebrew dylibs and keeps the raw dyld text", () => {
    const raw =
      "dyld[44620]: Library not loaded: /opt/homebrew/opt/lame/lib/libmp3lame.0.dylib Reason: tried: (no such file)";
    const message = explainFfmpegFailure(raw, 1);
    expect(message).toMatch(/【本机 FFmpeg】/);
    expect(message).toMatch(/动态库|Homebrew|brew reinstall ffmpeg/);
    expect(message).toMatch(/原始返回：/);
    expect(message).toContain("libmp3lame.0.dylib");
  });
});
