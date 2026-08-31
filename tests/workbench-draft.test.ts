import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE_ID } from "../src/lib/templates";
import {
  EMPTY_WORKBENCH,
  WORKBENCH_STORAGE_KEY,
  loadWorkbench,
  saveWorkbench,
} from "../src/lib/workbench-draft";

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("workbench draft", () => {
  it("remembers the talking-head reference across reloads", () => {
    const storage = memory();
    saveWorkbench(
      {
        referenceId: "ref-1",
        scripts: [{ title: "标题", body: "正文", captions: [{ id: "c1", text: "正文" }] }],
        templateIds: ["red-bold"],
        bgmId: null,
        showTitle: true,
        showSubtitle: true,
      },
      storage,
    );
    expect(JSON.parse(storage.getItem(WORKBENCH_STORAGE_KEY) ?? "{}").referenceId).toBe("ref-1");
    expect(loadWorkbench(storage).referenceId).toBe("ref-1");
    expect(loadWorkbench(storage).scripts[0]?.title).toBe("标题");
  });

  it("defaults the workbench to the 纯白 template", () => {
    expect(DEFAULT_TEMPLATE_ID).toBe("pure-white");
    expect(EMPTY_WORKBENCH.templateIds).toEqual(["pure-white"]);
    expect(loadWorkbench(memory()).templateIds).toEqual(["pure-white"]);
    const storage = memory();
    storage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify({ scripts: [] }));
    expect(loadWorkbench(storage).templateIds).toEqual(["pure-white"]);
  });

  it("drops a missing or illegal reference id", () => {
    expect(loadWorkbench(memory()).referenceId).toBeNull();
    expect(loadWorkbench({ getItem: () => "{not-json" }).referenceId).toBeNull();
    const storage = memory();
    storage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify({ referenceId: 12 }));
    expect(loadWorkbench(storage).referenceId).toBeNull();
  });
});
