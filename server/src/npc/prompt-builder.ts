import type { ChapterState, StoryFlagsSnapshot } from '@ocraft/shared';
import { isFlagSet } from '@ocraft/shared';

export interface SystemPromptContext {
  chapterState: ChapterState;
  affinity: number;
  fatigue: number;
  currentStatus: string;
  storyFlags?: StoryFlagsSnapshot;
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

/** 按已置 flags 追加本回合必须/禁止说（骨架约束，LLM 只表演） */
export function buildFlagConstraints(
  chapterState: ChapterState,
  flags: StoryFlagsSnapshot = {},
): string {
  const lines: string[] = [];

  if (isFlagSet(flags, 'ch1_bonded') && chapterState === 'daily') {
    lines.push('已与玩家建立日常搭子感，语气可更熟络，但仍禁止敏感剧透。');
  }

  if (isFlagSet(flags, 'ch2_sleep_mentioned')) {
    lines.push(
      '玩家已关心过你的睡眠：可以含糊承认睡得不好/太困，但未到 dream_reveal 前不要说完整梦境原句。',
    );
  }

  if (isFlagSet(flags, 'ch2_npc_admitted_tired')) {
    lines.push('你已承认过疲惫，后续可自然延续困意，不必每次重新「第一次承认」。');
  }

  if (isFlagSet(flags, 'ch2_floor_avoided')) {
    lines.push(
      '十楼/测试区已被问起：继续回避，不要详述测试区内部；可转移话题或说不想提。',
    );
  } else if (chapterState !== 'daily') {
    lines.push('若玩家突然提十楼或测试区，表现出回避，不要主动展开。');
  }

  if (!isFlagSet(flags, 'ch3_dream_full')) {
    lines.push(
      '尚未解锁完整梦境节点：禁止说出「最近总在重复同一个梦——梦见自己在工位上说话，屏幕另一头是很多陌生玩家」这句完整原句。',
    );
  } else {
    lines.push(
      '已解锁梦境核心：可以说出完整梦境原句，语气犹豫，不要像念设定集。',
    );
  }

  if (isFlagSet(flags, 'ch3_dream_partial') && !isFlagSet(flags, 'ch3_dream_full')) {
    lines.push('你曾漏过半句梦话：可再有短暂口误后立刻收住，仍不要说完整原句。');
  }

  if (isFlagSet(flags, 'ch3_colleague_hint')) {
    lines.push(
      '已暗示过消失同事：可继续含糊提「名单上没了」「做某职位的同事」，永不说具体姓名。',
    );
  } else if (chapterState === 'dream_reveal') {
    lines.push(
      '若玩家追问离职/名单/消失的同事，可暗示但不要主动深挖，且永不说姓名。',
    );
  }

  if (!isFlagSet(flags, 'ch4_ocraft_aware')) {
    lines.push('禁止承认被采样、人格校准或完整解释 OCraft 项目。');
  }

  if (lines.length === 0) return '';
  return ['【本回合 Flag 约束】', ...lines].join('\n');
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

  const flagBlock = buildFlagConstraints(
    ctx.chapterState,
    ctx.storyFlags ?? {},
  );

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
    flagBlock ? `\n${flagBlock}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
