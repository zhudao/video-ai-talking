import type { Job } from "./api";

export type WorkbenchDraft = {
  materialIds: string[];
  referenceId?: string | null;
  scripts: { title: string; body: string }[];
  templateIds: string[];
  bgmId: string | null;
  showTitle: boolean;
  showSubtitle: boolean;
};

export function isLiveJob(job: Job | null | undefined): job is Job {
  return job?.stage === "voice" || job?.stage === "lipsync" || job?.stage === "video";
}

export function restoreWorkbenchJob(jobs: Job[]): Job | null {
  return jobs.find((item) => isLiveJob(item)) ?? null;
}

export function draftFingerprint(draft: WorkbenchDraft): string {
  return JSON.stringify({
    materialIds: [...draft.materialIds].sort(),
    referenceId: draft.referenceId ?? null,
    scripts: draft.scripts.map((item) => ({ title: item.title, body: item.body })),
    templateIds: [...draft.templateIds],
    bgmId: draft.bgmId,
    showTitle: draft.showTitle,
    showSubtitle: draft.showSubtitle,
  });
}

export function shouldDetachWorkbenchJob(
  job: Job | null,
  previousDraft: string | null,
  nextDraft: string,
): boolean {
  if (!job || isLiveJob(job)) return false;
  if (previousDraft === null) return false;
  return previousDraft !== nextDraft;
}
