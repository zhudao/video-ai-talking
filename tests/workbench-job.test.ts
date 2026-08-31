import { describe, expect, it } from "vitest";
import type { Job } from "../src/lib/api";
import {
  draftFingerprint,
  restoreWorkbenchJob,
  shouldDetachWorkbenchJob,
} from "../src/lib/workbench-job";

function job(stage: Job["stage"], id = "job-1"): Job {
  return {
    id,
    stage,
    percent: stage === "done" ? 100 : 0,
    videos: [],
    materialIds: [],
    templateIds: ["red-bold"],
    bgmMaterialId: null,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
  };
}

describe("workbench job", () => {
  it("restores only an in-flight job, not the last failed or finished one", () => {
    expect(restoreWorkbenchJob([job("failed"), job("done", "job-2")])).toBeNull();
    expect(restoreWorkbenchJob([job("voice"), job("done", "job-2")])?.id).toBe("job-1");
    expect(restoreWorkbenchJob([job("lipsync"), job("done", "job-2")])?.id).toBe("job-1");
  });

  it("detaches a finished job once the draft changes, but not while generating", () => {
    const before = draftFingerprint({
      materialIds: ["m1"],
      scripts: [{ title: "a", body: "b" }],
      templateIds: ["red-bold"],
      bgmId: null,
      showTitle: true,
      showSubtitle: true,
    });
    const after = draftFingerprint({
      materialIds: [],
      scripts: [{ title: "a", body: "b" }],
      templateIds: ["red-bold"],
      bgmId: null,
      showTitle: true,
      showSubtitle: true,
    });
    expect(shouldDetachWorkbenchJob(job("failed"), before, after)).toBe(true);
    expect(shouldDetachWorkbenchJob(job("done"), before, after)).toBe(true);
    expect(shouldDetachWorkbenchJob(job("voice"), before, after)).toBe(false);
    expect(shouldDetachWorkbenchJob(job("failed"), before, before)).toBe(false);
  });
});
