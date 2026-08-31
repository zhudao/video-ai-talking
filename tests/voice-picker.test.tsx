import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoicePicker } from "../src/components/VoicePicker";
import { VoiceSection } from "../src/components/ComposeForm";
import { EMPTY_CONFIG, type AppConfig } from "../src/lib/config";

function PlayablePicker({
  canPreview = true,
  onPreview = async () => new Blob(["audio"], { type: "audio/mpeg" }),
  initial = "longpaopao_v3",
}: {
  canPreview?: boolean;
  onPreview?: (voiceType: string) => Promise<Blob>;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <VoicePicker
      id="voice-type"
      provider="dashscope"
      value={value}
      onChange={setValue}
      canPreview={canPreview}
      onPreview={onPreview}
    />
  );
}

describe("VoicePicker cards", () => {
  it("shows the selected voice as a summary card instead of a dropdown", () => {
    render(<PlayablePicker />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("龙泡泡")).toBeVisible();
    expect(screen.getByRole("button", { name: "更换音色" })).toBeVisible();
    expect(screen.getByRole("button", { name: "试听 龙泡泡" })).toBeVisible();
  });

  it("opens a card grid, filters by gender, and selects a voice", () => {
    const onChange = vi.fn();
    render(
      <VoicePicker
        id="voice-type"
        provider="dashscope"
        value="longpaopao_v3"
        onChange={onChange}
        canPreview
        onPreview={async () => new Blob(["audio"], { type: "audio/mpeg" })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "更换音色" }));
    const dialog = screen.getByRole("dialog", { name: "选择阿里百炼音色" });
    expect(dialog.className).toMatch(/w-\[min\(40rem/);
    expect(dialog.className).toMatch(/max-h-\[min\(36rem/);
    expect(within(dialog).getByText("试听会用当前密钥合成约十个字，消耗对应厂商额度。")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "选择 龙安洋" })).toBeVisible();

    fireEvent.click(within(dialog).getByRole("button", { name: "女" }));
    expect(within(dialog).queryByRole("button", { name: "选择 龙安洋" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "选择 龙安欢" })).toBeVisible();

    fireEvent.click(within(dialog).getByRole("button", { name: "选择 龙安欢" }));
    expect(onChange).toHaveBeenCalledWith("longanhuan_v3");
    expect(screen.queryByRole("dialog", { name: "选择阿里百炼音色" })).not.toBeInTheDocument();
  });

  it("previews a card without changing the selected voice", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(play);
    const onChange = vi.fn();
    const onPreview = vi.fn(async (voiceType: string) => {
      expect(voiceType).toBe("longanyang");
      return new Blob(["audio"], { type: "audio/mpeg" });
    });
    render(
      <VoicePicker
        id="voice-type"
        provider="dashscope"
        value="longpaopao_v3"
        onChange={onChange}
        canPreview
        onPreview={onPreview}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "更换音色" }));
    fireEvent.click(screen.getByRole("button", { name: "试听 龙安洋" }));
    await waitFor(() => expect(onPreview).toHaveBeenCalledWith("longanyang"));
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "选择阿里百炼音色" })).toBeVisible();
  });

  it("disables preview when keys are missing", () => {
    render(<PlayablePicker canPreview={false} />);
    expect(screen.getByRole("button", { name: "试听 龙泡泡" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "更换音色" }));
    expect(screen.getByRole("button", { name: "试听 龙安洋" })).toBeDisabled();
  });

  it("keeps a custom voice id field in the picker", () => {
    const onChange = vi.fn();
    render(
      <VoicePicker
        id="voice-type"
        provider="dashscope"
        value="my_custom_voice"
        onChange={onChange}
        canPreview
        onPreview={async () => new Blob(["audio"], { type: "audio/mpeg" })}
      />,
    );
    expect(screen.getByText("自定义音色")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "更换音色" }));
    fireEvent.change(screen.getByLabelText("自定义音色 ID"), { target: { value: "long-custom" } });
    expect(onChange).toHaveBeenCalledWith("long-custom");
    const dialog = screen.getByRole("dialog", { name: "选择阿里百炼音色" });
    expect(within(dialog).getByText(/百炼控制台的 CosyVoice 音色列表/)).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "打开音色列表文档" })).toHaveAttribute(
      "href",
      "https://help.aliyun.com/zh/model-studio/cosyvoice-voice-list",
    );
  });

  it("points volcengine custom ids to the official voice_type list", () => {
    render(
      <VoicePicker
        id="voice-type"
        provider="volcengine"
        value="my_volc_voice"
        onChange={() => undefined}
        canPreview
        onPreview={async () => new Blob(["audio"], { type: "audio/mpeg" })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "更换音色" }));
    const dialog = screen.getByRole("dialog", { name: "选择火山音色" });
    expect(within(dialog).getByText(/火山引擎文档的音色列表/)).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "打开音色列表文档" })).toHaveAttribute(
      "href",
      "https://www.volcengine.com/docs/6561/97465",
    );
  });

  it("lets a catalog selection switch to a custom id", () => {
    const onChange = vi.fn();
    render(
      <VoicePicker
        id="voice-type"
        provider="dashscope"
        value="longpaopao_v3"
        onChange={onChange}
        canPreview
        onPreview={async () => new Blob(["audio"], { type: "audio/mpeg" })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "更换音色" }));
    fireEvent.click(screen.getByRole("button", { name: "使用自定义音色 ID" }));
    fireEvent.change(screen.getByLabelText("自定义音色 ID"), { target: { value: "long-custom" } });
    expect(onChange).toHaveBeenCalledWith("long-custom");
  });
});

describe("VoiceSection preview wiring", () => {
  it("passes configured credentials into live preview", async () => {
    const previewTts = vi.fn(async () => new Blob(["ok"], { type: "audio/mpeg" }));
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    function Wired() {
      const [config, setConfig] = useState<AppConfig>({
        ...EMPTY_CONFIG,
        ttsProvider: "dashscope",
        dashscopeApiKey: "sk-test",
        dashscopeVoice: "longpaopao_v3",
      });
      return <VoiceSection config={config} onChange={setConfig} previewTts={previewTts} />;
    }
    render(<Wired />);
    fireEvent.click(screen.getByRole("button", { name: "试听 龙泡泡" }));
    await waitFor(() =>
      expect(previewTts).toHaveBeenCalledWith({
        provider: "dashscope",
        voiceType: "longpaopao_v3",
        apiKey: "sk-test",
      }),
    );
  });
});
