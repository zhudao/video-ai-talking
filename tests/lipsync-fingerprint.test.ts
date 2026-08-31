import { describe, expect, it } from "vitest";
import { canReuseLipsync, lipsyncFingerprint } from "../src/lib/lipsync-fingerprint.ts";

describe("lipsync fingerprint", () => {
  it("ignores cutaway choices and changes when the spoken body or voice changes", () => {
    const base = {
      referenceId: "ref-1",
      referenceStamp: "100:1",
      spokenBody: "今天介绍收纳",
      ttsProvider: "dashscope",
      voiceType: "longanyang",
    };
    const a = lipsyncFingerprint(base);
    const b = lipsyncFingerprint(base);
    expect(a).toBe(b);
    expect(lipsyncFingerprint({ ...base, spokenBody: "换一句" })).not.toBe(a);
    expect(lipsyncFingerprint({ ...base, voiceType: "other" })).not.toBe(a);
    expect(canReuseLipsync({ previous: a, next: b, lipsyncExists: true })).toBe(true);
    expect(canReuseLipsync({ previous: a, next: b, lipsyncExists: false })).toBe(false);
  });
});
