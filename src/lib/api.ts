import { ApiError } from "./api-error";
import { MAX_MATERIAL_BYTES, postFormWithProgress, type UploadProgress } from "./upload";

export { ApiError };
export type { UploadProgress };

export type Material = {
  id: string;
  filename: string;
  mime: string;
  kind: "image" | "video" | "audio";
  ext: string;
  createdAt: string;
  url: string;
  source?: "upload" | "linked";
  sourcePath?: string;
};

type LinkKinds = Array<"image" | "video" | "audio">;

type LinkResult = {
  cancelled?: boolean;
  added: number;
  skipped: number;
  truncated: boolean;
  materials: Material[];
};

export type TemplateLook = {
  fontSize: number;
  color: string;
  borderColor: string;
  borderW: number;
  yExpr: string;
  boxColor?: string;
  boxBorderW?: number;
};

export type Template = {
  id: string;
  name: string;
  description: string;
  mediaFit: "cover" | "contain";
  title?: TemplateLook;
  subtitle?: TemplateLook;
};

export type JobVideo = {
  id: string;
  script: { title: string; body: string; captions?: { id: string; text: string }[] };
  templateId: string;
  materialIds: string[];
  status: "pending" | "voice" | "lipsync" | "video" | "done" | "failed";
  error?: string;
};

export type Job = {
  id: string;
  stage: "voice" | "lipsync" | "video" | "done" | "failed";
  percent: number;
  error?: string;
  errorCode?: string;
  videos: JobVideo[];
  materialIds: string[];
  templateIds: string[];
  bgmMaterialId: string | null;
  showTitle?: boolean;
  showSubtitle?: boolean;
  voice?: { provider?: "volcengine" | "dashscope"; voiceType?: string };
  createdAt: string;
  updatedAt: string;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  } & T;
  if (!response.ok) {
    throw new ApiError(data.error || "request_failed", data.message || "请求失败");
  }
  return data;
}

export const api = {
  health: () => request<{ ok: boolean }>("/api/health"),
  testAi: (apiKey: string) =>
    request<{ ok: boolean }>("/api/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    }),
  testVideoretalk: (apiKey: string) =>
    request<{ ok: boolean }>("/api/videoretalk/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    }),
  testTts: (tts: {
    provider?: "volcengine" | "dashscope";
    appId?: string;
    accessToken?: string;
    voiceType: string;
    apiKey?: string;
  }) =>
    request<{ ok: boolean }>("/api/tts/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tts),
    }),
  previewTts: async (tts: {
    provider?: "volcengine" | "dashscope";
    appId?: string;
    accessToken?: string;
    voiceType: string;
    apiKey?: string;
  }) => {
    const response = await fetch("/api/tts/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tts),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      throw new ApiError(data.error || "request_failed", data.message || "试听失败");
    }
    return response.blob();
  },
  templates: () => request<{ templates: Template[] }>("/api/templates"),
  materials: () => request<{ materials: Material[] }>("/api/materials"),
  uploadMaterials: async (files: File[], onProgress?: (progress: UploadProgress) => void) => {
    if (files.length === 0) throw new ApiError("invalid_material", "请选择要上传的文件");
    for (const file of files) {
      if (file.size > MAX_MATERIAL_BYTES) {
        throw new ApiError("invalid_material", "单个文件不能超过 80MB");
      }
    }
    const body = new FormData();
    for (const file of files) body.append("file", file);
    if (onProgress && files.length > 0) {
      onProgress({ loaded: 0, total: files.reduce((sum, file) => sum + file.size, 0), percent: 0, phase: "copying" });
    }
    const result = await postFormWithProgress<{ material?: Material; materials: Material[] }>(
      "/api/materials",
      body,
      onProgress,
    );
    return { materials: result.materials, material: result.material ?? result.materials[0]! };
  },
  uploadMaterial: async (file: File, onProgress?: (progress: UploadProgress) => void) => {
    const result = await api.uploadMaterials([file], onProgress);
    return { material: result.material };
  },
  browseFiles: (opts?: { kinds?: LinkKinds }) =>
    request<LinkResult>("/api/materials/link/browse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kinds: opts?.kinds }),
    }),
  linkFiles: (paths: string[], opts?: { kinds?: LinkKinds }) =>
    request<LinkResult>("/api/materials/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths, kinds: opts?.kinds }),
    }),
  deleteMaterial: (id: string) => request<{ ok: boolean }>(`/api/materials/${id}`, { method: "DELETE" }),
  clearVisualMaterials: () => request<{ ok: boolean; removed: number }>("/api/materials", { method: "DELETE" }),
  generateScripts: (input: { apiKey: string; topic: string; count: number; durationSec: number }) =>
    request<{ scripts: { title: string; body: string }[] }>("/api/scripts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  jobs: () => request<{ jobs: Job[] }>("/api/jobs"),
  job: (id: string) => request<{ job: Job }>(`/api/jobs/${id}`),
  createJob: (input: {
    tts: {
      provider?: "volcengine" | "dashscope";
      appId?: string;
      accessToken?: string;
      voiceType: string;
      apiKey?: string;
    };
    videoretalkApiKey: string;
    referenceVideoId: string;
    scripts: { title: string; body: string; captions?: { id: string; text: string; cutaway?: boolean; materialId?: string }[] }[];
    templateIds: string[];
    bgmMaterialId: string | null;
    showTitle?: boolean;
    showSubtitle?: boolean;
  }) =>
    request<{ job: Job }>("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  regenerateJob: (
    id: string,
    input: {
      tts: {
        provider?: "volcengine" | "dashscope";
        appId?: string;
        accessToken?: string;
        voiceType: string;
        apiKey?: string;
      };
      videoretalkApiKey: string;
    },
  ) =>
    request<{ job: Job }>(`/api/jobs/${id}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  fileUrl: (jobId: string, videoId: string) => `/api/jobs/${jobId}/file/${videoId}`,
  deleteOutput: (jobId: string, videoId: string) =>
    request<{ ok: boolean }>(`/api/jobs/${jobId}/file/${videoId}`, { method: "DELETE" }),
};
