export const MAX_VIDEOS = 1;

export type CaptionSegment = {
  id: string;
  text: string;
  cutaway?: boolean;
  materialId?: string;
};

export type JobScript = {
  title: string;
  body: string;
  captions?: CaptionSegment[];
};

export function newCaptionId(): string {
  return `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function splitBodyToCaptions(body: string): CaptionSegment[] {
  const parts = body
    .split(/(?<=[。！？!?；;\n])/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length === 0) return [{ id: newCaptionId(), text: "" }];
  return parts.map((text) => ({ id: newCaptionId(), text }));
}

export function splitBodyByNewlines(body: string): CaptionSegment[] {
  const parts = body
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length === 0) return [{ id: newCaptionId(), text: "" }];
  return parts.map((text) => ({ id: newCaptionId(), text }));
}

export function captionsToBody(captions: CaptionSegment[]): string {
  return captions.map((item) => item.text.trim()).filter(Boolean).join("");
}

export function normalizeScript(script: JobScript): JobScript {
  const captions = (script.captions ?? []).map((item) => ({
    id: item.id || newCaptionId(),
    text: item.text,
    cutaway: item.cutaway,
    materialId: item.materialId,
  }));
  const fromCaptions = captions.map((item) => item.text.trim()).filter(Boolean);
  const body = fromCaptions.length > 0 ? fromCaptions.join("") : script.body.trim();
  return {
    title: script.title.trim(),
    body,
    captions: fromCaptions.length > 0 ? captions.filter((item) => item.text.trim()) : splitBodyToCaptions(body),
  };
}

export function splitSpokenPhrases(text: string, maxChars = 14): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const parts = normalized
    .split(/(?<=[，。！？；、,.!?;\n])/)
    .map((item) => item.trim())
    .filter(Boolean);
  const source = parts.length > 0 ? parts : [normalized];
  const merged: string[] = [];
  for (const part of source) {
    const last = merged[merged.length - 1];
    if (last && [...last].length + [...part].length <= maxChars) {
      merged[merged.length - 1] = `${last}${part}`;
      continue;
    }
    if ([...part].length <= maxChars) {
      merged.push(part);
      continue;
    }
    const chars = [...part];
    for (let i = 0; i < chars.length; i += maxChars) {
      merged.push(chars.slice(i, i + maxChars).join(""));
    }
  }
  return merged;
}

export function cuesFromScript(
  script: JobScript,
  durationMs: number,
): { text: string; startMs: number; endMs: number }[] {
  const parts = (script.captions ?? []).map((item) => item.text.trim()).filter(Boolean);
  const texts =
    parts.length > 0 ? parts.flatMap((item) => splitSpokenPhrases(item)) : splitSpokenPhrases(script.body);
  if (texts.length === 0) return [{ text: "", startMs: 0, endMs: durationMs }];
  const weights = texts.map((item) => Math.max([...item].length, 1));
  const total = weights.reduce((sum, item) => sum + item, 0);
  let cursor = 0;
  return texts.map((text, index) => {
    const startMs = Math.round(cursor);
    cursor = index === texts.length - 1 ? durationMs : cursor + (durationMs * (weights[index] ?? 1)) / total;
    return { text, startMs, endMs: Math.round(cursor) };
  });
}

export type ExpandJobInput = {
  scripts: JobScript[];
  templateIds: string[];
  referenceVideoId: string;
  requireTitle?: boolean;
};

export type ExpandedRow = {
  script: JobScript;
  templateId: string;
  referenceVideoId: string;
};

export class JobExpandError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "JobExpandError";
    this.code = code;
  }
}

export function completeScripts(scripts: JobScript[], opts?: { requireTitle?: boolean }): JobScript[] {
  const requireTitle = opts?.requireTitle !== false;
  return scripts.map(normalizeScript).filter((item) => item.body && (!requireTitle || item.title));
}

export function expandJob(input: ExpandJobInput): ExpandedRow[] {
  const scripts = completeScripts(input.scripts, { requireTitle: input.requireTitle }).slice(0, 1);
  const templateIds = [...new Set(input.templateIds.map((id) => id.trim()).filter(Boolean))].slice(0, 1);
  const referenceVideoId = input.referenceVideoId.trim();

  if (scripts.length === 0) {
    throw new JobExpandError("invalid_scripts", "需要一条完整文案（标题和字幕）");
  }
  if (templateIds.length !== 1) {
    throw new JobExpandError("invalid_templates", "请选择一套模板");
  }
  if (!referenceVideoId) {
    throw new JobExpandError("invalid_reference", "请添加一段口播真人视频");
  }

  return [
    {
      script: scripts[0]!,
      templateId: templateIds[0]!,
      referenceVideoId,
    },
  ];
}
