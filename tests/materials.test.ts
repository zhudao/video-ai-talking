import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertMaterialFileSize, createApp } from "../server/app.ts";
import { createRunner } from "../server/jobs/runner.ts";
import { createStore } from "../server/store.ts";

async function setup(opts?: { pickFiles?: () => Promise<string[] | null> }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "qm-mat-"));
  const store = createStore(root);
  const runner = createRunner({
    store,
    projectRoot: process.cwd(),
    detect: async () => undefined,
    synthesize: async () => ({ durationMs: 500, cues: [] }),
    render: async () => undefined,
  });
  const app = createApp({
    store,
    runner,
    projectRoot: process.cwd(),
    testSpeech: async () => ({ durationMs: 500, cues: [] }),
    testAi: async () => undefined,
    pickFiles: opts?.pickFiles,
  });
  return { store, app, root };
}

describe("materials api", () => {
  it("does not expose folder import endpoints", async () => {
    const { app } = await setup();
    const folder = await app.request("/api/materials/folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/tmp/clips" }),
    });
    const browse = await app.request("/api/materials/folder/browse", { method: "POST" });
    expect(folder.status).toBe(404);
    expect(browse.status).toBe(404);
  });

  it("links files from the native picker without copying", async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), "qm-link-"));
    const photo = path.join(folder, "shot.jpg");
    await writeFile(photo, "pic");
    const { app, store } = await setup({ pickFiles: async () => [photo] });
    const res = await app.request("/api/materials/link/browse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kinds: ["image", "video"] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { added: number; materials: Array<{ source: string; url: string }> };
    expect(body.added).toBe(1);
    expect(body.materials[0]?.source).toBe("linked");
    const file = await app.request(body.materials[0]!.url);
    expect(file.status).toBe(200);
    expect(await file.text()).toBe("pic");
    const listed = await store.readMaterials();
    expect(listed[0]?.sourcePath).toBeDefined();
  });

  it("returns cancelled when the file dialog is dismissed", async () => {
    const { app } = await setup({ pickFiles: async () => null });
    const res = await app.request("/api/materials/link/browse", { method: "POST" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ cancelled: true, added: 0 });
  });

  it("accepts multiple files in one upload", async () => {
    const { app } = await setup();
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1])], "one.jpg", { type: "image/jpeg" }));
    form.append("file", new File([new Uint8Array([2])], "two.jpg", { type: "image/jpeg" }));
    const res = await app.request("/api/materials", { method: "POST", body: form });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { materials: unknown[] };
    expect(body.materials).toHaveLength(2);
    const listed = await app.request("/api/materials");
    expect(((await listed.json()) as { materials: unknown[] }).materials).toHaveLength(2);
  });

  it("rejects an oversized file before reading its bytes", () => {
    expect(() => assertMaterialFileSize(81 * 1024 * 1024)).toThrow("单个文件不能超过 80MB");
    expect(() => assertMaterialFileSize(80 * 1024 * 1024)).not.toThrow();
  });

  it("keeps every uploaded file instead of replacing the previous one", async () => {
    const { app } = await setup();
    for (const [bytes, name] of [
      ["one", "one.jpg"],
      ["two", "two.jpg"],
    ] as const) {
      const form = new FormData();
      form.append("file", new File([bytes], name, { type: "image/jpeg" }));
      const res = await app.request("/api/materials", { method: "POST", body: form });
      expect(res.status).toBe(200);
    }

    const listed = await app.request("/api/materials");
    const all = (await listed.json()) as { materials: Array<{ filename: string }> };
    expect(all.materials).toHaveLength(2);
  });

  it("clears all visual materials in one request", async () => {
    const { app } = await setup();
    const form = new FormData();
    form.append("file", new File(["one"], "one.jpg", { type: "image/jpeg" }));
    await app.request("/api/materials", { method: "POST", body: form });
    const cleared = await app.request("/api/materials", { method: "DELETE" });
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({ ok: true, removed: 1 });
    const listed = await app.request("/api/materials");
    expect(((await listed.json()) as { materials: unknown[] }).materials).toEqual([]);
  });
});
