import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("cold ink theme", () => {
  it("uses a blue-cyan hue and does not keep the mashup amber tokens", () => {
    const css = readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/oklch\(0\.42 0\.1 240\)/);
    expect(css).not.toMatch(/amber/i);
    expect(css).not.toMatch(/oklch\([^)]*70\)/);
  });
});
