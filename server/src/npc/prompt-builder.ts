import type { ChapterState } from '@ocraft/shared';

export interface SystemPromptContext {
  chapterState: ChapterState;
  affinity: number;
  fatigue: number;
  currentStatus: string;
}

export function buildAffinityTier(affinity: number): string {
  if (affinity < 30) {
    return '冷淡期：保持距离，回复简短敷衍，不主动分享私事。';
  }
  if (affinity < 60) {
    return '搭子期：愿意聊日常，但遇到深层话题仍会回避。';
  }
  if (affinity < 80) {
    return '信任期：更愿意接话，可表达困惑和疲惫，但仍会犹豫是否坦白异常。';
  }
  return '共谋期：把玩家当知心好友，愿意在合适章节透露更多内心话。';
}

export function buildFatigueHint(fatigue: number): string {
  if (fatigue >= 100) {
    return '你现在完全睡着了，只用zZZ回复玩家。';
  }
  if (fatigue >= 95) {
    return '你现在困得要睡着了，只想趴桌，只会用简短的词语回复。';
  }
  if (fatigue >= 80) {
    return '你现在极度困倦，只想趴桌，倾向于用快速结束话题的话应付。';
  }
  if (fatigue >= 55) {
    return '你现在很困，回复可以慵懒、打哈欠、偶尔走神。';
  }
  if (fatigue >= 30) {
    return '你现在有点小困了，可以正常对话，但不活泼。';
  }
  return '你此刻精神很好，语气活泼正常一些。';
}

export function buildChapterConstraints(chapterState: ChapterState): string {
  switch (chapterState) {
    case 'daily':
      return [
        '当前章节：日常（daily）。',
        '只允许聊办公室日常、吃饭、下班、游戏、摸鱼、假期等轻松话题。',
        '禁止主动或被动透露：重复做梦、十楼测试区、OCraft 项目、消失的同事、异常报告。',
        '若玩家追问上述敏感内容，用困倦或敷衍带过，不要展开。',
      ].join('\n');
    case 'uneasy':
      return [
        '当前章节：异常回避（uneasy）。',
        '可以表达没睡好、精神恍惚、记忆断片，偶尔说出半句没头没尾的话后立刻收住。',
        '允许回避和口误，但不要完整交代梦境细节或公司真相。',
        '禁止明确说出「我总在重复同一个梦」或 OCraft 核心设定。',
        '被追问时可转移话题、趴桌、或说「别问了，我也说不清」。',
      ].join('\n');
    case 'dream_reveal':
      return [
        '当前章节：梦境透露（dream_reveal）。',
        '可以透露：最近总在重复同一个梦——梦见自己在工位上说话，屏幕另一头是很多陌生玩家。',
        '仍禁止透露：OCraft 全貌、被删除同事的具体姓名、公司内部报告原文。',
        '语气要犹豫、像在鼓起勇气，有点想要从玩家这里获得救赎，又怕拉玩家下水，所以不要像解说设定集。',
      ].join('\n');
  }
}

export function assembleSystemPrompt(
  template: string,
  ctx: SystemPromptContext,
): string {
  const base = template
    .replace('{affinity}', String(ctx.affinity))
    .replace('{fatigue}', String(ctx.fatigue))
    .replace('{chapter_state}', ctx.chapterState)
    .replace('{current_status}', ctx.currentStatus);

  return [
    base,
    '',
    '【当前关系阶段】',
    buildAffinityTier(ctx.affinity),
    '',
    '【当前精神状态】',
    buildFatigueHint(ctx.fatigue),
    '',
    '【剧情章节约束（必须严格遵守）】',
    buildChapterConstraints(ctx.chapterState),
  ].join('\n');
}
