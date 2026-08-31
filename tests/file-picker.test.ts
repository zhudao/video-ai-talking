import { describe, expect, it } from "vitest";
import { normalizePickedPath, splitPickedPaths } from "../server/file-picker.ts";

describe("file picker", () => {
  it("trims native dialog paths and treats empty as cancel", () => {
    expect(normalizePickedPath("/Users/me/clip.mp4\n")).toBe("/Users/me/clip.mp4");
    expect(normalizePickedPath("   ")).toBeNull();
    expect(splitPickedPaths("/a.jpg\n/b.mp4\n")).toEqual(["/a.jpg", "/b.mp4"]);
  });
});
