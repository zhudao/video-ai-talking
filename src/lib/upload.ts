import { ApiError } from "./api-error";

export const MAX_MATERIAL_BYTES = 80 * 1024 * 1024;

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
  phase: "copying" | "saving";
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUploadProgress(progress: UploadProgress, fileCount: number): string {
  if (progress.phase === "saving") return "正在写入素材库…";
  const countLabel = fileCount === 1 ? "1 个文件" : `${fileCount} 个文件`;
  return `正在复制 ${countLabel} · ${formatBytes(progress.loaded)} / ${formatBytes(progress.total)} · ${progress.percent}%`;
}

export function postFormWithProgress<T>(
  url: string,
  body: FormData,
  onProgress?: (progress: UploadProgress) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress?.({
        loaded: event.loaded,
        total: event.total,
        percent,
        phase: event.loaded >= event.total ? "saving" : "copying",
      });
    };
    xhr.onload = () => {
      const data = (xhr.response ?? {}) as { error?: string; message?: string } & T;
      if (xhr.status >= 400) {
        reject(new ApiError(data.error || "request_failed", data.message || "请求失败"));
        return;
      }
      resolve(data);
    };
    xhr.onerror = () => reject(new ApiError("request_failed", "请求失败"));
    xhr.send(body);
  });
}
