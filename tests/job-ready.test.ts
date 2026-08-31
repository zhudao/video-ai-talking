import { describe, expect, it } from "vitest";
import { EMPTY_CONFIG } from "../src/lib/config";
import { canStartJob, missingJobRequirements, requirementStep, startBlockedReason } from "../src/lib/job-ready";

const tts = {
  ...EMPTY_CONFIG,
  ttsAppId: "app",
  ttsAccessToken: "tok",
  ttsVoiceType: "BV001",
  videoretalkApiKey: "sk-lip",
};

describe("job ready", () => {
  it("requires a reference video, one script, and one template", () => {
    expect(
      missingJobRequirements({
        config: EMPTY_CONFIG,
        hasReference: false,
        scripts: [],
        templateIds: [],
      }),
    ).toEqual([
      "先添加一段口播真人视频",
      "先填写火山 TTS 配置",
      "先填写 AI口播对口型配置",
      "先写好标题和字幕",
      "先选择一套模板",
    ]);
    expect(
      canStartJob({
        config: tts,
        hasReference: true,
        scripts: [{ title: "标题", body: "正文" }],
        templateIds: ["red-bold"],
      }),
    ).toBe(true);
    expect(
      startBlockedReason({
        config: tts,
        hasReference: true,
        scripts: [{ title: "标题", body: "正文" }],
        templateIds: ["red-bold", "plain-white"],
      }),
    ).toBe("先选择一套模板");
    expect(
      startBlockedReason({
        config: { ...tts, videoretalkApiKey: "" },
        hasReference: true,
        scripts: [{ title: "标题", body: "正文" }],
        templateIds: ["red-bold"],
      }),
    ).toBe("先填写 AI口播对口型配置");
    expect(
      startBlockedReason({
        config: {
          ...EMPTY_CONFIG,
          ttsProvider: "dashscope",
          dashscopeApiKey: "",
          dashscopeVoice: "longanyang",
          videoretalkApiKey: "sk-lip",
        },
        hasReference: true,
        scripts: [{ title: "标题", body: "正文" }],
        templateIds: ["red-bold"],
      }),
    ).toBe("先填写阿里百炼配音 Key");
    expect(
      startBlockedReason({
        config: { ...tts, dashscopeApiKey: "sk-bai", videoretalkApiKey: "" },
        hasReference: true,
        scripts: [{ title: "标题", body: "正文" }],
        templateIds: ["red-bold"],
      }),
    ).toBe("先填写 AI口播对口型配置");
    expect(requirementStep("先填写 AI口播对口型配置")).toBe("config");
    expect(requirementStep("先填写阿里百炼配音 Key")).toBe("2");
  });

  it("blocks a cutaway caption that has no material", () => {
    expect(
      missingJobRequirements({
        config: tts,
        hasReference: true,
        scripts: [
          {
            title: "标题",
            body: "正文",
            captions: [{ id: "c1", text: "这一句切走", cutaway: true }],
          },
        ],
        templateIds: ["red-bold"],
      }),
    ).toContain("先为勾选「切到素材」的字幕指定素材");
  });
});
