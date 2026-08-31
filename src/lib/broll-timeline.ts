export type CaptionCut = {
  id: string;
  text: string;
  cutaway?: boolean;
  materialId?: string;
};

export type TimelineClip = {
  startMs: number;
  endMs: number;
  source: "face" | "broll";
  materialId?: string;
  text: string;
};

export function captionTimeline(captions: CaptionCut[], durationMs: number): TimelineClip[] {
  const parts = captions.map((item) => ({
    ...item,
    text: item.text.trim(),
  })).filter((item) => item.text);
  if (parts.length === 0) {
    return [{ startMs: 0, endMs: durationMs, source: "face", text: "" }];
  }
  const weights = parts.map((item) => Math.max([...item.text].length, 1));
  const total = weights.reduce((sum, item) => sum + item, 0);
  let cursor = 0;
  return parts.map((item, index) => {
    const startMs = Math.round(cursor);
    cursor = index === parts.length - 1 ? durationMs : cursor + (durationMs * (weights[index] ?? 1)) / total;
    const useBroll = item.cutaway === true && Boolean(item.materialId);
    return {
      startMs,
      endMs: Math.round(cursor),
      source: useBroll ? "broll" : "face",
      materialId: useBroll ? item.materialId : undefined,
      text: item.text,
    };
  });
}

export function assertCutawaysReady(captions: CaptionCut[]): string | null {
  for (const item of captions) {
    if (item.cutaway && !item.materialId?.trim()) {
      return "先为勾选「切到素材」的字幕指定素材";
    }
  }
  return null;
}
