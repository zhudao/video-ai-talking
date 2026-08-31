import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutputLibrary } from "../src/components/OutputLibrary";
import type { Job, Template } from "../src/lib/api";

const templates: Template[] = [{ id: "red-bold", name: "高级红", description: "红", mediaFit: "cover" }];

const jobs: Job[] = [
  {
    id: "job-old",
    stage: "done",
    percent: 100,
    videos: [
      {
        id: "old-1",
        script: { title: "旧片", body: "a" },
        templateId: "red-bold",
        materialIds: [],
        status: "done",
      },
    ],
    materialIds: [],
    templateIds: ["red-bold"],
    bgmMaterialId: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
  {
    id: "job-new",
    stage: "done",
    percent: 100,
    videos: [
      {
        id: "new-1",
        script: { title: "新片", body: "营销云，让增长不再靠运气" },
        templateId: "red-bold",
        materialIds: [],
        status: "done",
      },
    ],
    materialIds: [],
    templateIds: ["red-bold"],
    bgmMaterialId: null,
    voice: { provider: "volcengine", voiceType: "BV001_streaming" },
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
  },
];

describe("OutputLibrary", () => {
  it("lists historical 9:16 outputs and opens a preview dialog", () => {
    render(
      <OutputLibrary open jobs={jobs} templates={templates} onClose={() => undefined} onDelete={async () => undefined} />,
    );
    const dialog = screen.getByRole("dialog", { name: "成片库" });
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toMatch(/88rem|92vh/);
    expect(screen.getByText("营销云，让增长不再靠运气")).toBeInTheDocument();
    expect(screen.getByText(/通用女声/)).toBeInTheDocument();
    expect(dialog.querySelector(".grid")?.className).toMatch(/grid-cols-3|xl:grid-cols-6/);
    expect(screen.getByRole("button", { name: "预览成片 新片" })).toHaveClass("aspect-[9/16]");
    expect(screen.getByRole("link", { name: "下载 新片" })).toHaveAttribute("href", "/api/jobs/job-new/file/new-1");
    expect(screen.getByRole("button", { name: "预览成片 旧片" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "预览成片 新片" }));
    const preview = screen.getByRole("dialog", { name: "成片预览 新片" });
    expect(preview.className).toMatch(/34rem|96vh/);
    expect(within(preview).getByLabelText("成片播放")).toHaveAttribute("src", "/api/jobs/job-new/file/new-1");
  });

  it("asks for confirmation before deleting an output", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <OutputLibrary open jobs={jobs} templates={templates} onClose={() => undefined} onDelete={onDelete} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除 新片" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认删除 新片" }));
    expect(onDelete).toHaveBeenCalledWith("job-new", "new-1");
  });
});
