import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTemplates } from "../src/lib/templates";

describe("templates", () => {
  it("loads the bundled skins with large readable type", () => {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), "templates/skins.json"), "utf8"));
    const skins = parseTemplates(raw);
    expect(skins.map((item) => item.name)).toEqual([
      "纯白",
      "高级红",
      "轻奢白",
      "经典蓝",
      "黄色闪亮",
      "简洁黄白",
      "轻透粉",
      "空心白",
    ]);
    expect(skins[0]?.id).toBe("pure-white");
    expect(skins.every((item) => item.title.fontSize >= 70 && item.title.fontSize <= 84)).toBe(true);
    expect(skins.every((item) => item.subtitle.fontSize >= 62 && item.subtitle.fontSize <= 72)).toBe(true);
    expect(skins.find((item) => item.id === "classic-blue")?.title.boxColor).toMatch(/0x2867D6/);
    expect(skins.find((item) => item.id === "clean-yellow-white")?.title.boxColor).toMatch(/0xFFFFFF/);
    expect(skins.find((item) => item.id === "soft-pink")?.title.boxColor).toMatch(/0xF4A8C8/);
    const pureWhite = skins.find((item) => item.id === "pure-white")!;
    expect(pureWhite.title).toMatchObject({ color: "0xFFFFFF", borderW: 0 });
    expect(pureWhite.subtitle).toMatchObject({ color: "0xFFFFFF", borderW: 0 });
    const hollow = skins.find((item) => item.id === "hollow-white")!;
    expect(hollow.title.color).toBe("0xFFFFFF@0");
    expect(hollow.title.borderColor).toBe("0xFFFFFF");
    expect(hollow.title.borderW).toBeGreaterThanOrEqual(5);
    expect(hollow.subtitle.color).toBe("0xFFFFFF@0");
    expect(hollow.subtitle.borderColor).toBe("0xFFFFFF");
  });
});
