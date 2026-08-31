import { describe, expect, it } from "vitest";
import {
  SCRIPT_DURATION_DEFAULT,
  SCRIPT_DURATION_PRESETS,
  clampScriptDuration,
  spokenCharsForDuration,
} from "../src/lib/script-duration";

describe("script duration", () => {
  it("clamps to a usable talking length", () => {
    expect(clampScriptDuration(undefined)).toBe(SCRIPT_DURATION_DEFAULT);
    expect(clampScriptDuration(0)).toBe(10);
    expect(clampScriptDuration(8)).toBe(10);
    expect(clampScriptDuration(20)).toBe(20);
    expect(clampScriptDuration(30)).toBe(30);
    expect(clampScriptDuration(90)).toBe(60);
    expect(SCRIPT_DURATION_PRESETS).toEqual([15, 30, 45, 60]);
  });

  it("maps seconds to a spoken character range at 220ms per character", () => {
    expect(spokenCharsForDuration(15)).toEqual({ target: 68, min: 54, max: 82 });
    expect(spokenCharsForDuration(30)).toEqual({ target: 136, min: 109, max: 163 });
    expect(spokenCharsForDuration(60)).toEqual({ target: 273, min: 218, max: 328 });
  });
});
