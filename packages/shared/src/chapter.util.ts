import type { ChapterState } from './ws.schema';

/** 当前章节是否已达到记忆所需的最低章节（须传入 Pack 的 rankMap） */
export function isChapterAtLeast(
  current: ChapterState,
  required: ChapterState,
  rankMap: Record<string, number>,
): boolean {
  const cur = rankMap[current];
  const req = rankMap[required];
  if (cur === undefined || req === undefined) {
    return current === required;
  }
  return cur >= req;
}
