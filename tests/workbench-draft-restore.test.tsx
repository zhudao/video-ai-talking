import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { EMPTY_WORKBENCH, saveWorkbench } from "../src/lib/workbench-draft";

const talkingHead = {
  id: "ref-talking",
  filename: "face.mp4",
  mime: "video/mp4",
  kind: "video" as const,
  ext: "mp4",
  createdAt: "",
  url: "/files/materials/ref-talking.mp4",
};

vi.mock("../src/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/api")>("../src/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      templates: async () => ({
        templates: [{ id: "red-bold", name: "高级红", description: "红", mediaFit: "cover" as const }],
      }),
      materials: async () => ({ materials: [talkingHead] }),
      jobs: async () => ({ jobs: [] }),
    },
  };
});

describe("workbench draft restore", () => {
  beforeEach(() => {
    localStorage.clear();
    saveWorkbench({ ...EMPTY_WORKBENCH, referenceId: "ref-talking" });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("keeps the talking-head video in 口播真人视频 after reload", async () => {
    render(<App />);
    const preview = await screen.findByLabelText("口播真人视频预览");
    expect(preview).toHaveAttribute("src", "/files/materials/ref-talking.mp4");
    expect(screen.getByText("face.mp4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "替换" })).toBeInTheDocument();
    expect(screen.queryByText("已添加 1 个素材")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("口播参考")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("插画面")).not.toBeInTheDocument();
  });
});
