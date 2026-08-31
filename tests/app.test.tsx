import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { ConfigPanel } from "../src/components/ConfigPanel";
import { OutputToolbar } from "../src/components/OutputToolbar";
import { EMPTY_CONFIG, loadConfigCollapsed, saveConfigCollapsed } from "../src/lib/config";
import { PROVIDER_LINKS } from "../src/lib/provider-links";

vi.mock("../src/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/api")>("../src/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      templates: async () => ({
        templates: [
          { id: "pure-white", name: "纯白", description: "白", mediaFit: "cover" as const },
          { id: "red-bold", name: "高级红", description: "红", mediaFit: "cover" as const },
        ],
      }),
      materials: async () => ({ materials: [] }),
      jobs: async () => ({ jobs: [] }),
    },
  };
});

describe("talking workspace layout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the five workflow zones and disables generate until a reference video is ready", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "AI真人口播视频生成" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Github-yizhi-chengzi" })).toHaveAttribute(
      "href",
      "https://github.com/yizhi-chengzi/video-ai-talking",
    );
    expect(screen.getByRole("img", { name: "口播" })).toBeInTheDocument();
    expect(
      screen.getByText("上传一段真人视频，写好字幕，自动配音并对上口型；需要时还能切入视频素材，生成一条竖屏视频。"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("口播真人视频")).toBeInTheDocument();
    expect(screen.getByText("不用自己说话。AI 会按字幕配音，并对上这段真人的口型")).toBeInTheDocument();
    expect(screen.getByLabelText("视频素材")).toBeInTheDocument();
    expect(screen.getByText("可选。某句要换画面时，拖到④对应字幕右侧，或点格子选用")).toBeInTheDocument();
    expect(screen.queryByLabelText("口播参考")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("插画面")).not.toBeInTheDocument();
    expect(screen.getByLabelText("配音")).toBeInTheDocument();
    expect(screen.getByLabelText("BGM")).toBeInTheDocument();
    expect(screen.getByLabelText("文案")).toBeInTheDocument();
    expect(screen.getByLabelText("模板工作台")).toBeInTheDocument();
    expect(screen.getByTestId("reference-column").className).toMatch(/xl:grid-rows-2/);
    expect(screen.getByTestId("voice-column").className).toMatch(/xl:grid-rows-2/);
    expect(screen.getByRole("button", { name: /纯白，已选中/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /纯白，已选中/ })).toHaveTextContent("已选");
    expect(screen.getByRole("button", { name: "开始生成" })).toBeDisabled();
    expect(screen.getByText("先添加一段口播真人视频")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "显示标题" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "显示字幕" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "配置" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重置" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "成片库" }));
    expect(screen.getByRole("dialog", { name: "成片库" })).toBeInTheDocument();
    expect(screen.queryByLabelText("App ID")).not.toBeInTheDocument();
    expect(document.getElementById("voice-app")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "配置" }));
    expect(screen.getByRole("dialog", { name: "配置" })).toBeInTheDocument();
    expect(screen.getByLabelText("App ID")).toBeInTheDocument();
  });
});

describe("output toolbar", () => {
  it("disables generate when TTS is not configured", () => {
    render(
      <OutputToolbar
        config={EMPTY_CONFIG}
        hasReference={true}
        scripts={[{ title: "标题", body: "正文" }]}
        templateIds={["red-bold"]}
        busy={false}
        onStart={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "开始生成" })).toBeDisabled();
    expect(screen.getByText("先填写火山 TTS 配置")).toBeInTheDocument();
  });
});

describe("config panel", () => {
  it("masks token fields by default", () => {
    render(
      <ConfigPanel
        open
        config={{
          ...EMPTY_CONFIG,
          apiKey: "sk-secret",
          ttsAppId: "app",
          ttsAccessToken: "tok-secret",
          ttsVoiceType: "BV001",
          videoretalkApiKey: "sk-lip-secret",
          updatedAt: "",
        }}
        onClose={() => undefined}
        onChange={() => undefined}
      />,
    );
    const token = document.getElementById("tts-token") as HTMLInputElement;
    const dashscope = document.getElementById("dashscope-key") as HTMLInputElement;
    const videoretalk = document.getElementById("videoretalk-key") as HTMLInputElement;
    const key = document.getElementById("api-key") as HTMLInputElement;
    expect(token.type).toBe("password");
    expect(dashscope.type).toBe("password");
    expect(videoretalk.type).toBe("password");
    expect(screen.getByRole("heading", { name: "AI配音配置" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI口播对口型配置" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI文案配置" })).toBeInTheDocument();
    expect(screen.getByText("火山引擎")).toBeInTheDocument();
    expect(screen.getByText("阿里百炼 CosyVoice")).toBeInTheDocument();
    expect(screen.getByText("阿里百炼 VideoRetalk")).toBeInTheDocument();
    expect(screen.getByLabelText("App ID")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开 CosyVoice 配音产品" })).toHaveAttribute(
      "href",
      PROVIDER_LINKS.dashscopeTtsProduct,
    );
    expect(screen.getByRole("link", { name: "去申请配音 API Key" })).toHaveAttribute(
      "href",
      PROVIDER_LINKS.dashscopeApiKey,
    );
    expect(screen.getByRole("link", { name: "打开 VideoRetalk 对口型产品" })).toHaveAttribute(
      "href",
      PROVIDER_LINKS.videoretalkProduct,
    );
    expect(screen.getByRole("link", { name: "去申请对口型 API Key" })).toHaveAttribute(
      "href",
      PROVIDER_LINKS.dashscopeApiKey,
    );
    expect(screen.getByRole("link", { name: "打开 DeepSeek 开放平台" })).toHaveAttribute(
      "href",
      PROVIDER_LINKS.deepseekPlatform,
    );
    expect(screen.getByRole("link", { name: "去申请 API Key" })).toHaveAttribute(
      "href",
      PROVIDER_LINKS.deepseekApiKeys,
    );
    expect(screen.getByRole("link", { name: "打开语音合成产品" })).toHaveAttribute(
      "href",
      PROVIDER_LINKS.volcengineTtsProduct,
    );
    expect(screen.getByRole("link", { name: "去申请 App ID / Token" })).toHaveAttribute(
      "href",
      PROVIDER_LINKS.volcengineTtsApply,
    );
  });

  it("persists collapsed state", () => {
    saveConfigCollapsed(true);
    expect(loadConfigCollapsed()).toBe(true);
    saveConfigCollapsed(false);
    expect(loadConfigCollapsed()).toBe(false);
  });
});
