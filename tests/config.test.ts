import { describe, expect, it } from "vitest";
import {
  CONFIG_COLLAPSED_KEY,
  CONFIG_STORAGE_KEY,
  isAiConfigured,
  isDashscopeConfigured,
  isTtsConfigured,
  isVideoretalkConfigured,
  isVolcengineConfigured,
  loadConfig,
  loadConfigCollapsed,
  maskSecret,
  normalizeConfig,
  saveConfig,
  saveConfigCollapsed,
} from "../src/lib/config";

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("config", () => {
  it("uses an independent storage key", () => {
    expect(CONFIG_STORAGE_KEY).toBe("vat.config");
    expect(CONFIG_COLLAPSED_KEY).toBe("vat.configCollapsed");
  });

  it("normalizes missing and illegal fields", () => {
    expect(normalizeConfig(null)).toMatchObject({ apiKey: "", ttsAppId: "" });
    expect(normalizeConfig({ apiKey: 1, ttsAppId: "  app  " })).toMatchObject({
      apiKey: "",
      ttsAppId: "app",
    });
  });

  it("round-trips through storage without leaking extra keys", () => {
    const storage = memory();
    const saved = saveConfig(
      {
        ...normalizeConfig({
          apiKey: "sk-test",
          ttsAppId: "aid",
          ttsAccessToken: "tok",
          ttsVoiceType: "BV001",
        }),
        updatedAt: "",
      },
      storage,
    );
    expect(saved.updatedAt).toBeTruthy();
    expect(JSON.parse(storage.getItem(CONFIG_STORAGE_KEY) ?? "{}")).not.toHaveProperty("cookie");
    expect(loadConfig(storage).ttsVoiceType).toBe("BV001");
  });

  it("detects TTS and AI readiness separately", () => {
    const empty = normalizeConfig({});
    expect(isTtsConfigured(empty)).toBe(false);
    expect(isAiConfigured(empty)).toBe(false);
    expect(
      isTtsConfigured(
        normalizeConfig({ ttsAppId: "a", ttsAccessToken: "b", ttsVoiceType: "c" }),
      ),
    ).toBe(true);
    expect(isAiConfigured(normalizeConfig({ apiKey: "sk" }))).toBe(true);
    expect(
      isVolcengineConfigured(normalizeConfig({ ttsAppId: "a", ttsAccessToken: "b", ttsVoiceType: "c" })),
    ).toBe(true);
    expect(
      isDashscopeConfigured(normalizeConfig({ dashscopeApiKey: "sk-bai", dashscopeVoice: "longanyang" })),
    ).toBe(true);
    expect(
      isTtsConfigured(
        normalizeConfig({
          ttsProvider: "dashscope",
          dashscopeApiKey: "sk-bai",
          dashscopeVoice: "longanyang",
        }),
      ),
    ).toBe(true);
    expect(isTtsConfigured(normalizeConfig({ ttsProvider: "dashscope", dashscopeApiKey: "" }))).toBe(false);
    expect(isVideoretalkConfigured(normalizeConfig({}))).toBe(false);
    expect(isVideoretalkConfigured(normalizeConfig({ videoretalkApiKey: "sk-lip" }))).toBe(true);
    expect(isVideoretalkConfigured(normalizeConfig({ dashscopeApiKey: "sk-bai" }))).toBe(false);
    expect(normalizeConfig({ videoretalkApiKey: "  sk-lip  " }).videoretalkApiKey).toBe("sk-lip");
    expect(normalizeConfig({}).scriptDurationSec).toBe(30);
    expect(normalizeConfig({ scriptDurationSec: 15 }).scriptDurationSec).toBe(15);
    expect(normalizeConfig({ scriptDurationSec: 99 }).scriptDurationSec).toBe(60);
  });

  it("masks secrets and persists collapse", () => {
    expect(maskSecret("")).toBe("");
    expect(maskSecret("ab")).toBe("••••");
    expect(maskSecret("sk-abcdef")).toBe("sk••••ef");
    const storage = memory();
    expect(loadConfigCollapsed(storage)).toBe(true);
    saveConfigCollapsed(false, storage);
    expect(storage.getItem(CONFIG_COLLAPSED_KEY)).toBe("0");
    expect(loadConfigCollapsed(storage)).toBe(false);
  });
});
