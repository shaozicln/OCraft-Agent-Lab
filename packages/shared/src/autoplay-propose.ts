import {
  autoPlayNextProposalSchema,
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
};

export function isAutoPlayGoalReached(
  goal: AutoPlayGoal,
  actual: {
    chapter?: string;
    sawTargetExchange?: boolean;
  },
): boolean {
  if (goal.target_chapter && actual.chapter !== goal.target_chapter) {
    return false;
  }
  if (goal.target_exchange && !actual.sawTargetExchange) {
    return false;
  }
  // 至少有一个目标时才算「达成」；都没写则永不靠目标完成
  return Boolean(goal.target_chapter || goal.target_exchange);
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
    if (!r.data.done && !r.data.say?.trim()) return null;
    return r.data;
  } catch {
    return null;
  }
}

/**
 * MOCK / 无 key：按章与目标启发式生成下一句（可推进 feel 演示路径）
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
    };
  }

  if (turnIndex >= goal.max_turns) {
    return {
      done: true,
      reason: '达到最大拍数',
      source: 'mock',
    };
  }

  const hasMetHook = flagNames.includes('met_hook');
  const exchangeReady =
    goal.target_exchange != null &&
    availableEvents.includes(goal.target_exchange);

  // 已在目标章且戏码可尝试：再推一句现场闲聊，让 Pack 有机会命中
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
    return {
      say,
      done: false,
      reason: '目标章已到，推进互聊窗口',
      source: 'mock',
    };
  }

  // 日常章：先闲聊，再点转校/希尔薇以触发升章（与旧 feel 路径同语义，但是启发式）
  if (chapterId === 'ch1_daily' || chapterId.startsWith('ch1_')) {
    if (turnIndex === 0 && priorSays.length === 0) {
      return {
        say: '放学一起去球场吗',
        done: false,
        reason: '开场闲聊',
        source: 'mock',
      };
    }
    return {
      say: '听说有转校生要来，叫希尔薇？',
      done: false,
      reason: '点名钩子推进升章',
      source: 'mock',
    };
  }

  // 其它章：顺着场上往目标靠
  if (goal.target_chapter && chapterId !== goal.target_chapter) {
    return {
      say: '最近班上有什么新消息吗？听说要来转校生……',
      done: false,
      reason: '未达目标章，试探推进',
      source: 'mock',
    };
  }

  return {
    say: `${focusNpcName}，我们继续刚才的话题吧。`,
    done: turnIndex >= goal.max_turns - 1,
    reason: '保底续聊',
    source: 'mock',
  };
}
