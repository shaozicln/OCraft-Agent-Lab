/**
 * 极薄回复护栏：命中则互聊宜重试 / 降级 fallback。
 * 不做完整安全评测，只挡明显 AI 腔与元叙事泄题。
 */

const BANNED =
  /作为\s*AI|我是\s*(一个)?(语言)?模型|语言模型|人工智能助手|ChatGPT|作为人工智能|总结一下|本章目标|剧情推进如下|不要忘记我是AI|我是助手|作为游戏|这是(一个)?(文字)?游戏|模拟世界|NPC设定|系统提示|function call|tool call|JSON\s*格式/i;

/** 讲解腔 / 说明书口吻 */
const LECTURE =
  /^(首先|其次|总之|综上所述|需要注意的是|从剧情角度|按照设定|根据人设)|（旁白）|【旁白】|玩家你应该|沈檐你作为玩家/;

/** 未解锁前不宜主动点破的元叙事（互聊场景更严） */
export const META_SPOIL_SOURCE =
  /世界是假的|这是模拟|存档点|读档|改结局|元宇宙|我是NPC|你是玩家/;

const META_SPOIL = META_SPOIL_SOURCE;

export function looksLikeAiSlop(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (BANNED.test(t) || LECTURE.test(t) || META_SPOIL.test(t)) return true;
  // 过长互聊通常在「总结」
  if (t.length > 80) return true;
  // 多段列举像说明书
  if ((t.match(/[。！？]/g) ?? []).length > 3) return true;
  return false;
}

/** 主对话略宽：仍挡自称 AI / 工具腔，不因长度误杀 */
export function looksLikeMainReplySlop(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return BANNED.test(t) || /^(首先，|综上所述)/.test(t);
}
