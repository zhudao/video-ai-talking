import { clampScriptDuration, spokenCharsForDuration } from "../../src/lib/script-duration.ts";
import { AppError } from "../errors.ts";

export const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_MODEL = "deepseek-chat";

type FetchLike = typeof fetch;

export function clampScriptCount(_count: unknown): number {
  return 1;
}

export function buildScriptPrompt(topic: string, count: number, durationSec = 30): string {
  const sec = clampScriptDuration(durationSec);
  const chars = spokenCharsForDuration(sec);
  return [
    `请为短视频口播写 ${count} 条文案。主题：${topic}`,
    `目标成片约 ${sec} 秒，每条包含短标题（不超过 16 个字）和口播正文（${chars.min}–${chars.max} 字，口语、可直接念完大约 ${sec} 秒）。`,
    '只返回 JSON：{"scripts":[{"title":"...","body":"..."}]}',
    "不要解释，不要 markdown。",
  ].join("\n");
}

function parseScripts(raw: unknown): { title: string; body: string }[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  const list = Array.isArray(record.scripts) ? record.scripts : Array.isArray(raw) ? raw : [];
  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? "").trim();
      const body = String(row.body ?? row.text ?? "").trim();
      if (!title || !body) return null;
      return { title, body };
    })
    .filter((item): item is { title: string; body: string } => Boolean(item));
}

export async function generateScripts(input: {
  apiKey: string;
  topic: string;
  count: unknown;
  durationSec?: unknown;
  fetchImpl?: FetchLike;
}): Promise<{ scripts: { title: string; body: string }[] }> {
  const apiKey = input.apiKey.trim();
  const topic = input.topic.trim();
  const count = clampScriptCount(input.count);
  const durationSec = clampScriptDuration(input.durationSec);
  if (!apiKey) throw new AppError("ai_failed", "请先填写 DeepSeek API Key");
  if (!topic) throw new AppError("ai_failed", "请先填写文案主题");

  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: "你是短视频口播文案助手，只输出 JSON。" },
          { role: "user", content: buildScriptPrompt(topic, count, durationSec) },
        ],
        temperature: 0.8,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AppError("ai_failed", "无法连接 DeepSeek，请检查网络");
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new AppError("ai_failed", `DeepSeek 返回无法解析（HTTP ${response.status}）`);
  }

  if (!response.ok) {
    const err = payload.error as { message?: string } | undefined;
    throw new AppError("ai_failed", err?.message || `DeepSeek 请求失败 HTTP ${response.status}`);
  }

  const content = (payload.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content;
  if (!content) throw new AppError("ai_failed", "DeepSeek 没有返回文案");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new AppError("ai_failed", "DeepSeek 返回的不是 JSON 文案");
  }

  const scripts = parseScripts(parsed).slice(0, count);
  if (scripts.length === 0) {
    throw new AppError("ai_failed", "没有解析到可用文案，请换个主题再试");
  }
  return { scripts };
}

export async function testDeepSeek(apiKey: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const key = apiKey.trim();
  if (!key) throw new AppError("ai_failed", "请先填写 DeepSeek API Key");
  let response: Response;
  try {
    response = await fetchImpl(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: "user", content: "回复字：ok" }],
        max_tokens: 8,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new AppError("ai_failed", "无法连接 DeepSeek，请检查网络");
  }
  if (!response.ok) {
    throw new AppError("ai_failed", `DeepSeek 连接失败 HTTP ${response.status}`);
  }
}
