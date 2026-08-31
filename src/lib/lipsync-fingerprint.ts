export type LipsyncFingerprintInput = {
  referenceId: string;
  referenceStamp: string;
  spokenBody: string;
  ttsProvider: string;
  voiceType: string;
};

export function spokenBodyFromScript(script: { body?: string; captions?: { text: string }[] }): string {
  const fromCaptions = (script.captions ?? []).map((item) => item.text.trim()).filter(Boolean);
  if (fromCaptions.length > 0) return fromCaptions.join("");
  return (script.body ?? "").trim();
}

export function lipsyncFingerprint(input: LipsyncFingerprintInput): string {
  return [
    input.referenceId.trim(),
    input.referenceStamp.trim(),
    spokenBodyFromScript({ body: input.spokenBody }),
    input.ttsProvider.trim(),
    input.voiceType.trim(),
  ].join("\n");
}

export function canReuseLipsync(input: {
  previous: string | undefined;
  next: string;
  lipsyncExists: boolean;
}): boolean {
  return Boolean(input.previous && input.previous === input.next && input.lipsyncExists);
}
