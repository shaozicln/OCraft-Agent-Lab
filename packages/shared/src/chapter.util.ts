import type { ChapterState } from './ws.schema';

/** 无 Pack 时的回退 rank（官方 office 三章） */
const FALLBACK_CHAPTER_RANK: Record<string, number> = {
  daily: 0,
  uneasy: 1,
  dream_reveal: 2,
};

/** 当前章节是否已达到记忆所需的最低章节 */
export function isChapterAtLeast(
  current: ChapterState,
  required: ChapterState,
  rankMap?: Record<string, number>,
): boolean {
  const ranks = rankMap ?? FALLBACK_CHAPTER_RANK;
  const cur = ranks[current];
  const req = ranks[required];
  if (cur === undefined || req === undefined) {
    return current === required;
  }
  return cur >= req;
}
