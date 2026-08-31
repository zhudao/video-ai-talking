import { completeScripts, type JobScript } from "./job-expand.ts";
import { assertCutawaysReady } from "./broll-timeline.ts";
import { isTtsConfigured, type AppConfig } from "./config.ts";

function completeCount(scripts: JobScript[], showTitle = true) {
  return completeScripts(scripts, { requireTitle: showTitle }).length;
}

export function canStartJob(input: {
  config: AppConfig;
  hasReference: boolean;
  scripts: JobScript[];
  templateIds: string[];
  showTitle?: boolean;
}): boolean {
  return missingJobRequirements(input).length === 0;
}

export function missingJobRequirements(input: {
  config: AppConfig;
  hasReference: boolean;
  scripts: JobScript[];
  templateIds: string[];
  showTitle?: boolean;
}): string[] {
  const items: string[] = [];
  if (!input.hasReference) items.push("先添加一段口播真人视频");
  if (!isTtsConfigured(input.config)) {
    items.push(input.config.ttsProvider === "dashscope" ? "先填写阿里百炼配音 Key" : "先填写火山 TTS 配置");
  }
  if (!input.config.videoretalkApiKey.trim()) {
    items.push("先填写 AI口播对口型配置");
  }
  if (completeCount(input.scripts, input.showTitle) <= 0) {
    items.push(input.showTitle === false ? "先写好口播字幕" : "先写好标题和字幕");
  }
  const cutaway = assertCutawaysReady(input.scripts[0]?.captions ?? []);
  if (cutaway) items.push(cutaway);
  if (input.templateIds.length !== 1) items.push("先选择一套模板");
  return items;
}

export function startBlockedReason(input: {
  config: AppConfig;
  hasReference: boolean;
  scripts: JobScript[];
  templateIds: string[];
  showTitle?: boolean;
}): string | null {
  return missingJobRequirements(input)[0] ?? null;
}

export type WorkflowStep = "1" | "2" | "3" | "4" | "5";
export type RequirementTarget = WorkflowStep | "config";

export function requirementStep(requirement: string): RequirementTarget {
  if (requirement.includes("对口型")) return "config";
  if (requirement.includes("模板")) return "5";
  if (requirement.includes("TTS") || requirement.includes("配音") || requirement.includes("百炼") || requirement.includes("火山")) {
    return "2";
  }
  if (
    requirement.includes("文案") ||
    requirement.includes("标题") ||
    requirement.includes("口播字幕") ||
    requirement.includes("切到素材")
  ) {
    return "4";
  }
  if (requirement.includes("BGM")) return "3";
  return "1";
}
