import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TemplatePreview } from "../src/components/ComposeForm";
import type { Job, Template } from "../src/lib/api";

const template: Template = {
  id: "red-bold",
  name: "高级红",
  description: "红",
  mediaFit: "cover",
};

const job: Job = {
  id: "job-1",
  stage: "done",
  percent: 100,
  videos: [
    {
      id: "v1",
      script: { title: "厨房收纳", body: "先把抽屉分区" },
      templateId: "red-bold",
      materialIds: [],
      status: "done",
    },
  ],
  materialIds: [],
  templateIds: ["red-bold"],
  bgmMaterialId: null,
  createdAt: "",
  updatedAt: "",
};

function renderPreview() {
  return render(
    <TemplatePreview
      template={template}
      script={{ title: "厨房收纳", body: "先把抽屉分区" }}
      job={job}
      templates={[template]}
      regenerating={false}
      onRegenerate={() => undefined}
    />,
  );
}

describe("TemplatePreview text looks", () => {
  it("renders solid white without a stroke and hollow white as an outline", () => {
    const { rerender } = render(
      <TemplatePreview
        template={{
          id: "pure-white",
          name: "纯白",
          description: "白",
          mediaFit: "cover",
          title: {
            fontSize: 76,
            color: "0xFFFFFF",
            borderColor: "0xFFFFFF",
            borderW: 0,
            yExpr: "h*0.07",
          },
        }}
        script={{ title: "纯白标题", body: "纯白字幕" }}
        job={null}
        templates={[]}
        regenerating={false}
        onRegenerate={() => undefined}
      />,
    );
    const solid = screen.getByText("纯白标题");
    expect(solid.style.webkitTextStroke).toBe("");
    expect(solid.style.color).toBe("rgb(255, 255, 255)");

    rerender(
      <TemplatePreview
        template={{
          id: "hollow-white",
          name: "空心白",
          description: "描边",
          mediaFit: "cover",
          title: {
            fontSize: 76,
            color: "0xFFFFFF@0",
            borderColor: "0xFFFFFF",
            borderW: 6,
            yExpr: "h*0.07",
          },
        }}
        script={{ title: "空心标题", body: "空心字幕" }}
        job={null}
        templates={[]}
        regenerating={false}
        onRegenerate={() => undefined}
      />,
    );
    const outline = screen.getByText("空心标题");
    expect(outline.style.color).toBe("rgba(255, 255, 255, 0)");
    expect(outline.style.webkitTextStroke).toMatch(/#FFFFFF|rgb\(255,\s*255,\s*255\)/);
  });
});

describe("TemplatePreview outputs", () => {
  it("keeps the template text preview after a video is ready", () => {
    renderPreview();
    const preview = screen.getByTestId("template-preview");
    expect(preview.querySelector("video")).toBeNull();
    expect(within(preview).getByText("厨房收纳")).toBeInTheDocument();
    expect(within(preview).getByText("先把抽屉分区")).toBeInTheDocument();
  });

  it("places finished 9:16 videos below the preview for modal play and download", () => {
    renderPreview();
    const card = screen.getByRole("button", { name: "预览成片 #1 厨房收纳" });
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass("aspect-[9/16]");
    expect(screen.getByRole("link", { name: "下载 #1 厨房收纳" })).toHaveAttribute(
      "href",
      "/api/jobs/job-1/file/v1",
    );

    fireEvent.click(card);
    const dialog = screen.getByRole("dialog", { name: "成片预览 #1 厨房收纳" });
    expect(dialog).toBeInTheDocument();
    const player = within(dialog).getByLabelText("成片播放");
    expect(player.tagName).toBe("VIDEO");
    expect(player).toHaveAttribute("src", "/api/jobs/job-1/file/v1");
    expect(within(dialog).getByRole("link", { name: "下载成片" })).toHaveAttribute(
      "href",
      "/api/jobs/job-1/file/v1",
    );
  });
});
