import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GENDER_LABEL, catalogFor, filterVoices, findCatalogVoice, type VoiceGender } from "@/lib/voices";
import type { TtsProvider } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Button, Card, Input } from "./ui";

const GENDER_FILTERS: Array<{ value: "all" | VoiceGender; label: string }> = [
  { value: "all", label: "全部" },
  { value: "female", label: "女" },
  { value: "male", label: "男" },
  { value: "child", label: "童" },
];

export function VoicePicker({
  id,
  value,
  provider,
  onChange,
  canPreview,
  onPreview,
}: {
  id: string;
  value: string;
  provider: TtsProvider;
  onChange: (value: string) => void;
  canPreview: boolean;
  onPreview: (voiceType: string) => Promise<Blob>;
}) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const catalog = catalogFor(provider);
  const builtin = findCatalogVoice(provider, value);
  const isCustom = Boolean(value.trim()) && !builtin;

  return (
    <div className="space-y-2">
      <Card className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          {builtin ? (
            <>
              <p className="truncate text-sm font-medium">{builtin.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {GENDER_LABEL[builtin.gender]} · {builtin.use}
              </p>
            </>
          ) : isCustom ? (
            <>
              <p className="text-sm font-medium">自定义音色</p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{value}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">还没选音色</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <PreviewButton
            name={builtin?.name ?? (value.trim() || "当前音色")}
            voiceType={value}
            canPreview={canPreview && Boolean(value.trim())}
            onPreview={onPreview}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {value.trim() ? "更换音色" : "选择音色"}
          </Button>
        </div>
      </Card>
      {open ? (
        <VoicePickerDialog
          id={id}
          provider={provider}
          catalog={catalog}
          value={value}
          canPreview={canPreview}
          customOpen={customOpen || isCustom}
          onCustomOpen={() => setCustomOpen(true)}
          onClose={() => setOpen(false)}
          onChange={onChange}
          onPreview={onPreview}
        />
      ) : null}
    </div>
  );
}

function VoicePickerDialog({
  id,
  provider,
  catalog,
  value,
  canPreview,
  customOpen,
  onCustomOpen,
  onClose,
  onChange,
  onPreview,
}: {
  id: string;
  provider: TtsProvider;
  catalog: ReturnType<typeof catalogFor>;
  value: string;
  canPreview: boolean;
  customOpen: boolean;
  onCustomOpen: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  onPreview: (voiceType: string) => Promise<Blob>;
}) {
  const titleId = useId();
  const [gender, setGender] = useState<"all" | VoiceGender>("all");
  const [query, setQuery] = useState("");
  const title = provider === "dashscope" ? "选择阿里百炼音色" : "选择火山音色";
  const visible = filterVoices(catalog, { gender, query });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" aria-label="关闭音色选择" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(36rem,calc(100vh-2rem))] w-[min(40rem,calc(100vw-2rem))] flex-col rounded-xl border border-border bg-card shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2.5">
          <h2 id={titleId} className="text-sm font-semibold">
            {title}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            {GENDER_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={cn("rounded-md px-2 py-1", gender === item.value && "bg-accent font-medium")}
                onClick={() => setGender(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称或 ID"
            className="h-8 min-w-0 flex-1"
            aria-label="搜索音色"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2">
            {visible.map((voice) => {
              const selected = voice.id === value;
              return (
                <div
                  key={voice.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`选择 ${voice.name}`}
                  className={cn(
                    "flex cursor-pointer items-start justify-between gap-2 rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/40",
                    selected ? "border-primary bg-primary/5" : "border-border",
                  )}
                  onClick={() => {
                    onChange(voice.id);
                    onClose();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onChange(voice.id);
                      onClose();
                    }
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{voice.name}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {GENDER_LABEL[voice.gender]} · {voice.use}
                    </span>
                  </span>
                  <PreviewButton
                    name={voice.name}
                    voiceType={voice.id}
                    canPreview={canPreview}
                    onPreview={onPreview}
                  />
                </div>
              );
            })}
          </div>
          {visible.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">没有匹配的音色</p> : null}
          <div className="mt-3">
            {customOpen ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium" htmlFor={`${id}-custom`}>
                  自定义音色 ID
                </label>
                <Input
                  id={`${id}-custom`}
                  value={catalog.some((item) => item.id === value) ? "" : value}
                  placeholder={provider === "dashscope" ? "例如 longanyang" : "例如 BV001_streaming"}
                  onChange={(event) => onChange(event.target.value)}
                />
              </div>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={onCustomOpen}>
                使用自定义音色 ID
              </Button>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {provider === "dashscope" ? "可在百炼控制台的 CosyVoice 音色列表查找更多 ID。" : "可在火山引擎文档的音色列表查找更多 ID。"}{" "}
              <a
                className="underline underline-offset-2"
                href={
                  provider === "dashscope"
                    ? "https://help.aliyun.com/zh/model-studio/cosyvoice-voice-list"
                    : "https://www.volcengine.com/docs/6561/97465"
                }
                target="_blank"
                rel="noreferrer"
              >
                打开音色列表文档
              </a>
            </p>
          </div>
        </div>
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          试听会用当前密钥合成约十个字，消耗对应厂商额度。
        </p>
      </div>
    </div>,
    document.body,
  );
}

function PreviewButton({
  name,
  voiceType,
  canPreview,
  onPreview,
}: {
  name: string;
  voiceType: string;
  canPreview: boolean;
  onPreview: (voiceType: string) => Promise<Blob>;
}) {
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return (
    <span className="inline-flex flex-col items-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!canPreview || busy || !voiceType.trim()}
        aria-label={playing ? `停止 ${name}` : `试听 ${name}`}
        onClick={async (event) => {
          event.stopPropagation();
          if (playing) {
            audioRef.current?.pause();
            setPlaying(false);
            return;
          }
          setBusy(true);
          setError("");
          try {
            const blob = await onPreview(voiceType);
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
            const url = URL.createObjectURL(blob);
            urlRef.current = url;
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => setPlaying(false);
            await audio.play();
            setPlaying(true);
          } catch (err) {
            setError(err instanceof Error && err.message.trim() ? err.message : "合成失败，请检查密钥或音色 ID");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "合成中" : playing ? "停止" : "试听"}
      </Button>
      {error ? <span className="max-w-40 truncate text-[10px] text-destructive">{error}</span> : null}
    </span>
  );
}
