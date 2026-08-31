import { describe, expect, it } from "vitest";
import { fileUrlToPath, pathsFromDataTransfer, pathsFromUriList } from "../src/lib/local-paths";

describe("local paths", () => {
  it("converts file URLs to absolute paths", () => {
    expect(fileUrlToPath("file:///Users/me/clip.mp4")).toBe("/Users/me/clip.mp4");
    expect(fileUrlToPath("file:///C:/Users/me/clip.mp4")).toBe("C:\\Users\\me\\clip.mp4");
    expect(fileUrlToPath("# comment")).toBeNull();
  });

  it("reads paths from a drag uri-list", () => {
    expect(pathsFromUriList("file:///Users/me/a.jpg\nfile:///Users/me/b.mp4")).toEqual([
      "/Users/me/a.jpg",
      "/Users/me/b.mp4",
    ]);
  });

  it("prefers File.path when every dropped file has one", () => {
    const withPath = Object.assign(new File(["a"], "a.jpg"), { path: "/Users/me/a.jpg" });
    const data = {
      files: [withPath] as unknown as FileList,
      getData: () => "",
    } as unknown as DataTransfer;
    Object.defineProperty(data.files, "length", { value: 1 });
    expect(pathsFromDataTransfer(data)).toEqual(["/Users/me/a.jpg"]);
  });
});
