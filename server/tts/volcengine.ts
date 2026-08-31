import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { AppError, formatToolFailure } from "../errors.ts";

export const VOLC_TTS_URL = "https://openspeech.bytedance.com/api/v1/tts";

export type Cue = {
  text: string;
  startMs: number;
  endMs: number;
};

export type TtsProvider = "volcengine" | "dashscope";

export type TtsCredentials = {
  provider?: TtsProvider;
  appId: string;
  accessToken: string;
  voiceType: string;
  apiKey?: string;
};

type FetchLike = typeof fetch;

function hintForVolcengine(payload: Record<string, unknown>, httpStatus: number): string {
  const message = String(payload.message ?? payload.msg ?? "");
  if (/grant not found|authenticate request/i.test(message)) {
    return "鉴权失败，请检查 App ID 与 Access Token 是否来自同一「语音合成」应用、是否已开通服务。";
  }
  if (/access denied|resource id/i.test(message)) {
    return "当前音色未授权。请在火山控制台开通或购买该音色后再试。";
  }
  return `请求失败（HTTP ${httpStatus}），请根据原始返回排查。`;
}

function asDurationMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 1000 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) {
      return num < 1000 ? Math.round(num * 1000) : Math.round(num);
    }
  }
  return 0;
}

export function buildTtsRequest(input: TtsCredentials & { text: string; reqid?: string }) {
  const reqid = input.reqid ?? randomUUID();
  return {
    url: VOLC_TTS_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer;${input.accessToken}`,
    },
    body: {
      app: {
        appid: input.appId,
        token: input.accessToken,
        cluster: "volcano_tts",
      },
      user: { uid: "video-ai-talking" },
      audio: {
        voice_type: input.voiceType,
        encoding: "mp3",
        speed_ratio: 1.0,
        volume_ratio: 1.0,
        pitch_ratio: 1.0,
      },
      request: {
        reqid,
        text: input.text,
        text_type: "plain",
        operation: "query",
      },
    },
  };
}

export async function synthesizeSpeech(input: TtsCredentials & {
  text: string;
  outPath: string;
  fetchImpl?: FetchLike;
}): Promise<{ durationMs: number; cues: Cue[] }> {
  const text = input.text.trim();
  if (!text) throw new AppError("tts_failed", "口播正文不能为空");
  const prepared = buildTtsRequest({ ...input, text });
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(prepared.url, {
      method: "POST",
      headers: prepared.headers,
      body: JSON.stringify(prepared.body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AppError("tts_failed", "无法连接火山语音合成，请检查网络");
  }

  const bodyText = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {};
  } catch {
    throw new AppError(
      "tts_failed",
      formatToolFailure("火山语音合成", "返回无法解析为 JSON。", `HTTP ${response.status} ${bodyText}`),
    );
  }

  const code = payload.code;
  const ok = response.ok && (code === undefined || code === 0 || code === 3000);
  if (!ok) {
    throw new AppError("tts_failed", formatToolFailure("火山语音合成", hintForVolcengine(payload, response.status), payload));
  }

  const data = payload.data;
  if (typeof data !== "string" || !data) {
    throw new AppError(
      "tts_failed",
      formatToolFailure("火山语音合成", "接口成功但没有返回音频，请根据原始返回排查。", payload),
    );
  }

  const bytes = Buffer.from(data, "base64");
  await writeFile(input.outPath, bytes);

  const addition = (payload.addition ?? {}) as Record<string, unknown>;
  const durationMs = asDurationMs(addition.duration) || Math.max(1000, text.length * 220);
  return {
    durationMs,
    cues: [{ text, startMs: 0, endMs: durationMs }],
  };
}
