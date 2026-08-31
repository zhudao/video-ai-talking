import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import {
  BgmSection,
  CutawaySection,
  ReferenceSection,
  ScriptSection,
  TemplatePreview,
  TemplateStrip,
  VoiceSection,
} from "./components/ComposeForm";
import { ConfigPanel } from "./components/ConfigPanel";
import { OutputLibrary } from "./components/OutputLibrary";
import { OutputToolbar } from "./components/OutputToolbar";
import { VisibilityControls } from "./components/VisibilityControls";
import { WorkflowPanel } from "./components/WorkflowPanel";
import { api, ApiError, type Job, type Material, type Template } from "./lib/api";
import {
  currentVoice,
  loadConfig,
  saveConfig,
  type AppConfig,
} from "./lib/config";
import { completeScripts, type JobScript } from "./lib/job-expand";
import { DEFAULT_TEMPLATE_ID } from "./lib/templates";
import type { RequirementTarget, WorkflowStep } from "./lib/job-ready";
import { listFinishedOutputs } from "./lib/outputs";
import { SCRIPT_DURATION_DEFAULT } from "./lib/script-duration";
import { clearWorkbench, loadWorkbench, saveWorkbench } from "./lib/workbench-draft";
import {
  draftFingerprint,
  restoreWorkbenchJob,
  shouldDetachWorkbenchJob,
} from "./lib/workbench-job";
import { BrandMark } from "./components/BrandMark";
import { GitHubLink } from "./components/GitHubLink";
import { Button } from "./components/ui";

