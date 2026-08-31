export const SCRIPT_DURATION_MIN = 10;
export const SCRIPT_DURATION_MAX = 60;
export const SCRIPT_DURATION_DEFAULT = 30;
export const SCRIPT_DURATION_PRESETS = [15, 30, 45, 60] as const;
export const MS_PER_SPOKEN_CHAR = 220;

export function clampScriptDuration(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return SCRIPT_DURATION_DEFAULT;
  return Math.min(SCRIPT_DURATION_MAX, Math.max(SCRIPT_DURATION_MIN, Math.round(n)));
}

export function isPresetDuration(sec: number): boolean {
  return (SCRIPT_DURATION_PRESETS as readonly number[]).includes(sec);
}

export function spokenCharsForDuration(sec: number): { target: number; min: number; max: number } {
  const target = Math.round((clampScriptDuration(sec) * 1000) / MS_PER_SPOKEN_CHAR);
  return {
    target,
    min: Math.round(target * 0.8),
    max: Math.round(target * 1.2),
  };
}
