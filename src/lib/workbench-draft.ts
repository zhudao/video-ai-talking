import type { JobScript } from "./job-expand";
import { DEFAULT_TEMPLATE_ID } from "./templates";

export const WORKBENCH_STORAGE_KEY = "vat.workbench";

export type StoredWorkbench = {
  referenceId: string | null;
  scripts: JobScript[];
  templateIds: string[];
  bgmId: string | null;
  showTitle: boolean;
  showSubtitle: boolean;
};

export const EMPTY_WORKBENCH: StoredWorkbench = {
  referenceId: null,
  scripts: [],
  templateIds: [DEFAULT_TEMPLATE_ID],
  bgmId: null,
  showTitle: true,
  showSubtitle: true,
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseScripts(value: unknown): JobScript[] {
  if (!Array.isArray(value)) return [];
  const scripts: JobScript[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const captions = Array.isArray(row.captions)
      ? row.captions.flatMap((caption) => {
          if (!caption || typeof caption !== "object") return [];
          const cap = caption as Record<string, unknown>;
          const id = asString(cap.id);
          if (!id) return [];
          return [{
            id,
            text: asString(cap.text),
            ...(cap.cutaway === true ? { cutaway: true } : {}),
            ...(typeof cap.materialId === "string" ? { materialId: cap.materialId } : {}),
          }];
        })
      : undefined;
    scripts.push({ title: asString(row.title), body: asString(row.body), captions });
  }
  return scripts;
}

export function normalizeWorkbench(raw: unknown): StoredWorkbench {
  if (!raw || typeof raw !== "object") return { ...EMPTY_WORKBENCH };
  const record = raw as Record<string, unknown>;
  const templateIds = Array.isArray(record.templateIds)
    ? record.templateIds.map((item) => asString(item)).filter(Boolean).slice(0, 1)
    : [];
  return {
    referenceId: asString(record.referenceId).trim() || null,
    scripts: parseScripts(record.scripts),
    templateIds: templateIds.length > 0 ? templateIds : [DEFAULT_TEMPLATE_ID],
    bgmId: asString(record.bgmId).trim() || null,
    showTitle: record.showTitle !== false,
    showSubtitle: record.showSubtitle !== false,
  };
}

export function loadWorkbench(storage: Pick<Storage, "getItem"> = localStorage): StoredWorkbench {
  try {
    const raw = storage.getItem(WORKBENCH_STORAGE_KEY);
    if (!raw) return { ...EMPTY_WORKBENCH };
    return normalizeWorkbench(JSON.parse(raw) as unknown);
  } catch {
    return { ...EMPTY_WORKBENCH };
  }
}

export function saveWorkbench(
  draft: StoredWorkbench,
  storage: Pick<Storage, "setItem"> = localStorage,
): StoredWorkbench {
  const next = normalizeWorkbench(draft);
  storage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(next));
  return next;
}
