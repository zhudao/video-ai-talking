import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import type { Job } from "../src/lib/api";

const failedJob: Job = {
  id: "job-failed",
  stage: "failed",
  percent: 0,
  error: "素材不存在",
  videos: [
    {
      id: "v1",
      script: { title: "营销云", body: "正文" },
      templateId: "red-bold",
      materialIds: [],
      status: "failed",
    },
  ],
  materialIds: [],
  templateIds: ["red-bold"],
  bgmMaterialId: null,
  createdAt: "2026-08-25T00:00:00.000Z",
  updatedAt: "2026-08-25T00:00:00.000Z",
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
      materials: async () => ({ materials: [] }),
      jobs: async () => ({
        jobs: [
          failedJob,
          {
            ...failedJob,
            id: "job-done",
            stage: "done",
            percent: 100,
            error: undefined,
            videos: [
              {
                id: "done-1",
                script: { title: "旧成片", body: "正文" },
                templateId: "red-bold",
                materialIds: [],
                status: "done",
              },
            ],
          },
        ],
      }),
    },
  };
});

describe("workbench restore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not pin a previous failed job in the template workbench", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: "成片库 1" })).toBeInTheDocument();
    expect(screen.queryByText("已失败")).not.toBeInTheDocument();
    expect(screen.queryByText("素材不存在")).not.toBeInTheDocument();
    expect(screen.getByText(/这一轮还没开始生成/)).toBeInTheDocument();
  });
});
