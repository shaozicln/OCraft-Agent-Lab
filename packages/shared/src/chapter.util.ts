import type { ChapterState } from './ws.schema';

const CHAPTER_RANK: Record<ChapterState, number> = {
  daily: 0,
  uneasy: 1,
  dream_reveal: 2,
};

/** 当前章节是否已达到记忆所需的最低章节 */
export function isChapterAtLeast(
  current: ChapterState,
  required: ChapterState,
): boolean {
  return CHAPTER_RANK[current] >= CHAPTER_RANK[required];
}
