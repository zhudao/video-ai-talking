const SECRET_KEYS = new Set([
  "apikey",
  "accessToken",
  "accesstoken",
  "authorization",
  "token",
  "ttsAccessToken",
  "dashscopeapikey",
  "dashscopeApiKey",
  "videoretalkApiKey",
  "videoretalkapikey",
]);

export function redactValue(key: string, value: unknown): unknown {
  if (!SECRET_KEYS.has(key) && !SECRET_KEYS.has(key.toLowerCase())) {
    return value;
  }
  if (typeof value !== "string" || !value) return "***";
  return `${value.slice(0, 2)}***`;
}

export function redactRecord(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((item) => redactRecord(item));
  if (!input || typeof input !== "object") return input;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    out[key] = SECRET_KEYS.has(key) || SECRET_KEYS.has(key.toLowerCase())
      ? redactValue(key, value)
      : redactRecord(value);
  }
  return out;
}

export function logInfo(message: string, extra?: unknown): void {
  if (extra === undefined) {
    console.info(`[vat] ${message}`);
    return;
  }
  console.info(`[vat] ${message}`, redactRecord(extra));
}
