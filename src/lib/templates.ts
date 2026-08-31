export const DEFAULT_TEMPLATE_ID = "pure-white";

export type MediaFit = "cover" | "contain";

export type TextLook = {
  fontSize: number;
  color: string;
  borderColor: string;
  borderW: number;
  yExpr: string;
  boxColor?: string;
  boxBorderW?: number;
};

export type TemplateSkin = {
  id: string;
  name: string;
  description: string;
  mediaFit: MediaFit;
  title: TextLook;
  subtitle: TextLook;
};

function isLook(value: unknown): value is TextLook {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.fontSize === "number" &&
    typeof item.color === "string" &&
    typeof item.borderColor === "string" &&
    typeof item.borderW === "number" &&
    typeof item.yExpr === "string"
  );
}

function parseLook(value: unknown): TextLook {
  if (!isLook(value)) throw new Error("字效不完整");
  const item = value as TextLook & Record<string, unknown>;
  return {
    fontSize: item.fontSize,
    color: item.color,
    borderColor: item.borderColor,
    borderW: item.borderW,
    yExpr: item.yExpr,
    ...(typeof item.boxColor === "string" && item.boxColor.trim() ? { boxColor: item.boxColor } : {}),
    ...(typeof item.boxBorderW === "number" ? { boxBorderW: item.boxBorderW } : {}),
  };
}

export function parseTemplates(raw: unknown): TemplateSkin[] {
  if (!Array.isArray(raw)) {
    throw new Error("模板配置必须是数组");
  }
  return raw.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`模板第 ${index + 1} 项无效`);
    }
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id.trim()) {
      throw new Error(`模板第 ${index + 1} 项缺少 id`);
    }
    if (record.mediaFit !== "cover" && record.mediaFit !== "contain") {
      throw new Error(`模板 ${record.id} 的 mediaFit 无效`);
    }
    if (!isLook(record.title) || !isLook(record.subtitle)) {
      throw new Error(`模板 ${record.id} 的字效不完整`);
    }
    return {
      id: record.id,
      name: String(record.name ?? record.id),
      description: String(record.description ?? ""),
      mediaFit: record.mediaFit,
      title: parseLook(record.title),
      subtitle: parseLook(record.subtitle),
    };
  });
}

export function lookColor(value: string): string {
  return `#${value.replace(/^0x/i, "").split("@")[0]}`;
}

export function lookCssColor(value: string): string {
  const [hex = "000000", alpha] = value.replace(/^0x/i, "").split("@");
  if (!alpha) return `#${hex}`;
  const n = Number.parseInt(hex, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha)})`;
}

export function findTemplate(templates: TemplateSkin[], id: string): TemplateSkin {
  const found = templates.find((item) => item.id === id);
  if (!found) {
    throw new Error(`找不到模板 ${id}`);
  }
  return found;
}
