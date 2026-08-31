import { describe, expect, it } from "vitest";
import type { Job } from "../src/lib/api";
import { listFinishedOutputs } from "../src/lib/outputs";

function job(partial: Partial<Job> & Pick<Job, "id" | "createdAt" | "videos">): Job {
  return {
    stage: "done",
    percent: 100,
    materialIds: [],
    templateIds: ["red-bold"],
    bgmMaterialId: null,
    updatedAt: partial.createdAt,
    ...partial,
  };
}

describe("listFinishedOutputs", () => {
  it("flattens done videos across jobs and keeps unfinished ones out", () => {
    const older = job({
      id: "job-old",
      createdAt: "2026-08-01T00:00:00.000Z",
      videos: [
        {
          id: "old-1",
          script: { title: "旧片", body: "a" },
          templateId: "red-bold",
          materialIds: [],
          status: "done",
        },
      ],
    });
    const newer = job({
      id: "job-new",
      createdAt: "2026-08-24T00:00:00.000Z",
      voice: { provider: "volcengine", voiceType: "BV001_streaming" },
      videos: [
        {
          id: "new-fail",
          script: { title: "失败", body: "b" },
          templateId: "red-bold",
          materialIds: [],
          status: "failed",
        },
        {
          id: "new-1",
          script: { title: "新片", body: "营销云，让增长不再靠运气" },
          templateId: "plain-white",
          materialIds: [],
          status: "done",
        },
      ],
    });

    const items = listFinishedOutputs([older, newer]);
    expect(items.map((item) => item.videoId)).toEqual(["new-1", "old-1"]);
    expect(items[0]).toMatchObject({
      jobId: "job-new",
      title: "新片",
      scriptBody: "营销云，让增长不再靠运气",
      voiceType: "BV001_streaming",
      ttsProvider: "volcengine",
      href: "/api/jobs/job-new/file/new-1",
    });
    expect(items).toHaveLength(2);
  });
});
