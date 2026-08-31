import { describe, expect, it } from "vitest";
import { redactRecord } from "../server/log.ts";

describe("log redact", () => {
  it("masks apiKey accessToken and authorization", () => {
    expect(
      redactRecord({
        apiKey: "sk-123456",
        dashscopeApiKey: "sk-bai-999",
        videoretalkApiKey: "sk-lip-999",
        accessToken: "tok-999",
        authorization: "Bearer;secret",
        jobId: "j1",
      }),
    ).toEqual({
      apiKey: "sk***",
      dashscopeApiKey: "sk***",
      videoretalkApiKey: "sk***",
      accessToken: "to***",
      authorization: "Be***",
      jobId: "j1",
    });
  });
});
