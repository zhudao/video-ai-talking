import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import {
  isAiConfigured,
  isDashscopeConfigured,
  isVideoretalkConfigured,
  isVolcengineConfigured,
  type AppConfig,
} from "@/lib/config";
import { SecretField } from "./SecretField";
import { Button, Card, Input, Label } from "./ui";

export function ConfigFields({
  config,
  onChange,
}: {
  config: AppConfig;
  onChange: (next: AppConfig) => void;
}) {
  const [busy, setBusy] = useState<"volc" | "dash" | "lipsync" | "ai" | null>(null);

  async function run(kind: "volc" | "dash" | "lipsync" | "ai", fn: () => Promise<unknown>, ok: string) {
    setBusy(kind);
    try {
      await fn();
      toast.success(ok);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "测试失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">AI配音配置</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            口播只需要一家就能出片：用火山就填火山，用百炼就填百炼。两家都想随时切换，就把两边都填上。出片时在「②
            配音」里选择用哪一家。
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <div>
              <h4 className="text-sm font-medium">火山引擎</h4>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                在火山引擎控制台开通语音合成后，把 App ID 和 Access Token 填在这里。
              </p>
            </div>
            <div>
              <Label htmlFor="tts-app">App ID</Label>
              <Input
                id="tts-app"
                value={config.ttsAppId}
                onChange={(e) => onChange({ ...config, ttsAppId: e.target.value })}
                placeholder="例如 1234567890"
              />
            </div>
            <SecretField
              id="tts-token"
              label="Access Token"
              value={config.ttsAccessToken}
              onChange={(value) => onChange({ ...config, ttsAccessToken: value })}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!isVolcengineConfigured(config) || busy !== null}
              onClick={() =>
                run(
                  "volc",
                  () =>
                    api.testTts({
                      provider: "volcengine",
                      appId: config.ttsAppId,
                      accessToken: config.ttsAccessToken,
                      voiceType: config.ttsVoiceType,
                    }),
                  "火山引擎连接成功",
                )
              }
            >
              {busy === "volc" ? "测试中…" : "测试火山引擎"}
            </Button>
          </div>
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <div>
              <h4 className="text-sm font-medium">阿里百炼</h4>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                只用于 CosyVoice 配音。对口型请到下面单独填写。配好后可在「② 配音」切换到百炼音色。
              </p>
            </div>
            <SecretField
              id="dashscope-key"
              label="配音 API Key"
              value={config.dashscopeApiKey}
              onChange={(value) => onChange({ ...config, dashscopeApiKey: value })}
              placeholder="以 sk- 开头"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!isDashscopeConfigured(config) || busy !== null}
              onClick={() =>
                run(
                  "dash",
                  () =>
                    api.testTts({
                      provider: "dashscope",
                      apiKey: config.dashscopeApiKey,
                      voiceType: config.dashscopeVoice,
                    }),
                  "阿里百炼连接成功",
                )
              }
            >
              {busy === "dash" ? "测试中…" : "测试阿里百炼"}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">AI口播对口型配置</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            出片必填。把参考视频和配音交给百炼 VideoRetalk 对口型。和上面的配音 Key 分开填，可以用同一把，也可以用另一把。
          </p>
        </div>
        <div className="max-w-xl space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div>
            <h4 className="text-sm font-medium">阿里百炼 VideoRetalk</h4>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              在百炼控制台开通 VideoRetalk 后，把对应 API Key 填在这里。
            </p>
          </div>
          <SecretField
            id="videoretalk-key"
            label="对口型 API Key"
            value={config.videoretalkApiKey}
            onChange={(value) => onChange({ ...config, videoretalkApiKey: value })}
            placeholder="以 sk- 开头"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!isVideoretalkConfigured(config) || busy !== null}
            onClick={() =>
              run("lipsync", () => api.testVideoretalk(config.videoretalkApiKey), "对口型配置连接成功")
            }
          >
            {busy === "lipsync" ? "测试中…" : "测试对口型配置"}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">AI文案配置</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            用来一键生成标题和字幕，不是出片必填。不配也能在「④ 文案」里自己写。
          </p>
        </div>
        <div className="max-w-xl space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div>
            <h4 className="text-sm font-medium">DeepSeek</h4>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              填了 API Key 才能用「AI 生成」文案；密钥只留在这台电脑的浏览器里。
            </p>
          </div>
          <SecretField
            id="api-key"
            label="API Key"
            value={config.apiKey}
            onChange={(value) => onChange({ ...config, apiKey: value })}
            placeholder="以 sk- 开头"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!isAiConfigured(config) || busy !== null}
            onClick={() => run("ai", () => api.testAi(config.apiKey), "DeepSeek 连接成功")}
          >
            {busy === "ai" ? "测试中…" : "测试 DeepSeek"}
          </Button>
        </div>
      </section>
    </div>
  );
}

export function ConfigPanel({
  open,
  config,
  onClose,
  onChange,
}: {
  open: boolean;
  config: AppConfig;
  onClose: () => void;
  onChange: (next: AppConfig) => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="fixed inset-0 bg-foreground/40"
        aria-label="关闭配置"
        onClick={onClose}
      />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="config-title"
        className="relative z-10 flex max-h-[85vh] w-[70%] flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 id="config-title" className="text-base font-semibold">
              配置
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              密钥只保存在这台电脑的浏览器里，不会写入任务文件。
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ConfigFields config={config} onChange={onChange} />
        </div>
      </Card>
    </div>
  );
}
