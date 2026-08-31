import { describe, expect, it } from "vitest";
import { assertCutawaysReady, captionTimeline } from "../src/lib/broll-timeline.ts";

describe("broll timeline", () => {
  it("keeps face clips unless a caption opts into a material", () => {
    const clips = captionTimeline(
      [
        { id: "1", text: "第一句" },
        { id: "2", text: "第二句更长一些", cutaway: true, materialId: "m1" },
        { id: "3", text: "第三句", cutaway: true },
      ],
      1000,
    );
    expect(clips).toHaveLength(3);
    expect(clips[0]?.source).toBe("face");
    expect(clips[1]).toMatchObject({ source: "broll", materialId: "m1" });
    expect(clips[2]?.source).toBe("face");
    expect(clips[2]?.endMs).toBe(1000);
    expect(assertCutawaysReady([{ id: "2", text: "x", cutaway: true }])).toContain("指定素材");
    expect(assertCutawaysReady([{ id: "2", text: "x", cutaway: true, materialId: "m1" }])).toBeNull();
  });
});
