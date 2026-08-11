/**
 * Pack 台词质感（AP-V）：全局「台词规矩」格式。
 * 新建世界 / 加载包 / 生成 prompt_common 均应保证 reply_instruction 含本块。
 * 禁令参考市面去 AI 味清单，压成短规则供 runtime prompt，不引入二次润色。
 */

export const NPC_LINE_VOICE_RULES_MARKER = '【台词规矩·游戏内】';

/** 全局台词规矩正文（含标记行） */
export const DEFAULT_NPC_LINE_VOICE_RULES = `${NPC_LINE_VOICE_RULES_MARKER}
- 用角色口吻当面说话，像游戏里冒泡；情绪用动作/半截话带出，不要旁白总结或空洞抒情。
- 单次回复优先 1～3 句；单句尽量不超过 40 字；句长可长短交错，勿每句同构。
- 遵守该角色【蒸馏话风】块；没有则保持人设，勿突然变软萌或全知；勿编造未解锁记忆/设定。
- 禁止：自称 AI/助手；宣布升章/结局；长篇内心独白；括号心理旁白。
- 去 AI 腔：不用「首先/其次/综上所述/值得注意的是」；少用「不是…而是」掰扯；不段末升华；不假互动收尾。
- 可以口语、停顿、反问；不要排比说教、翻译腔、书面讲义腔。`;

/** 新建空包 / schema 默认用的完整 reply_instruction */
export const DEFAULT_REPLY_INSTRUCTION = `${DEFAULT_NPC_LINE_VOICE_RULES}

请用中文、口语化、符合人设地回复玩家。不要有太多括号和OOC（不符合人设和剧情的语言）的表现，回复控制在 2-4 句话。`;

/**
 * 若缺少【台词规矩·游戏内】则前置默认块；已有则原样返回。
 * 用于：加载 Pack、生成片段合并、蒸馏写回后兜底。
 */
export function ensureNpcLineVoiceRules(replyInstruction: string): string {
  const raw = replyInstruction ?? '';
  if (raw.includes(NPC_LINE_VOICE_RULES_MARKER)) return raw;
  const rest = raw.trim();
  return rest
    ? `${DEFAULT_NPC_LINE_VOICE_RULES}\n\n${rest}`
    : DEFAULT_NPC_LINE_VOICE_RULES;
}

/** 蒸馏话风块起止（与 pack-distill-apply CD-B 一致） */
export function distillVoiceBlockStart(npcId: string): string {
  return `【蒸馏话风·${npcId}】`;
}

export function distillVoiceBlockEnd(npcId: string): string {
  return `【/蒸馏话风·${npcId}】`;
}

/** 由 speech_patterns 生成可写入 reply_instruction 的块；无条目则 null */
export function buildDistillVoiceBlock(opts: {
  npcId: string;
  name: string;
  speechPatterns: string[];
}): string | null {
  const patterns = opts.speechPatterns.map((s) => s.trim()).filter(Boolean);
  if (!patterns.length || !opts.npcId.trim()) return null;
  const start = distillVoiceBlockStart(opts.npcId);
  const end = distillVoiceBlockEnd(opts.npcId);
  const styleLine = [
    `${opts.name}（${opts.npcId}）正面话风：${patterns.join('；')}。`,
    '仅在扮演该角色时参考；勿宣布升章/结局。',
  ].join('');
  return `${start}\n${styleLine}\n${end}`;
}
