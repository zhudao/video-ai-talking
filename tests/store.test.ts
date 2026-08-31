import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createStore, stripSecrets } from "../server/store.ts";

describe("store", () => {
  it("strips secrets before a job would be written", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qm-store-"));
    const store = createStore(root);
    const dirty = {
      id: "job-1",
      stage: "voice" as const,
      percent: 0,
      videos: [],
      materialIds: [],
      templateIds: ["red-bold"],
      bgmMaterialId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      apiKey: "sk-secret",
      videoretalkApiKey: "sk-lip-secret",
      tts: { accessToken: "tok", appId: "a" },
    };
    const saved = await store.saveJob(dirty);
    expect(saved).not.toHaveProperty("apiKey");
    expect(saved).not.toHaveProperty("videoretalkApiKey");
    expect(saved).not.toHaveProperty("tts");
    const disk = JSON.parse(await readFile(path.join(root, "jobs/job-1.json"), "utf8")) as Record<string, unknown>;
    expect(disk).not.toHaveProperty("apiKey");
    expect(disk).not.toHaveProperty("videoretalkApiKey");
    expect(disk).not.toHaveProperty("tts");
    expect(JSON.stringify(disk)).not.toContain("sk-secret");
    expect(JSON.stringify(disk)).not.toContain("sk-lip-secret");
  });

  it("marks interrupted in-flight jobs as failed", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qm-store-"));
    const store = createStore(root);
    await store.saveJob({
      id: "job-2",
      stage: "voice",
      percent: 10,
      videos: [
        {
          id: "v1",
          script: { title: "t", body: "b" },
          templateId: "red-bold",
          materialIds: ["m1"],
          status: "voice",
        },
      ],
      materialIds: ["m1"],
      templateIds: ["red-bold"],
      bgmMaterialId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await store.failInterruptedJobs();
    const job = await store.readJob("job-2");
    expect(job.stage).toBe("failed");
    expect(job.errorCode).toBe("interrupted");
    expect(job.videos[0]?.status).toBe("failed");

    await store.saveJob({
      id: "job-lipsync",
      stage: "lipsync",
      percent: 50,
      videos: [
        {
          id: "v2",
          script: { title: "t", body: "b" },
          templateId: "red-bold",
          materialIds: [],
          status: "lipsync",
        },
      ],
      materialIds: [],
      templateIds: ["red-bold"],
      bgmMaterialId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await store.failInterruptedJobs();
    expect((await store.readJob("job-lipsync")).stage).toBe("failed");
  });

  it("redacts nested secret fields", () => {
    const clean = stripSecrets({
      accessToken: "abc",
      nested: { apiKey: "sk", keep: "yes" },
    });
    expect(clean).toEqual({ nested: { keep: "yes" } });
  });

  it("copies uploaded files and deletes the stored copy", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qm-store-"));
    const store = createStore(root);
    const added = await store.addMaterial({
      filename: "cover.jpg",
      mime: "image/jpeg",
      bytes: new TextEncoder().encode("jpeg-bytes"),
    });
    expect(await readFile(store.materialPath(added), "utf8")).toBe("jpeg-bytes");
    await store.deleteMaterial(added.id);
    expect(await store.readMaterials()).toEqual([]);
  });

  it("links local files without copying and keeps originals on delete", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qm-store-"));
    const photo = path.join(root, "cover.jpg");
    await writeFile(photo, "jpeg-bytes");
    const store = createStore(path.join(root, "data"));
    const result = await store.importFiles([photo]);
    expect(result.added).toHaveLength(1);
    expect(result.added[0]?.source).toBe("linked");
    await expect(access(path.join(store.materialsDir, `${result.added[0]!.id}.jpg`))).rejects.toThrow();
    expect(await readFile(store.materialPath(result.added[0]!), "utf8")).toBe("jpeg-bytes");
    await store.deleteMaterial(result.added[0]!.id);
    expect(await readFile(photo, "utf8")).toBe("jpeg-bytes");
  });

  it("clears uploaded visuals but keeps audio", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qm-store-"));
    const store = createStore(root);
    await store.addMaterial({ filename: "up.jpg", mime: "image/jpeg", bytes: new Uint8Array([1, 2, 3]) });
    await store.addMaterial({ filename: "bgm.mp3", mime: "audio/mpeg", bytes: new Uint8Array([4, 5, 6]) });

    const result = await store.clearVisualMaterials();
    expect(result.removed).toBe(1);
    const left = await store.readMaterials();
    expect(left).toHaveLength(1);
    expect(left[0]?.kind).toBe("audio");
  });

  it("deletes a finished output file and the job when no videos remain", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qm-store-"));
    const store = createStore(root);
    await store.saveJob({
      id: "job-out",
      stage: "done",
      percent: 100,
      videos: [
        {
          id: "v1",
          script: { title: "成片", body: "正文" },
          templateId: "red-bold",
          materialIds: [],
          status: "done",
        },
      ],
      materialIds: [],
      templateIds: ["red-bold"],
      bgmMaterialId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await store.ensureJobTmp("job-out");
    await writeFile(store.outputPath("job-out", "v1"), "mp4");
    await store.deleteOutput("job-out", "v1");
    await expect(access(store.outputPath("job-out", "v1"))).rejects.toThrow();
    await expect(store.readJob("job-out")).rejects.toMatchObject({ code: "not_found" });
  });
});
