import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/api";
import { formatUploadProgress, postFormWithProgress } from "../src/lib/upload";

describe("formatUploadProgress", () => {
  it("shows copy percent while bytes are still transferring", () => {
    expect(
      formatUploadProgress({ loaded: 25 * 1024 * 1024, total: 50 * 1024 * 1024, percent: 50, phase: "copying" }, 3),
    ).toBe("正在复制 3 个文件 · 25.0 MB / 50.0 MB · 50%");
  });

  it("says saving after the browser finished sending", () => {
    expect(
      formatUploadProgress({ loaded: 10, total: 10, percent: 100, phase: "saving" }, 1),
    ).toBe("正在写入素材库…");
  });
});

describe("postFormWithProgress", () => {
  it("reports upload percent from XHR and parses JSON", async () => {
    const seen: number[] = [];
    const xhr = {
      upload: {} as XMLHttpRequest["upload"],
      status: 200,
      response: { materials: [{ id: "m1" }] },
      open: vi.fn(),
      send: vi.fn(function (this: typeof xhr) {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 40, total: 80 } as ProgressEvent<EventTarget>);
        this.onload?.({} as ProgressEvent<EventTarget>);
      }),
    };
    vi.stubGlobal(
      "XMLHttpRequest",
      class {
        constructor() {
          return xhr;
        }
      } as unknown as typeof XMLHttpRequest,
    );

    const result = await postFormWithProgress<{ materials: Array<{ id: string }> }>(
      "/api/materials",
      new FormData(),
      (progress) => seen.push(progress.percent),
    );

    expect(xhr.open).toHaveBeenCalledWith("POST", "/api/materials");
    expect(seen).toEqual([50]);
    expect(result.materials[0]?.id).toBe("m1");
    vi.unstubAllGlobals();
  });

  it("turns a failed response into ApiError", async () => {
    const xhr = {
      upload: {} as XMLHttpRequest["upload"],
      status: 400,
      response: { error: "invalid_material", message: "单个文件不能超过 80MB" },
      open: vi.fn(),
      send: vi.fn(function (this: typeof xhr) {
        this.onload?.({} as ProgressEvent<EventTarget>);
      }),
    };
    vi.stubGlobal(
      "XMLHttpRequest",
      class {
        constructor() {
          return xhr;
        }
      } as unknown as typeof XMLHttpRequest,
    );

    await expect(postFormWithProgress("/api/materials", new FormData())).rejects.toMatchObject({
      name: ApiError.name,
      message: "单个文件不能超过 80MB",
    } as Partial<ApiError>);
    vi.unstubAllGlobals();
  });
});
