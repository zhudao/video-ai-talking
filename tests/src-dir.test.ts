import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSrcDir } from "../src-dir.ts";

describe("resolveSrcDir", () => {
  it("returns a real filesystem path instead of a file URL pathname", () => {
    const dir = resolveSrcDir(import.meta.url);
    expect(path.isAbsolute(dir)).toBe(true);
    expect(dir.endsWith(`${path.sep}src`)).toBe(true);
    expect(dir.startsWith("file:")).toBe(false);
    expect(dir).not.toMatch(/^\/[A-Za-z]:/);
  });
});
