export class AppError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export function formatToolFailure(where: string, hint: string, raw: unknown): string {
  return `【${where}】${hint}\n原始返回：${serializeRaw(raw)}`;
}

function serializeRaw(raw: unknown): string {
  if (typeof raw === "string") return raw.trim() || "(空)";
  if (raw && typeof raw === "object") {
    const record = { ...(raw as Record<string, unknown>) };
    if (typeof record.data === "string" && record.data.length > 120) {
      record.data = `[base64 已省略 ${record.data.length} 字符]`;
    }
    try {
      return JSON.stringify(record);
    } catch {
      return String(raw);
    }
  }
  return String(raw);
}

export function errorBody(error: unknown): { error: string; message: string; status: number } {
  if (error instanceof AppError) {
    return { error: error.code, message: error.message, status: error.status };
  }
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    const code = String((error as { code: unknown }).code);
    const message = String((error as { message: unknown }).message);
    return { error: code, message, status: 400 };
  }
  return { error: "internal", message: "服务出错，请稍后重试", status: 500 };
}
