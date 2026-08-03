import {
  autoPlayNextProposalSchema,
  normalizeAutoPlayBeatLines,
  resolveAutoPlayStopKind,
  type AutoPlayGoal,
  type AutoPlayNextProposal,
} from './autoplay.schema';

export type AutoPlayProposeInput = {
  goal: AutoPlayGoal;
  turnIndex: number;
  chapterId: string;
  chapterLabel: string;
  flagNames: string[];
  availableEvents: string[];
  recentLines: string[];
  priorSays: string[];
  focusNpcName: string;
  /** 本局是否已见目标互聊 */
  sawTargetExchange: boolean;
  styleHint?: string;
  /** 加速：尽快升章 / 终章撞结局 */
  accelerate?: boolean;
  /** 上场可点名角色（含可选 player stub） */
  castIds?: string[];
  maxSpeakers?: number;
  /** 本拍是否必须含玩家句（Pack 升章/结局门槛） */
  requirePlayerLine?: boolean;
};

export function isAutoPlayGoalReached(
  goal: AutoPlayGoal,
  actual: {
    chapter?: string;
    sawTargetExchange?: boolean;
    endingId?: string | null;
  },
): boolean {
  return resolveAutoPlayStopKind(goal, actual) != null;
}

export function parseAutoPlayNextJson(
  raw: string,
): AutoPlayNextProposal | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const r = autoPlayNextProposalSchema.safeParse({
      ...(typeof parsed === 'object' && parsed ? parsed : {}),
      source: 'agent',
    });
    if (!r.success) return null;
    const lines = normalizeAutoPlayBeatLines(r.data);
    if (!r.data.done && lines.length === 0) return null;
    const playerSay =
      lines.find((l) => l.speaker_kind === 'player')?.text ?? r.data.say;
    return {
      ...r.data,
      lines,
      say: playerSay,
    };
  } catch {
    return null;
  }
}

/**
 * MOCK / 无 key：按章与目标启发式生成下一拍（eval 夹具；运行时自动演禁 MOCK）
 */
export function mockProposeAutoPlayNext(
  input: AutoPlayProposeInput,
): AutoPlayNextProposal {
  const {
    goal,
    turnIndex,
    chapterId,
    flagNames,
    availableEvents,
    priorSays,
    focusNpcName,
    sawTargetExchange,
    requirePlayerLine,
  } = input;

  if (
    isAutoPlayGoalReached(goal, {
      chapter: chapterId,
      sawTargetExchange,
    })
  ) {
    return {
      done: true,
      reason: '目标已达成',
      source: 'mock',
      lines: [],
    };
  }

  // eval 夹具仍可用 max_turns 软结束；产品路径不应走到 MOCK
  if (turnIndex >= goal.max_turns) {
    return {
      done: true,
      reason: '达到拍数软顶（MOCK）',
      source: 'mock',
      lines: [],
    };
  }

  const hasMetHook = flagNames.includes('met_hook');
  const exchangeReady =
    goal.target_exchange != null &&
    availableEvents.includes(goal.target_exchange);

  const playerLine = (text: string, reason: string): AutoPlayNextProposal => ({
    say: text,
    lines: [{ speaker_kind: 'player', speaker_id: 'player', text }],
    done: false,
    reason,
    source: 'mock',
  });

  const npcLine = (text: string, reason: string): AutoPlayNextProposal => ({
    lines: [
      {
        speaker_kind: 'npc',
        speaker_id: goal.npc_id,
        text,
      },
    ],
    done: false,
    reason,
    source: 'mock',
  });

  if (
    goal.target_chapter &&
    chapterId === goal.target_chapter &&
    (exchangeReady || hasMetHook) &&
    !sawTargetExchange
  ) {
    const say =
      priorSays.length === 0
        ? `对了，${focusNpcName}，走廊钟声是不是有点怪？`
        : '你刚才说的转校生……她现在在附近吗？';
    return playerLine(say, '目标章已到，推进互聊窗口');
  }

  if (requirePlayerLine || input.accelerate) {
    if (chapterId === 'ch1_daily' || chapterId.startsWith('ch1_')) {
      if (turnIndex === 0 && priorSays.length === 0) {
        return playerLine('放学一起去球场吗', '开场闲聊');
      }
      return playerLine(
        '听说有转校生要来，叫希尔薇？',
        '点名钩子推进升章',
      );
    }
    if (goal.target_chapter && chapterId !== goal.target_chapter) {
      return playerLine(
        '最近班上有什么新消息吗？听说要来转校生……',
        '未达目标章，试探推进',
      );
    }
    return playerLine(
      `${focusNpcName}，我们继续刚才的话题吧。`,
      '保底续聊',
    );
  }

  // AP-1：无玩家门槛时允许纯 NPC 拍
  return npcLine('刚才那事……你们怎么看？', 'NPC 排场拍');
}
