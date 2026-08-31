import { writeFile } from "node:fs/promises";
import { AppError, formatToolFailure } from "../errors.ts";

export const DASHSCOPE_TTS_URL = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer";
export const DASHSCOPE_TTS_MODEL = "cosyvoice-v3-flash";

type FetchLike = typeof fetch;

export function buildDashscopeRequest(input: { apiKey: string; voiceType: string; text: string }) {
  return {
    url: DASHSCOPE_TTS_URL,
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      model: DASHSCOPE_TTS_MODEL,
      input: {
        text: input.text,
        voice: input.voiceType,
        format: "mp3",
        sample_rate: 22050,
      },
    },
  };
}

function hintForDashscope(payload: Record<string, unknown>, httpStatus: number): string {
  const code = String(payload.code ?? "");
  const message = String(payload.message ?? payload.msg ?? "");
  if (httpStatus === 401 || /InvalidApiKey|Unauthorized|API.?Key/i.test(`${code} ${message}`)) {
    return "鉴权失败，请检查 API Key 是否填写正确、是否仍有效。";
  }
  return `请求失败（HTTP ${httpStatus}），请根据原始返回排查。`;
}

function audioFromPayload(payload: Record<string, unknown>): { data?: string; url?: string } {
  const output = (payload.output ?? {}) as Record<string, unknown>;
  const audio = output.audio;
  if (typeof audio === "string" && audio.trim()) {
    if (audio.startsWith("http://") || audio.startsWith("https://")) return { url: audio };
    return { data: audio };
  }
  if (audio && typeof audio === "object") {
    const record = audio as Record<string, unknown>;
    return {
      data: typeof record.data === "string" ? record.data : undefined,
      url: typeof record.url === "string" ? record.url : undefined,
    };
  }
  return {};
}

export async function synthesizeDashscope(input: {
  apiKey: string;
  voiceType: string;
  text: string;
  outPath: string;
  fetchImpl?: FetchLike;
}): Promise<{ durationMs: number; cues: { text: string; startMs: number; endMs: number }[] }> {
  const text = input.text.trim();
  if (!text) throw new AppError("tts_failed", "口播正文不能为空");
  if (!input.apiKey.trim()) throw new AppError("invalid_tts", "请填写阿里百炼 API Key");
  if (!input.voiceType.trim()) throw new AppError("invalid_tts", "请选择阿里百炼音色");

  const prepared = buildDashscopeRequest({ ...input, text });
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
    throw new AppError("tts_failed", "无法连接阿里百炼语音合成，请检查网络");
  }

  const bodyText = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {};
  } catch {
    throw new AppError(
      "tts_failed",
      formatToolFailure("阿里百炼语音合成", "返回无法解析为 JSON。", `HTTP ${response.status} ${bodyText}`),
    );
  }

  if (!response.ok) {
    throw new AppError(
      "tts_failed",
      formatToolFailure("阿里百炼语音合成", hintForDashscope(payload, response.status), payload),
    );
  }

  const audio = audioFromPayload(payload);
  let bytes: Buffer | null = null;
  if (audio.data) {
    bytes = Buffer.from(audio.data, "base64");
  } else if (audio.url) {
    try {
      const downloaded = await fetchImpl(audio.url, { signal: AbortSignal.timeout(60_000) });
      if (!downloaded.ok) throw new Error("download");
      bytes = Buffer.from(await downloaded.arrayBuffer());
    } catch {
      throw new AppError("tts_failed", "百炼返回的音频地址无法下载");
    }
  }
  if (!bytes || bytes.byteLength === 0) {
    throw new AppError("tts_failed", "百炼语音合成没有返回音频");
  }

  await writeFile(input.outPath, bytes);
  const durationMs = Math.max(1000, text.length * 220);
  return {
    durationMs,
    cues: [{ text, startMs: 0, endMs: durationMs }],
  };
}
