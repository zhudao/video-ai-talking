import { describe, expect, it } from "vitest";
import {
  BUILTIN_VOICES,
  CUSTOM_VOICE_VALUE,
  DASHSCOPE_VOICES,
  VOICE_PREVIEW_TEXT,
  catalogFor,
  filterVoices,
  findBuiltinVoice,
  findDashscopeVoice,
  voiceLabel,
  voiceSelectValue,
} from "../src/lib/voices";

describe("builtin voices", () => {
  it("resolves catalog ids and treats unknown ids as custom", () => {
    expect(findBuiltinVoice("BV001_streaming")?.name).toBe("通用女声");
    expect(voiceSelectValue("BV001_streaming")).toBe("BV001_streaming");
    expect(voiceSelectValue("my_custom_voice")).toBe(CUSTOM_VOICE_VALUE);
    expect(voiceLabel("BV701_streaming")).toContain("擎苍");
    expect(voiceLabel("")).toBe("未选择音色");
  });

  it("resolves 阿里百炼 CosyVoice ids", async () => {
    expect(DASHSCOPE_VOICES.some((item) => item.id === "longanyang")).toBe(true);
    expect(findDashscopeVoice("longanyang")?.name).toBe("龙安洋");
  });

  it("keeps a curated short-video set for each engine", () => {
    expect(BUILTIN_VOICES.length).toBeGreaterThanOrEqual(20);
    expect(BUILTIN_VOICES.length).toBeLessThanOrEqual(32);
    expect(DASHSCOPE_VOICES.length).toBeGreaterThanOrEqual(20);
    expect(DASHSCOPE_VOICES.length).toBeLessThanOrEqual(32);
    for (const catalog of [BUILTIN_VOICES, DASHSCOPE_VOICES]) {
      expect(new Set(catalog.map((item) => item.id)).size).toBe(catalog.length);
      expect(catalog.some((item) => item.gender === "female")).toBe(true);
      expect(catalog.some((item) => item.gender === "male")).toBe(true);
      expect(catalog.some((item) => item.gender === "child")).toBe(true);
      expect(catalog.every((item) => item.use.trim().length > 0)).toBe(true);
    }
  });

  it("filters a catalog by gender and name", () => {
    const female = filterVoices(catalogFor("dashscope"), { gender: "female" });
    expect(female.every((item) => item.gender === "female")).toBe(true);
    expect(female.length).toBeGreaterThan(0);
    const hit = filterVoices(catalogFor("dashscope"), { query: "泡泡" });
    expect(hit.map((item) => item.id)).toContain("longpaopao_v3");
  });

  it("uses one short sentence for live preview", () => {
    expect(VOICE_PREVIEW_TEXT).toBe("你好，这是音色试听。");
  });
});
