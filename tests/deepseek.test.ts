import { describe, expect, it } from "vitest";
import { clampScriptCount, DEEPSEEK_MODEL, DEEPSEEK_URL, generateScripts } from "../server/ai/deepseek.ts";

describe("deepseek scripts", () => {
  it("always generates one talking script", () => {
    expect(clampScriptCount(0)).toBe(1);
    expect(clampScriptCount(3)).toBe(1);
    expect(clampScriptCount(99)).toBe(1);
  });

  it("posts to official chat completions and parses scripts", async () => {
    const result = await generateScripts({
      apiKey: "sk-test",
      topic: "厨房收纳",
      count: 2,
      fetchImpl: async (url, init) => {
        expect(String(url)).toBe(DEEPSEEK_URL);
        const body = JSON.parse(String(init?.body)) as { model: string; messages: { content: string }[] };
        expect(body.model).toBe(DEEPSEEK_MODEL);
        expect(body.messages.at(-1)?.content).toContain("厨房收纳");
        expect(body.messages.at(-1)?.content).toContain("1 条文案");
        expect(body.messages.at(-1)?.content).toContain("约 30 秒");
        expect(body.messages.at(-1)?.content).toContain("109–163 字");
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    scripts: [
                      { title: "收纳第一招", body: "先把抽屉分区。" },
                      { title: "第二招", body: "垂直叠放更省地方。" },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });
    expect(result.scripts).toHaveLength(1);
    expect(result.scripts[0]?.title).toBe("收纳第一招");
  });

  it("asks for a 15-second spoken script when durationSec is 15", async () => {
    let prompt = "";
    await generateScripts({
      apiKey: "sk-test",
      topic: "厨房收纳",
      count: 1,
      durationSec: 15,
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
        prompt = body.messages.at(-1)?.content ?? "";
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ scripts: [{ title: "一", body: "先分区。" }] }) } }],
          }),
          { status: 200 },
        );
      },
    });
    expect(prompt).toContain("约 15 秒");
    expect(prompt).toContain("54–82 字");
  });
});
