import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobPanel } from "../src/components/JobPanel";

describe("JobPanel lipsync wait", () => {
  it("tells the user VideoRetalk usually takes a few minutes", () => {
    render(
      <JobPanel
        job={{
          id: "job-lip",
          stage: "lipsync",
          percent: 50,
          videos: [
            {
              id: "v1",
              script: { title: "咖啡新宠", body: "正文" },
              templateId: "red-bold",
              materialIds: [],
              status: "lipsync",
            },
          ],
          materialIds: [],
          templateIds: ["red-bold"],
          bgmMaterialId: null,
          createdAt: "",
          updatedAt: "",
        }}
        templates={[{ id: "red-bold", name: "黄色闪亮", description: "黄", mediaFit: "cover" }]}
        onRegenerate={() => undefined}
        regenerating={false}
      />,
    );
    expect(screen.getByText("正在对口型 · 50%")).toBeInTheDocument();
    expect(screen.getByText(/百炼对口型通常要几分钟/)).toBeInTheDocument();
  });
});

describe("JobPanel errors", () => {
  it("keeps the human hint and raw payload visible", () => {
    render(
      <JobPanel
        job={{
          id: "job-1",
          stage: "failed",
          percent: 0,
          videos: [
            {
              id: "v1",
              script: { title: "123", body: "正文" },
              templateId: "red-bold",
              materialIds: [],
              status: "failed",
            },
          ],
          materialIds: [],
          templateIds: ["red-bold"],
          bgmMaterialId: null,
          createdAt: "",
          updatedAt: "",
          error:
            "【火山语音合成】鉴权失败：请检查 App ID 与 Access Token。\n原始返回：{\"message\":\"load grant: requested grant not found in SaaS storage\"}",
        }}
        templates={[{ id: "red-bold", name: "高级红", description: "红", mediaFit: "cover" }]}
        onRegenerate={() => undefined}
        regenerating={false}
      />,
    );
    expect(screen.getByText(/【火山语音合成】/)).toBeInTheDocument();
    expect(screen.getByText(/requested grant not found in SaaS storage/)).toBeInTheDocument();
  });
});