export default function App() {
  const [config, setConfig] = useState<AppConfig>(() => loadConfig());
  const [configOpen, setConfigOpen] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsReady, setMaterialsReady] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [scripts, setScripts] = useState<JobScript[]>(() => loadWorkbench().scripts);
  const [templateIds, setTemplateIds] = useState<string[]>(() => loadWorkbench().templateIds);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(
    () => loadWorkbench().templateIds[0] ?? DEFAULT_TEMPLATE_ID,
  );
  const [bgmId, setBgmId] = useState<string | null>(() => loadWorkbench().bgmId);
  const [referenceId, setReferenceId] = useState<string | null>(() => loadWorkbench().referenceId);
  const [job, setJob] = useState<Job | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [highlighted, setHighlighted] = useState<WorkflowStep | null>(null);
  const [showTitle, setShowTitle] = useState(() => loadWorkbench().showTitle);
  const [showSubtitle, setShowSubtitle] = useState(() => loadWorkbench().showSubtitle);
  const [resetOpen, setResetOpen] = useState(false);
  const [formEpoch, setFormEpoch] = useState(0);
  const highlightTimer = useRef<number | null>(null);
  const attachedDraft = useRef<string | null>(null);

  const contentRef = useRef<HTMLElement>(null);
  const voiceRef = useRef<HTMLElement>(null);
  const bgmRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLElement>(null);
  const templateRef = useRef<HTMLElement>(null);

  const refreshMaterials = useCallback(async () => {
    const data = await api.materials();
    setMaterials(data.materials);
    setMaterialsReady(true);
  }, []);

  useEffect(() => {
    saveWorkbench({
      referenceId,
      scripts,
      templateIds,
      bgmId,
      showTitle,
      showSubtitle,
    });
  }, [referenceId, scripts, templateIds, bgmId, showTitle, showSubtitle]);

  useEffect(() => {
    if (!materialsReady) return;
    if (referenceId && !materials.some((item) => item.id === referenceId && item.kind === "video")) {
      setReferenceId(null);
    }
    if (bgmId && !materials.some((item) => item.id === bgmId && item.kind === "audio")) {
      setBgmId(null);
    }
  }, [materials, materialsReady, referenceId, bgmId]);

  useEffect(() => {
    void api
      .templates()
      .then((data) => setTemplates(data.templates))
      .catch(() => toast.error("无法加载模板"));
    void refreshMaterials().catch(() => toast.error("无法加载素材"));
    void api
      .jobs()
      .then((data) => {
        setJobs(data.jobs);
        const live = restoreWorkbenchJob(data.jobs);
        setJob(live);
        attachedDraft.current = live ? draftFingerprint({
          materialIds: materials.filter((item) => item.kind !== "audio").map((item) => item.id),
          referenceId,
          scripts,
          templateIds,
          bgmId,
          showTitle,
          showSubtitle,
        }) : null;
      })
      .catch(() => undefined);
  }, [refreshMaterials]);

  function applyCurrentJob(next: Job) {
    setJob(next);
    attachedDraft.current = draftFingerprint({
      materialIds: materials.filter((item) => item.kind !== "audio").map((item) => item.id),
      referenceId,
      scripts,
      templateIds,
      bgmId,
      showTitle,
      showSubtitle,
    });
    setJobs((prev) =>
      [next, ...prev.filter((item) => item.id !== next.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  useEffect(() => {
    if (!job || job.stage === "done" || job.stage === "failed") return;
    const timer = window.setInterval(() => {
      void api.job(job.id).then((data) => applyCurrentJob(data.job));
    }, 1200);
    return () => window.clearInterval(timer);
  }, [job]);

  function applyEmptyWorkbench() {
    const empty = clearWorkbench();
    setReferenceId(empty.referenceId);
    setScripts(empty.scripts);
    setTemplateIds(empty.templateIds);
    setActiveTemplateId(empty.templateIds[0] ?? DEFAULT_TEMPLATE_ID);
    setBgmId(empty.bgmId);
    setShowTitle(empty.showTitle);
    setShowSubtitle(empty.showSubtitle);
    setJob(null);
    attachedDraft.current = null;
    setConfig((prev) => saveConfig({ ...prev, scriptDurationSec: SCRIPT_DURATION_DEFAULT }));
    setFormEpoch((n) => n + 1);
  }

  function resetWorkbench() {
    applyEmptyWorkbench();
    setResetOpen(false);
    toast.success("已清空填写信息，刷新后也不会恢复");
  }

  function openConfig() {
    setConfigOpen(true);
  }

  function focusStep(step: RequirementTarget) {
    if (step === "config" || step === "2") openConfig();
    if (step === "config") return;
    const refs = {
      "1": contentRef,
      "2": voiceRef,
      "3": bgmRef,
      "4": copyRef,
      "5": templateRef,
    };
    refs[step].current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlighted(step);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlighted(null), 2200);
  }

  async function start() {
    setStarting(true);
    try {
      const data = await api.createJob({
        tts: {
          provider: config.ttsProvider,
          appId: config.ttsAppId,
          accessToken: config.ttsAccessToken,
          apiKey: config.dashscopeApiKey,
          voiceType: currentVoice(config),
        },
        videoretalkApiKey: config.videoretalkApiKey,
        referenceVideoId: referenceId ?? "",
        scripts: completeScripts(scripts, { requireTitle: showTitle }).slice(0, 1),
        templateIds,
        bgmMaterialId: bgmId,
        showTitle,
        showSubtitle,
      });
      applyCurrentJob(data.job);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "创建任务失败");
    } finally {
      setStarting(false);
    }
  }

  async function regenerate() {
    if (!job) return;
    setRegenerating(true);
    try {
      const data = await api.regenerateJob(job.id, {
        tts: {
          provider: config.ttsProvider,
          appId: config.ttsAppId,
          accessToken: config.ttsAccessToken,
          apiKey: config.dashscopeApiKey,
          voiceType: currentVoice(config),
        },
        videoretalkApiKey: config.videoretalkApiKey,
      });
      applyCurrentJob(data.job);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "重新生成失败");
    } finally {
      setRegenerating(false);
    }
  }

  async function deleteLibraryOutput(jobId: string, videoId: string) {
    try {
      await api.deleteOutput(jobId, videoId);
      const data = await api.jobs();
      setJobs(data.jobs);
      if (job?.id === jobId) {
        const remaining = data.jobs.find((item) => item.id === jobId) ?? null;
        setJob(remaining);
        if (!remaining) attachedDraft.current = null;
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "删除成片失败");
    }
  }

  const finishedCount = listFinishedOutputs(jobs).length;
  const visuals = materials.filter((item) => item.kind !== "audio");
  const currentDraft = draftFingerprint({
    materialIds: visuals.map((item) => item.id),
    referenceId,
    scripts,
    templateIds,
    bgmId,
    showTitle,
    showSubtitle,
  });

  useEffect(() => {
    if (!shouldDetachWorkbenchJob(job, attachedDraft.current, currentDraft)) return;
    setJob(null);
    attachedDraft.current = null;
  }, [currentDraft, job]);

  const activeTemplate =
    templates.find((item) => item.id === activeTemplateId) ??
    templates.find((item) => item.id === templateIds[0]) ??
    null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Toaster position="top-center" />
      <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4 lg:px-6">
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="z-20 shrink-0 rounded-xl border border-border bg-card px-4 py-2 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-2.5">
                <BrandMark className="mt-px" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-sm font-semibold">AI真人口播视频生成</h1>
                    <GitHubLink />
                    <Button type="button" variant="secondary" size="sm" onClick={openConfig}>
                      配置
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setLibraryOpen(true)}>
                      成片库{finishedCount > 0 ? ` ${finishedCount}` : ""}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setResetOpen(true)}>
                      重置
                    </Button>
                  </div>
                  <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                    上传一段真人视频，写好字幕，自动配音并对上口型；需要时还能切入视频素材，生成一条竖屏视频。
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <OutputToolbar
                  config={config}
                  hasReference={Boolean(referenceId)}
                  scripts={scripts}
                  templateIds={templateIds}
                  showTitle={showTitle}
                  busy={starting}
                  onStart={() => void start()}
                  onRequirementClick={focusStep}
                />
              </div>
            </div>
            {resetOpen ? (
              <div
                role="region"
                aria-label="确认重置工作台"
                className="mt-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs"
              >
                <p>
                  将清空口播选择、BGM 选择、文案、模板和本机草稿，刷新后也不会再恢复。已添加的素材文件、配置密钥和成片库不会删除。
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setResetOpen(false)}>
                    取消
                  </Button>
                  <Button type="button" size="sm" variant="danger" onClick={resetWorkbench}>
                    确认重置
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <ConfigPanel
            open={configOpen}
            config={config}
            onClose={() => setConfigOpen(false)}
            onChange={(next) => setConfig(saveConfig(next))}
          />
          <OutputLibrary
            open={libraryOpen}
            jobs={jobs}
            templates={templates}
            onClose={() => setLibraryOpen(false)}
            onDelete={deleteLibraryOutput}
          />

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-2 xl:grid-cols-4 xl:grid-rows-1 xl:overflow-hidden">
            <div data-testid="reference-column" className="grid min-h-0 min-w-0 grid-cols-1 gap-4 xl:grid-rows-2">
              <WorkflowPanel
                step="①"
                title="口播真人视频"
                description="不用自己说话。AI 会按字幕配音，并对上这段真人的口型"
                panelRef={contentRef}
                highlighted={highlighted === "1"}
              >
                <ReferenceSection
                  materials={materials}
                  referenceId={referenceId}
                  onReferenceIdChange={setReferenceId}
                  onMaterialsChange={refreshMaterials}
                />
              </WorkflowPanel>
              <WorkflowPanel
                title="视频素材"
                description="可选。某句要换画面时，拖到④对应字幕右侧，或点格子选用"
              >
                <CutawaySection
                  materials={materials}
                  referenceId={referenceId}
                  onMaterialsChange={refreshMaterials}
                />
              </WorkflowPanel>
            </div>
            <div data-testid="voice-column" className="grid min-h-0 min-w-0 grid-cols-1 gap-4 xl:grid-rows-2">
              <WorkflowPanel
                step="②"
                title="配音"
                description="设置本任务的配音方式"
                panelRef={voiceRef}
                highlighted={highlighted === "2"}
              >
                <VoiceSection
                  config={config}
                  onChange={(next) => setConfig(saveConfig(next))}
                  onOpenConfig={openConfig}
                />
              </WorkflowPanel>
              <WorkflowPanel
                step="③"
                title="BGM"
                description="选择、试听或清除本任务的背景音乐"
                panelRef={bgmRef}
                highlighted={highlighted === "3"}
              >
                <BgmSection
                  materials={materials}
                  bgmId={bgmId}
                  onBgmIdChange={setBgmId}
                  onMaterialsChange={refreshMaterials}
                />
              </WorkflowPanel>
            </div>
            <WorkflowPanel
              step="④"
              title="文案"
              description="直接改这一条。某句要切画面，点右侧格子选素材"
              panelRef={copyRef}
              highlighted={highlighted === "4"}
              className="min-h-[280px] xl:min-h-0"
            >
              <ScriptSection
                key={formEpoch}
                config={config}
                scripts={scripts}
                materials={materials.filter((item) => item.kind !== "audio" && item.id !== referenceId)}
                reference={materials.find((item) => item.id === referenceId && item.kind === "video") ?? null}
                onScriptsChange={setScripts}
                onConfigChange={(next) => setConfig(saveConfig(next))}
                onOpenConfig={openConfig}
              />
            </WorkflowPanel>
            <section
              ref={templateRef}
              aria-label="模板工作台"
              className={`flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-border border-l-4 border-l-primary bg-card shadow-[var(--shadow-card)] xl:min-h-0 ${highlighted === "5" ? "border-l-primary bg-primary/10 shadow-lg" : ""}`}
            >
              <div className="shrink-0 border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">
                  <span className="mr-1.5 text-muted-foreground">⑤</span>
                  模板工作台
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">选一套皮肤预览字效，成片在预览下方</p>
                <div className="mt-2">
                  <VisibilityControls
                    showTitle={showTitle}
                    showSubtitle={showSubtitle}
                    onShowTitleChange={setShowTitle}
                    onShowSubtitleChange={setShowSubtitle}
                  />
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                <aside className="shrink-0 border-b border-border px-3 py-3">
                  <TemplateStrip
                    templates={templates}
                    templateIds={templateIds}
                    activeId={activeTemplateId}
                    onTemplateIdsChange={setTemplateIds}
                    onActiveIdChange={setActiveTemplateId}
                  />
                </aside>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4">
                  <TemplatePreview
                    template={activeTemplate}
                    script={completeScripts(scripts, { requireTitle: showTitle })[0] ?? scripts[0] ?? null}
                    job={job}
                    templates={templates}
                    regenerating={regenerating}
                    onRegenerate={() => void regenerate()}
                    showTitle={showTitle}
                    showSubtitle={showSubtitle}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
