import type { ChapterState, NpcRuntimeState } from '@ocraft/shared';

const UNEASY_TRIGGERS = [
  '没睡好',
  '睡不好',
  '失眠',
  '没休息',
  '休息不好',
  '精神不好',
  '最近是不是',
];

const DREAM_REVEAL_TRIGGERS = [
  '同一个梦',
  '重复的梦',
  '总做',
  '老是做',
  '做梦',
  '噩梦',
];

export interface ChapterTransitionInput {
  chapterState: ChapterState;
  playerMessage: string;
  runtimeState: NpcRuntimeState;
}

/** daily → uneasy → dream_reveal，只升不降 */
export function evaluateChapterTransition(
  input: ChapterTransitionInput,
): ChapterState {
  const msg = input.playerMessage.toLowerCase();
  const { chapterState, runtimeState } = input;

  if (chapterState === 'daily') {
    const hitUneasy = UNEASY_TRIGGERS.some((t) => msg.includes(t.toLowerCase()));
    if (hitUneasy && runtimeState.affinity >= 40) {
      return 'uneasy';
    }
    return 'daily';
  }

  if (chapterState === 'uneasy') {
    const hitDream = DREAM_REVEAL_TRIGGERS.some((t) =>
      msg.includes(t.toLowerCase()),
    );
    if (hitDream && runtimeState.affinity >= 45) {
      return 'dream_reveal';
    }
    return 'uneasy';
  }

  return 'dream_reveal';
}
