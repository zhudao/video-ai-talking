import type { TtsProvider } from "./config";

export type VoiceGender = "female" | "male" | "child";

export type BuiltinVoice = {
  id: string;
  name: string;
  gender: VoiceGender;
  use: string;
};

export const CUSTOM_VOICE_VALUE = "__custom__";
export const VOICE_PREVIEW_TEXT = "你好，这是音色试听。";

export const GENDER_LABEL: Record<VoiceGender, string> = {
  female: "女",
  male: "男",
  child: "童",
};

/** 火山开放语音合成精选音色，可直接作 voice_type。名称与 ID 对齐官网列表。 */
export const BUILTIN_VOICES: BuiltinVoice[] = [
  { id: "BV001_streaming", name: "通用女声", gender: "female", use: "口播" },
  { id: "BV007_streaming", name: "亲切女声", gender: "female", use: "讲解" },
  { id: "BV005_streaming", name: "活泼女声", gender: "female", use: "种草" },
  { id: "BV009_streaming", name: "知性女声", gender: "female", use: "解说" },
  { id: "BV104_streaming", name: "温柔淑女", gender: "female", use: "口播" },
  { id: "BV113_streaming", name: "甜宠少御", gender: "female", use: "种草" },
  { id: "BV115_streaming", name: "古风少御", gender: "female", use: "角色" },
  { id: "BV405_streaming", name: "甜美小源", gender: "female", use: "助手" },
  { id: "BV406_streaming", name: "梓梓", gender: "female", use: "口播" },
  { id: "BV412_streaming", name: "影视解说小美", gender: "female", use: "解说" },
  { id: "BV700_streaming", name: "灿灿", gender: "female", use: "口播" },
  { id: "BV002_streaming", name: "通用男声", gender: "male", use: "口播" },
  { id: "BV004_streaming", name: "开朗青年", gender: "male", use: "口播" },
  { id: "BV008_streaming", name: "亲切男声", gender: "male", use: "讲解" },
  { id: "BV056_streaming", name: "阳光男声", gender: "male", use: "解说" },
  { id: "BV102_streaming", name: "儒雅青年", gender: "male", use: "解说" },
  { id: "BV107_streaming", name: "霸气青叔", gender: "male", use: "故事" },
  { id: "BV119_streaming", name: "通用赘婿", gender: "male", use: "故事" },
  { id: "BV120_streaming", name: "反卷青年", gender: "male", use: "口播" },
  { id: "BV123_streaming", name: "阳光青年", gender: "male", use: "口播" },
  { id: "BV142_streaming", name: "沉稳解说男", gender: "male", use: "解说" },
  { id: "BV701_streaming", name: "擎苍", gender: "male", use: "角色" },
  { id: "BV051_streaming", name: "奶气萌娃", gender: "child", use: "童声" },
  { id: "BV061_streaming", name: "天才童声", gender: "child", use: "童声" },
  { id: "BV064_streaming", name: "小萝莉", gender: "child", use: "童声" },
];

/** 阿里百炼 CosyVoice 精选音色，可直接作 voice。 */
export const DASHSCOPE_VOICES: BuiltinVoice[] = [
  { id: "longanhuan_v3", name: "龙安欢", gender: "female", use: "陪伴" },
  { id: "longxiaochun_v3", name: "龙小淳", gender: "female", use: "助手" },
  { id: "longanwen_v3", name: "龙安温", gender: "female", use: "助手" },
  { id: "longhua_v3", name: "龙华", gender: "female", use: "陪伴" },
  { id: "longanrou_v3", name: "龙安柔", gender: "female", use: "陪伴" },
  { id: "longanran_v3", name: "龙安燃", gender: "female", use: "带货" },
  { id: "longlaoyi_v3", name: "龙老姨", gender: "female", use: "短视频" },
  { id: "longyingxiao_v3", name: "龙应笑", gender: "female", use: "客服" },
  { id: "longanya_v3", name: "龙安雅", gender: "female", use: "陪伴" },
  { id: "longanqin_v3", name: "龙安亲", gender: "female", use: "有声" },
  { id: "longyuan_v3", name: "龙媛", gender: "female", use: "有声" },
  { id: "longxing_v3", name: "龙星", gender: "female", use: "陪伴" },
  { id: "longanyang", name: "龙安洋", gender: "male", use: "陪伴" },
  { id: "longfei_v3", name: "龙飞", gender: "male", use: "销售" },
  { id: "longlaotie_v3", name: "龙老铁", gender: "male", use: "方言" },
  { id: "longze_v3", name: "龙泽", gender: "male", use: "陪伴" },
  { id: "longcheng_v3", name: "龙橙", gender: "male", use: "陪伴" },
  { id: "longshu_v3", name: "龙书", gender: "male", use: "播报" },
  { id: "longnan_v3", name: "龙楠", gender: "male", use: "有声" },
  { id: "longyichen_v3", name: "龙逸尘", gender: "male", use: "有声" },
  { id: "longsanshu_v3", name: "龙三叔", gender: "male", use: "有声" },
  { id: "longhuhu_v3", name: "龙呼呼", gender: "child", use: "童声" },
  { id: "longpaopao_v3", name: "龙泡泡", gender: "child", use: "童声" },
  { id: "longjielidou_v3", name: "龙杰力豆", gender: "child", use: "童声" },
];

export function catalogFor(provider: TtsProvider): BuiltinVoice[] {
  return provider === "dashscope" ? DASHSCOPE_VOICES : BUILTIN_VOICES;
}

export function findBuiltinVoice(id: string): BuiltinVoice | undefined {
  return BUILTIN_VOICES.find((item) => item.id === id);
}

export function findDashscopeVoice(id: string): BuiltinVoice | undefined {
  return DASHSCOPE_VOICES.find((item) => item.id === id);
}

export function findCatalogVoice(provider: TtsProvider, id: string): BuiltinVoice | undefined {
  return catalogFor(provider).find((item) => item.id === id);
}

export function filterVoices(
  catalog: BuiltinVoice[],
  opts: { gender?: VoiceGender | "all"; query?: string } = {},
): BuiltinVoice[] {
  const gender = opts.gender && opts.gender !== "all" ? opts.gender : undefined;
  const query = opts.query?.trim().toLowerCase() ?? "";
  return catalog.filter((item) => {
    if (gender && item.gender !== gender) return false;
    if (!query) return true;
    return item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query) || item.use.includes(query);
  });
}

export function voiceSelectValue(id: string): string {
  return findBuiltinVoice(id) ? id : CUSTOM_VOICE_VALUE;
}

export function voiceLabel(id: string): string {
  const found = findBuiltinVoice(id) ?? findDashscopeVoice(id);
  if (found) return `${found.name}（${found.id}）`;
  return id.trim() || "未选择音色";
}

export function resolveVoiceName(id: string): string {
  return findBuiltinVoice(id)?.name ?? findDashscopeVoice(id)?.name ?? (id.trim() || "未记录音色");
}

export function formatJobVoice(tts?: { provider?: string; voiceType?: string } | null): string {
  if (!tts?.voiceType?.trim()) return "配音未记录";
  const provider = tts.provider === "dashscope" ? "阿里百炼" : "火山";
  return `${provider} · ${resolveVoiceName(tts.voiceType)}`;
}
