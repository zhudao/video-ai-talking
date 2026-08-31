import { writeFile } from "node:fs/promises";
import type { AppDeps } from "./app.ts";
import type { RunnerDeps } from "./jobs/runner.ts";

export function isMockMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VAT_MOCK === "1";
}

export function mockRunnerOverrides(): Pick<
  RunnerDeps,
  "detect" | "synthesize" | "uploadFile" | "lipsync" | "probe" | "render"
> {
  return {
    detect: async () => undefined,
    synthesize: async (input) => {
      await writeFile(input.outPath, "mock-voice");
      return { durationMs: 1200, cues: [{ text: input.text, startMs: 0, endMs: 1200 }] };
    },
    uploadFile: async () => "oss://mock/file",
    lipsync: async (input) => {
      await writeFile(input.outPath, "mock-lipsync");
      return { durationHint: 1200 };
    },
    probe: async () => 1200,
    render: async (args) => {
      const out = args.at(-1);
      if (out) await writeFile(out, "mock-mp4");
    },
  };
}

export function mockAppOverrides(): Pick<AppDeps, "testSpeech" | "testDashscope" | "testVideoretalk" | "testAi" | "generate"> {
  return {
    testSpeech: async (input) => {
      await writeFile(input.outPath, "mock-tts");
      return { durationMs: 500, cues: [] };
    },
    testDashscope: async (input) => {
      await writeFile(input.outPath, "mock-tts");
      return { durationMs: 500, cues: [] };
    },
    testVideoretalk: async () => undefined,
    testAi: async () => undefined,
    generate: async () => ({
      scripts: [{ title: "周末到店", body: "先看环境。再看课程。" }],
    }),
  };
}
