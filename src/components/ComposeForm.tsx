import { useState, type CSSProperties } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, type Job, type Material, type Template } from "@/lib/api";
import { isAiConfigured, isTtsConfigured, type AppConfig } from "@/lib/config";
import {
  SCRIPT_DURATION_MAX,
  SCRIPT_DURATION_MIN,
  SCRIPT_DURATION_PRESETS,
  clampScriptDuration,
  isPresetDuration,
  spokenCharsForDuration,
} from "@/lib/script-duration";
import {
  captionsToBody,
  newCaptionId,
  splitBodyByNewlines,
  splitBodyToCaptions,
  type CaptionSegment,
  type JobScript,
} from "@/lib/job-expand";
import { lookColor, lookCssColor } from "@/lib/templates";
import { cn } from "@/lib/cn";
import { FileDrop } from "./FileDrop";
import { JobPanel } from "./JobPanel";
import { OutputGallery } from "./OutputGallery";
import { VideoPreviewDialog } from "./VideoPreviewDialog";
import { VoicePicker } from "./VoicePicker";
import { Button, Input, Label, Textarea } from "./ui";

const MATERIAL_DRAG_TYPE = "application/x-vat-material";

const REFERENCE_GUIDE_DO =
  "传一段真人正面近景即可，脸清楚就行，不用念台词。竖屏更好，横屏也可以。";
const REFERENCE_GUIDE_DONT = "不要侧脸、远景、多人或脸被挡住。";

function withCaptions(script: JobScript, captions: CaptionSegment[]): JobScript {
  return { ...script, captions, body: captionsToBody(captions) };
}

function emptyScript(): JobScript {
  return { title: "", body: "", captions: [{ id: newCaptionId(), text: "" }] };
}

function currentScript(scripts: JobScript[]): JobScript {
  return scripts[0] ?? emptyScript();
}

async function applyLink(
  result: { cancelled?: boolean; added: number; skipped: number; truncated: boolean },
  onMaterialsChange: () => Promise<void>,
) {
  if (result.cancelled) return;
  if (result.added === 0 && result.skipped > 0) toast.message("没有符合条件的新文件");
  else if (result.added > 0) toast.success(`已引用 ${result.added} 个素材`);
  if (result.truncated) toast.message("最多引用 200 个文件，其余未导入");
  await onMaterialsChange();
}

export function ReferenceSection({
  materials,
  referenceId,
  onReferenceIdChange,
  onMaterialsChange,
}: {
  materials: Material[];
  referenceId: string | null;
  onReferenceIdChange: (id: string | null) => void;
  onMaterialsChange: () => Promise<void>;
}) {
  const reference = materials.find((item) => item.id === referenceId && item.kind === "video") ?? null;
  const [busy, setBusy] = useState(false);

  async function browseReference() {
    setBusy(true);
    try {
      const result = await api.browseFiles({ kinds: ["video"] });
      await applyLink(result, onMaterialsChange);
      const video = result.materials.find((item) => item.kind === "video");
      if (video) onReferenceIdChange(video.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "添加失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1 text-xs leading-5 text-muted-foreground">
        <p>{REFERENCE_GUIDE_DO}</p>
        <p>{REFERENCE_GUIDE_DONT}</p>
      </div>
      {reference ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="bg-foreground/90">
            <video
              aria-label="口播真人视频预览"
              src={reference.url}
              className="mx-auto max-h-72 w-full object-contain"
              controls
              preload="metadata"
              playsInline
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 truncate" title={reference.filename}>
              {reference.filename}
            </span>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void browseReference()}>
              替换
            </Button>
          </div>
        </div>
      ) : (
        <FileDrop
          label="添加口播真人视频"
          hint="拖入或选择本机视频，只引用原路径"
          busy={busy}
          onBrowse={() => void browseReference()}
          onLinkPaths={(paths) => {
            void (async () => {
              const result = await api.linkFiles(paths, { kinds: ["video"] });
              await applyLink(result, onMaterialsChange);
              const video = result.materials.find((item) => item.kind === "video");
              if (video) onReferenceIdChange(video.id);
            })();
          }}
          onMissingPaths={() => toast.error("这次拖入拿不到本机路径，请点「选择文件」")}
        />
      )}
    </div>
  );
}

