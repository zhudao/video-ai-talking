import { SCRIPT_DURATION_DEFAULT, clampScriptDuration } from "./script-duration";

export const CONFIG_STORAGE_KEY = "vat.config";
export const CONFIG_COLLAPSED_KEY = "vat.configCollapsed";

export type TtsProvider = "volcengine" | "dashscope";

export type AppConfig = {
  apiKey: string;
  ttsProvider: TtsProvider;
  ttsAppId: string;
  ttsAccessToken: string;
  ttsVoiceType: string;
  dashscopeApiKey: string;
  dashscopeVoice: string;
  videoretalkApiKey: string;
  scriptDurationSec: number;
  updatedAt: string;
};

export const EMPTY_CONFIG: AppConfig = {
  apiKey: "",
  ttsProvider: "volcengine",
  ttsAppId: "",
  ttsAccessToken: "",
  ttsVoiceType: "",
  dashscopeApiKey: "",
  dashscopeVoice: "longanyang",
  videoretalkApiKey: "",
  scriptDurationSec: SCRIPT_DURATION_DEFAULT,
  updatedAt: "",
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeConfig(raw: unknown): AppConfig {
  if (!raw || typeof raw !== "object") return { ...EMPTY_CONFIG };
  const record = raw as Record<string, unknown>;
  return {
    apiKey: asString(record.apiKey).trim(),
    ttsProvider: record.ttsProvider === "dashscope" ? "dashscope" : "volcengine",
    ttsAppId: asString(record.ttsAppId).trim(),
    ttsAccessToken: asString(record.ttsAccessToken).trim(),
    ttsVoiceType: asString(record.ttsVoiceType).trim(),
    dashscopeApiKey: asString(record.dashscopeApiKey).trim(),
    dashscopeVoice: asString(record.dashscopeVoice).trim() || "longanyang",
    videoretalkApiKey: asString(record.videoretalkApiKey).trim(),
    scriptDurationSec: clampScriptDuration(record.scriptDurationSec),
    updatedAt: asString(record.updatedAt),
  };
}

export function loadConfig(storage: Pick<Storage, "getItem"> = localStorage): AppConfig {
  try {
    const raw = storage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return { ...EMPTY_CONFIG };
    return normalizeConfig(JSON.parse(raw) as unknown);
  } catch {
    return { ...EMPTY_CONFIG };
  }
}

export function saveConfig(
  config: AppConfig,
  storage: Pick<Storage, "setItem"> = localStorage,
): AppConfig {
  const next = normalizeConfig({
    ...config,
    updatedAt: new Date().toISOString(),
  });
  storage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function isVolcengineConfigured(config: AppConfig): boolean {
  return Boolean(config.ttsAppId && config.ttsAccessToken && config.ttsVoiceType);
}

export function isDashscopeConfigured(config: AppConfig): boolean {
  return Boolean(config.dashscopeApiKey && config.dashscopeVoice);
}

export function isTtsConfigured(config: AppConfig): boolean {
  return config.ttsProvider === "dashscope" ? isDashscopeConfigured(config) : isVolcengineConfigured(config);
}

export function isVideoretalkConfigured(config: AppConfig): boolean {
  return Boolean(config.videoretalkApiKey);
}

export function isAiConfigured(config: AppConfig): boolean {
  return Boolean(config.apiKey);
}

export function currentVoice(config: AppConfig): string {
  return config.ttsProvider === "dashscope" ? config.dashscopeVoice : config.ttsVoiceType;
}

export function loadConfigCollapsed(storage: Pick<Storage, "getItem"> = localStorage): boolean {
  return storage.getItem(CONFIG_COLLAPSED_KEY) !== "0";
}

export function saveConfigCollapsed(
  collapsed: boolean,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(CONFIG_COLLAPSED_KEY, collapsed ? "1" : "0");
}

export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return "••••";
  return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
}
