import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { CONFIG_STORAGE_KEY, loadConfig, saveConfig } from "../src/lib/config";
import { EMPTY_WORKBENCH, clearWorkbench, loadWorkbench, saveWorkbench } from "../src/lib/workbench-draft";

const talkingHead = {
  id: "ref-talking",
  filename: "face.mp4",
  mime: "video/mp4",
  kind: "video" as const,
  ext: "mp4",
  createdAt: "",
  url: "/files/materials/ref-talking.mp4",
};

const bgm = {
  id: "bgm-1",
  filename: "bed.mp3",
  mime: "audio/mpeg",
  kind: "audio" as const,
  ext: "mp3",
  createdAt: "",
  url: "/files/materials/bgm-1.mp3",
};

const materials = [talkingHead, bgm];

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
      materials: async () => ({ materials }),
      jobs: async () => ({ jobs: [] }),
    },
  };
});

function seedFilledWorkbench() {
  saveWorkbench({
    referenceId: "ref-talking",
    scripts: [{ title: "沙发怎么选", body: "先看面料。", captions: [{ id: "c1", text: "先看面料。" }] }],
    templateIds: ["red-bold"],
    bgmId: "bgm-1",
    showTitle: false,
    showSubtitle: false,
  });
  saveConfig({
    ...loadConfig(),
    apiKey: "sk-keep-me",
    scriptDurationSec: 45,
  });
}

describe("workbench reset", () => {
  beforeEach(() => {
    localStorage.clear();
    seedFilledWorkbench();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("clears every filled field and does not restore after reload", async () => {
    const { unmount } = render(<App />);
    expect(await screen.findByLabelText("口播真人视频预览")).toHaveAttribute(
      "src",
      "/files/materials/ref-talking.mp4",
    );
    expect(screen.getByDisplayValue("沙发怎么选")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /高级红，已选中/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("switch", { name: "显示标题" })).toHaveAttribute("aria-checked", "false");

    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    const confirm = screen.getByRole("region", { name: "确认重置工作台" });
    expect(within(confirm).getByText(/刷新后也不会再恢复/)).toBeInTheDocument();
    expect(within(confirm).getByText(/已添加的素材文件/)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole("button", { name: "确认重置" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("口播真人视频预览")).not.toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue("沙发怎么选")).not.toBeInTheDocument();
    expect(screen.getByText("已添加 1 个素材")).toBeInTheDocument();
    expect(screen.getByText("bed.mp3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /纯白，已选中/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("switch", { name: "显示标题" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "显示字幕" })).toHaveAttribute("aria-checked", "true");
    expect(loadWorkbench()).toEqual(EMPTY_WORKBENCH);
    expect(JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) ?? "{}").apiKey).toBe("sk-keep-me");

    unmount();
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByLabelText("口播真人视频预览")).not.toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue("沙发怎么选")).not.toBeInTheDocument();
    expect(loadWorkbench()).toEqual(EMPTY_WORKBENCH);
  });

  it("cancels without changing the saved draft", async () => {
    render(<App />);
    expect(await screen.findByLabelText("口播真人视频预览")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    const confirm = screen.getByRole("region", { name: "确认重置工作台" });
    fireEvent.click(within(confirm).getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("region", { name: "确认重置工作台" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("口播真人视频预览")).toBeInTheDocument();
    expect(loadWorkbench().referenceId).toBe("ref-talking");
  });

  it("writes an empty draft immediately so a later save cannot revive it", () => {
    expect(clearWorkbench()).toEqual(EMPTY_WORKBENCH);
    expect(loadWorkbench()).toEqual(EMPTY_WORKBENCH);
  });
});