export function CutawaySection({
  materials,
  referenceId,
  onMaterialsChange,
}: {
  materials: Material[];
  referenceId: string | null;
  onMaterialsChange: () => Promise<void>;
}) {
  const visuals = materials.filter((item) => item.kind !== "audio" && item.id !== referenceId);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = visuals.find((item) => item.id === previewId) ?? null;

  async function browse() {
    setBusy(true);
    try {
      await applyLink(await api.browseFiles({ kinds: ["image", "video"] }), onMaterialsChange);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "添加失败");
    } finally {
      setBusy(false);
    }
  }

  async function linkPaths(paths: string[]) {
    setBusy(true);
    try {
      await applyLink(await api.linkFiles(paths, { kinds: ["image", "video"] }), onMaterialsChange);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "添加失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <FileDrop
        label="添加图片或视频"
        hint="可拖到④字幕右侧的画面格。引用本机原文件"
        busy={busy}
        onBrowse={() => void browse()}
        onLinkPaths={(paths) => void linkPaths(paths)}
        onMissingPaths={() => toast.error("这次拖入拿不到本机路径，请点「选择文件」")}
      />
      {visuals.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">已添加 {visuals.length} 个素材</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
              清除全部
            </Button>
          </div>
          {confirmClear ? (
            <div className="rounded-lg border border-border bg-muted/40 p-2 text-xs">
              <p>将移除全部视频素材。口播真人视频和本机原文件不会删除。</p>
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={clearing}
                  onClick={() => {
                    void (async () => {
                      setClearing(true);
                      try {
                        await Promise.all(visuals.map((item) => api.deleteMaterial(item.id)));
                        await onMaterialsChange();
                        toast.success("已清除全部素材");
                        setConfirmClear(false);
                      } catch (error) {
                        toast.error(error instanceof ApiError ? error.message : "清除失败");
                      } finally {
                        setClearing(false);
                      }
                    })();
                  }}
                >
                  {clearing ? "清除中…" : "确认清除"}
                </Button>
              </div>
            </div>
          ) : null}
          <div data-testid="cutaway-grid" className="grid grid-cols-5 gap-1">
            {visuals.map((item) => (
              <div
                key={item.id}
                draggable
                className="relative cursor-grab overflow-hidden rounded-md border border-border bg-muted active:cursor-grabbing"
                onDragStart={(event) => {
                  event.dataTransfer.setData(MATERIAL_DRAG_TYPE, item.id);
                  event.dataTransfer.effectAllowed = "copy";
                }}
              >
                <button
                  type="button"
                  aria-label={`预览 ${item.filename}`}
                  className="block w-full"
                  onClick={() => setPreviewId(item.id)}
                >
                  {item.kind === "image" ? (
                    <img src={item.url} alt="" className="aspect-[9/16] w-full object-cover" title={item.filename} />
                  ) : (
                    <video
                      src={item.url}
                      className="aspect-[9/16] w-full object-cover"
                      muted
                      preload="metadata"
                      title={item.filename}
                    />
                  )}
                </button>
                <button
                  type="button"
                  aria-label={`删除 ${item.filename}`}
                  className="absolute right-0.5 top-0.5 rounded bg-card/90 px-1 py-0.5 text-[10px] leading-3"
                  onClick={(event) => {
                    event.stopPropagation();
                    void api.deleteMaterial(item.id).then(onMaterialsChange);
                  }}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {preview ? (
        <VideoPreviewDialog
          title={`预览 ${preview.filename}`}
          src={preview.url}
          kind={preview.kind === "image" ? "image" : "video"}
          mediaLabel="素材预览"
          showDownload={false}
          onClose={() => setPreviewId(null)}
        />
      ) : null}
    </div>
  );
}

export function VoiceSection({
  config,
  onChange,
  onOpenConfig,
  previewTts = api.previewTts,
}: {
  config: AppConfig;
  onChange: (next: AppConfig) => void;
  onOpenConfig?: () => void;
  previewTts?: (tts: {
    provider?: "volcengine" | "dashscope";
    appId?: string;
    accessToken?: string;
    voiceType: string;
    apiKey?: string;
  }) => Promise<Blob>;
}) {
  const keysReady =
    config.ttsProvider === "dashscope"
      ? Boolean(config.dashscopeApiKey)
      : Boolean(config.ttsAppId && config.ttsAccessToken);
  const voiceType = config.ttsProvider === "dashscope" ? config.dashscopeVoice : config.ttsVoiceType;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 rounded-lg border border-border p-0.5 text-xs">
        <button
          type="button"
          className={cn("rounded-md px-2 py-1.5", config.ttsProvider === "volcengine" && "bg-accent font-medium")}
          onClick={() => onChange({ ...config, ttsProvider: "volcengine" })}
        >
          火山引擎
        </button>
        <button
          type="button"
          className={cn("rounded-md px-2 py-1.5", config.ttsProvider === "dashscope" && "bg-accent font-medium")}
          onClick={() => onChange({ ...config, ttsProvider: "dashscope" })}
        >
          阿里百炼
        </button>
      </div>
      <VoicePicker
        id="voice-type"
        provider={config.ttsProvider}
        value={voiceType}
        canPreview={keysReady}
        onPreview={(nextVoice) =>
          previewTts(
            config.ttsProvider === "dashscope"
              ? { provider: "dashscope", voiceType: nextVoice, apiKey: config.dashscopeApiKey }
              : {
                  provider: "volcengine",
                  voiceType: nextVoice,
                  appId: config.ttsAppId,
                  accessToken: config.ttsAccessToken,
                },
          )
        }
        onChange={(value) =>
          onChange(
            config.ttsProvider === "dashscope"
              ? { ...config, dashscopeVoice: value }
              : { ...config, ttsVoiceType: value },
          )
        }
      />
      {isTtsConfigured(config) ? (
        <p className="text-xs text-muted-foreground">将用此音色生成口播。</p>
      ) : (
        <p className="text-xs text-primary">
          {keysReady
            ? "请选择或填写音色。"
            : config.ttsProvider === "dashscope"
              ? "请先在「配置」里填写阿里百炼 API Key。"
              : "请先在「配置」里填写火山引擎 App ID 和 Access Token。"}
          {onOpenConfig && !keysReady ? (
            <>
              {" "}
              <button type="button" className="underline underline-offset-2" onClick={onOpenConfig}>
                去填写
              </button>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}

export function BgmSection({
  materials,
  bgmId,
  onBgmIdChange,
  onMaterialsChange,
}: {
  materials: Material[];
  bgmId: string | null;
  onBgmIdChange: (id: string | null) => void;
  onMaterialsChange: () => Promise<void>;
}) {
  const audios = materials.filter((item) => item.kind === "audio");
  const [busy, setBusy] = useState(false);

  async function applyLink(result: { cancelled?: boolean; added: number; skipped: number; materials: { id: string }[] }) {
    if (result.cancelled) return;
    const first = result.materials[0];
    if (first) onBgmIdChange(first.id);
    if (result.added === 0 && result.skipped > 0) toast.message("这些音频已经添加过了");
    await onMaterialsChange();
  }

  async function browse() {
    setBusy(true);
    try {
      await applyLink(await api.browseFiles({ kinds: ["audio"] }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "添加失败");
    } finally {
      setBusy(false);
    }
  }

  async function linkPaths(paths: string[]) {
    setBusy(true);
    try {
      await applyLink(await api.linkFiles(paths.slice(0, 1), { kinds: ["audio"] }));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "添加失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <FileDrop
        label="添加背景音乐"
        hint="直接引用本机音频，不复制"
        busy={busy}
        onBrowse={() => void browse()}
        onLinkPaths={(paths) => void linkPaths(paths)}
        onMissingPaths={() => toast.error("这次拖入拿不到本机路径，请点「选择文件」")}
      />
      {audios.length > 0 && (
        <div className="space-y-2">
          {audios.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="bgm"
                checked={bgmId === item.id}
                onChange={() => onBgmIdChange(item.id)}
              />
              <span className="min-w-0 truncate">{item.filename}</span>
            </label>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => onBgmIdChange(null)}>
            不使用 BGM
          </Button>
        </div>
      )}
    </div>
  );
}

function applyShot(items: CaptionSegment[], id: string, materialId?: string): CaptionSegment[] {
  return items.map((item) =>
    item.id === id
      ? { ...item, cutaway: Boolean(materialId), materialId }
      : item,
  );
}

function ShotThumb({
  material,
  className,
  label,
}: {
  material: Material;
  className?: string;
  label?: string;
}) {
  return material.kind === "image" ? (
    <img src={material.url} alt={label ?? ""} className={cn("size-full object-cover", className)} />
  ) : (
    <video
      src={material.url}
      aria-label={label}
      className={cn("size-full object-cover", className)}
      muted
      preload="metadata"
      playsInline
    />
  );
}

function CaptionEditor({
  captions,
  materials,
  reference,
  onChange,
}: {
  captions: CaptionSegment[];
  materials: Material[];
  reference: Material | null;
  onChange: (captions: CaptionSegment[]) => void;
}) {
  const items = captions.length > 0 ? captions : [{ id: newCaptionId(), text: "" }];
  const [pickingId, setPickingId] = useState<string | null>(null);

  function chooseShot(id: string, materialId?: string) {
    onChange(applyShot(items, id, materialId));
    setPickingId(null);
  }

  return (
    <div className="space-y-1.5">
      <ol className="space-y-2">
        {items.map((segment, index) => {
          const material = materials.find((item) => item.id === segment.materialId) ?? null;
          const usingFace = !material;
          const picking = pickingId === segment.id;
          const faceLabel = reference ? "口播真人" : "请补充口播真人视频";
          return (
            <li
              key={segment.id}
              className="space-y-1.5 rounded-lg border border-border bg-card p-1.5"
              onDragOver={(event) => {
                if ([...event.dataTransfer.types].includes(MATERIAL_DRAG_TYPE)) event.preventDefault();
              }}
              onDrop={(event) => {
                const materialId = event.dataTransfer.getData(MATERIAL_DRAG_TYPE);
                if (!materialId || !materials.some((item) => item.id === materialId)) return;
                event.preventDefault();
                chooseShot(segment.id, materialId);
              }}
            >
              <div className="flex min-w-0 items-start gap-1.5">
                <span className="mt-2 w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <Textarea
                  aria-label={`字幕 ${index + 1}`}
                  value={segment.text}
                  rows={2}
                  className="min-h-[56px] min-w-0 flex-1 resize-y text-sm leading-5"
                  placeholder="输入这一句口播"
                  onChange={(event) =>
                    onChange(items.map((item) => (item.id === segment.id ? { ...item, text: event.target.value } : item)))
                  }
                />
                <button
                  type="button"
                  aria-expanded={picking}
                  aria-label={`字幕 ${index + 1} 画面：${usingFace ? faceLabel : material.filename}`}
                  className={cn(
                    "mt-0.5 flex w-16 shrink-0 flex-col overflow-hidden rounded-md border text-left",
                    usingFace ? "border-border bg-muted/40" : "border-primary bg-muted",
                  )}
                  onClick={() => setPickingId(picking ? null : segment.id)}
                >
                  <span
                    className={cn(
                      "relative flex aspect-[9/16] w-full items-center justify-center px-0.5 text-center text-[9px] leading-3",
                      usingFace ? "text-muted-foreground" : "bg-muted",
                    )}
                  >
                    {material ? (
                      <ShotThumb material={material} className="absolute inset-0" />
                    ) : reference ? (
                      <ShotThumb material={reference} label="口播真人预览" className="absolute inset-0" />
                    ) : null}
                  </span>
                  <span className={cn("px-1 py-1 text-[10px] leading-3 font-medium", usingFace ? "text-foreground" : "text-primary")}>
                    {usingFace ? faceLabel : `素材·${material.filename}`}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`删除字幕 ${index + 1}`}
                  disabled={items.length <= 1}
                  className="mt-1.5 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
                  onClick={() => onChange(items.filter((item) => item.id !== segment.id))}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {picking ? (
                <div className="pl-6" role="listbox" aria-label={`字幕 ${index + 1} 选画面`}>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      role="option"
                      aria-label={faceLabel}
                      aria-selected={usingFace}
                      className={cn(
                        "relative flex aspect-[9/16] flex-col items-center justify-center overflow-hidden rounded-md border bg-card text-[10px] leading-3",
                        usingFace ? "border-primary text-foreground" : "border-border text-muted-foreground",
                      )}
                      onClick={() => chooseShot(segment.id)}
                    >
                      {reference ? (
                        <ShotThumb material={reference} label="口播真人预览" className="absolute inset-0" />
                      ) : (
                        <span className="px-1 text-center text-[9px] leading-3">请补充口播真人视频</span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-card/90 py-0.5 text-center text-[9px]">
                        {reference ? "口播真人" : "未添加"}
                      </span>
                    </button>
                    {materials.map((item) => {
                      const selected = segment.materialId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-label={`选用 ${item.filename}`}
                          aria-selected={selected}
                          className={cn(
                            "relative overflow-hidden rounded-md border",
                            selected ? "border-primary" : "border-border",
                          )}
                          onClick={() => chooseShot(segment.id, item.id)}
                        >
                          <ShotThumb material={item} className="aspect-[9/16]" />
                          {selected ? (
                            <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-0.5 text-center text-[9px] text-primary-foreground">
                              已选
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {materials.length === 0
                      ? "还没有视频素材。先在左侧添加，或把素材拖到这一句上。"
                      : "点素材：这句切到该画面。点「口播真人」：这句改回人脸。"}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...items, { id: newCaptionId(), text: "" }])}
      >
        <Plus className="size-3.5" />
        添加字幕
      </Button>
    </div>
  );
}

export function ScriptSection({
  config,
  scripts,
  materials = [],
  reference = null,
  onScriptsChange,
  onConfigChange,
  onOpenConfig,
}: {
  config: AppConfig;
  scripts: JobScript[];
  materials?: Material[];
  reference?: Material | null;
  onScriptsChange: (scripts: JobScript[]) => void;
  onConfigChange?: (next: AppConfig) => void;
  onOpenConfig?: () => void;
}) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [topic, setTopic] = useState("");
  const [paste, setPaste] = useState("");
  const [generating, setGenerating] = useState(false);
  const [durationSec, setDurationSec] = useState(() => clampScriptDuration(config.scriptDurationSec));
  const [customOpen, setCustomOpen] = useState(() => !isPresetDuration(clampScriptDuration(config.scriptDurationSec)));
  const [customDraft, setCustomDraft] = useState(() => String(clampScriptDuration(config.scriptDurationSec)));
  const script = currentScript(scripts);
  const chars = spokenCharsForDuration(durationSec);

  function commitDuration(value: unknown) {
    const next = clampScriptDuration(value);
    setDurationSec(next);
    setCustomDraft(String(next));
    onConfigChange?.({ ...config, scriptDurationSec: next });
    return next;
  }

  function commit(next: JobScript) {
    onScriptsChange([next]);
  }

  async function generate() {
    if (!isAiConfigured(config)) {
      toast.error("请先在「配置」里填写 DeepSeek API Key，或改选「手动填写」");
      return;
    }
    setGenerating(true);
    try {
      const seconds = customOpen ? commitDuration(customDraft) : durationSec;
      const result = await api.generateScripts({
        apiKey: config.apiKey,
        topic,
        count: 1,
        durationSec: seconds,
      });
      const item = result.scripts[0];
      if (!item) {
        toast.error("没有生成到文案");
        return;
      }
      commit({ title: item.title, body: item.body, captions: splitBodyToCaptions(item.body) });
      toast.success("已填入标题和字幕，可继续改或选画面");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "生成文案失败");
    } finally {
      setGenerating(false);
    }
  }

  function splitPaste() {
    const captions = splitBodyByNewlines(paste).filter((item) => item.text.trim());
    const body = captionsToBody(captions);
    if (!body) {
      toast.error("请先粘贴完整文案");
      return;
    }
    commit({
      title: script.title,
      body,
      captions,
    });
    setPaste("");
  }

  const editor = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="script-title" className="text-xs text-muted-foreground">
          标题
        </Label>
        <Input
          id="script-title"
          aria-label="口播标题"
          value={script.title}
          placeholder="开头标题"
          onChange={(e) => commit({ ...script, title: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">
          右侧格子是这句在播什么。有口播真人视频时会显示预览；点一下即可选视频素材。
        </p>
        <CaptionEditor
          captions={script.captions ?? splitBodyToCaptions(script.body)}
          materials={materials}
          reference={reference}
          onChange={(next) => commit(withCaptions(script, next))}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 rounded-lg border border-border p-0.5 text-xs">
        <button
          type="button"
          className={cn("rounded-md px-2 py-1.5", mode === "ai" && "bg-accent font-medium")}
          onClick={() => setMode("ai")}
        >
          AI 生成
        </button>
        <button
          type="button"
          className={cn("rounded-md px-2 py-1.5", mode === "manual" && "bg-accent font-medium")}
          onClick={() => setMode("manual")}
        >
          手动填写
        </button>
      </div>

      {mode === "ai" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">成片时长</p>
              <div role="radiogroup" aria-label="成片时长" className="grid grid-cols-5 gap-1">
                {SCRIPT_DURATION_PRESETS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    role="radio"
                    aria-checked={!customOpen && durationSec === sec}
                    className={cn(
                      "rounded-md border border-border px-2 py-1.5 text-xs",
                      !customOpen && durationSec === sec && "bg-accent font-medium",
                    )}
                    onClick={() => {
                      setCustomOpen(false);
                      commitDuration(sec);
                    }}
                  >
                    {sec}秒
                  </button>
                ))}
                <button
                  type="button"
                  role="radio"
                  aria-checked={customOpen}
                  className={cn(
                    "rounded-md border border-border px-2 py-1.5 text-xs",
                    customOpen && "bg-accent font-medium",
                  )}
                  onClick={() => setCustomOpen(true)}
                >
                  自定义
                </button>
              </div>
              {customOpen ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={SCRIPT_DURATION_MIN}
                    max={SCRIPT_DURATION_MAX}
                    step={1}
                    aria-label="自定义秒数"
                    value={customDraft}
                    className="h-8 w-24"
                    onChange={(e) => setCustomDraft(e.target.value)}
                    onBlur={() => commitDuration(customDraft)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitDuration(customDraft);
                      }
                    }}
                  />
                  <span className="text-xs text-muted-foreground">秒（{SCRIPT_DURATION_MIN}–{SCRIPT_DURATION_MAX}）</span>
                </div>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                大约生成 {chars.min}–{chars.max} 字，念完接近 {durationSec} 秒。
              </p>
            </div>
            <Textarea
              aria-label="生成主题"
              value={topic}
              placeholder="例如：从周末亲子体验切入，突出环境和到店福利"
              className="min-h-16"
              onChange={(e) => setTopic(e.target.value)}
            />
            <Button type="button" className="h-9 w-full" disabled={generating} onClick={() => void generate()}>
              {generating ? "生成中…" : "生成这一条"}
            </Button>
            {!isAiConfigured(config) ? (
              <p className="text-xs text-primary">
                AI 生成需要 DeepSeek API Key。
                {onOpenConfig ? (
                  <>
                    {" "}
                    <button type="button" className="underline underline-offset-2" onClick={onOpenConfig}>
                      去填写
                    </button>
                  </>
                ) : null}
                或改选「手动填写」。
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">生成后可改标题、字幕和每句画面。</p>
            )}
          </div>
          {script.title || script.body ? editor : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="script-paste" className="text-xs text-muted-foreground">
              粘贴全文，按换行拆成字幕
            </Label>
            <Textarea
              id="script-paste"
              aria-label="完整文案"
              value={paste}
              placeholder="一段一行，也可以先写标题再拆"
              className="min-h-20"
              onChange={(e) => setPaste(e.target.value)}
            />
            <Button type="button" variant="secondary" className="w-full" onClick={splitPaste}>
              拆成字幕
            </Button>
          </div>
          {editor}
        </div>
      )}
    </div>
  );
}

function lookAlpha(value: string | undefined): number {
  const alpha = value?.replace(/^0x/i, "").split("@")[1];
  return alpha === undefined ? 1 : Number(alpha);
}

function templateSwatchStyle(item: Template): CSSProperties {
  const look = item.title;
  if (!look) return { background: "#C81E1E" };
  if (look.borderW > 0 && lookAlpha(look.color) < 0.2) {
    return {
      background: "#3A3F45",
      boxShadow: `inset 0 0 0 3px ${lookColor(look.borderColor)}`,
    };
  }
  if (look.borderW === 0) {
    return { background: lookColor(look.color) };
  }
  return { background: lookColor(look.borderColor) };
}

function previewLookStyle(
  look: Template["title"] | undefined,
  role: "title" | "subtitle",
): CSSProperties {
  const scale = 200 / 1080;
  const fontSize = Math.max(role === "title" ? 16 : 14, Math.round((look?.fontSize ?? 80) * scale));
  const style: CSSProperties = {
    color: lookCssColor(look?.color ?? "0xFFFFFF"),
    fontSize,
    paintOrder: "stroke fill",
  };
  if ((look?.borderW ?? 0) > 0) {
    style.WebkitTextStroke = `${Math.max((look?.borderW ?? 4) / 6, 1)}px ${lookColor(look?.borderColor ?? "0x111111")}`;
  }
  if (look?.boxColor) {
    style.backgroundColor = lookCssColor(look.boxColor);
    style.padding = `${Math.max(2, Math.round((look.boxBorderW ?? 12) * scale))}px 6px`;
    style.borderRadius = 4;
    style.display = "inline-block";
    style.left = "50%";
    style.right = "auto";
    style.transform = "translateX(-50%)";
    style.width = "max-content";
    style.maxWidth = "86%";
  }
  return style;
}

export function TemplatePreview({
  template,
  script,
  job,
  templates,
  regenerating,
  onRegenerate,
  showTitle = true,
  showSubtitle = true,
}: {
  template: Template | null;
  script: JobScript | null;
  job: Job | null;
  templates: Template[];
  regenerating: boolean;
  onRegenerate: () => void;
  showTitle?: boolean;
  showSubtitle?: boolean;
}) {
  const title = showTitle ? script?.title || "标题预览" : "";
  const subtitle = showSubtitle
    ? script?.captions?.find((item) => item.text.trim())?.text || script?.body || "字幕预览"
    : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        data-testid="template-preview"
        className={cn(
          "relative mx-auto w-full max-w-[200px] shrink-0 overflow-hidden rounded-xl border border-border",
          "aspect-[9/16]",
          template?.mediaFit === "contain" ? "bg-[#F4F1EA]" : "bg-neutral-800",
        )}
      >
        {title ? (
          <p
            className="absolute left-2 right-2 top-[7%] text-center font-semibold leading-tight"
            style={previewLookStyle(template?.title, "title")}
          >
            {title}
          </p>
        ) : null}
        {subtitle ? (
          <p
            className="absolute bottom-[12%] left-2 right-2 text-center font-semibold leading-tight"
            style={previewLookStyle(template?.subtitle, "subtitle")}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      <JobPanel job={job} templates={templates} regenerating={regenerating} onRegenerate={onRegenerate} compact />
      <OutputGallery job={job} />
    </div>
  );
}

export function TemplateStrip({
  templates,
  templateIds,
  activeId,
  onTemplateIdsChange,
  onActiveIdChange,
}: {
  templates: Template[];
  templateIds: string[];
  activeId: string | null;
  onTemplateIdsChange: (ids: string[]) => void;
  onActiveIdChange: (id: string | null) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {templates.map((item) => {
        const selected = templateIds.includes(item.id);
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected}
            aria-label={`${item.name}${selected ? "，已选中" : "，未选中"}`}
            className={cn(
              "relative flex w-[76px] shrink-0 flex-col gap-1 rounded-lg border-2 p-1.5 text-left transition-colors",
              selected
                ? "border-primary bg-accent ring-2 ring-primary/35"
                : "border-border bg-card hover:bg-muted/50",
              active && selected && "shadow-md",
            )}
            onClick={() => {
              if (!selected) {
                onTemplateIdsChange([item.id]);
                onActiveIdChange(item.id);
                return;
              }
              if (active) {
                onTemplateIdsChange([]);
                onActiveIdChange(null);
                return;
              }
              onActiveIdChange(item.id);
            }}
          >
            <div className="relative">
              <div
                className="h-12 w-full rounded-md"
                style={templateSwatchStyle(item)}
              />
              {selected ? (
                <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : null}
            </div>
            <div className="truncate text-[11px] font-medium">{item.name}</div>
            {selected ? <div className="text-[10px] font-medium text-primary">已选</div> : <div className="h-3.5" />}
          </button>
        );
      })}
    </div>
  );
}
