import type { ChapterState } from './ws.schema';
/** 当前章节是否已达到记忆所需的最低章节 */
export declare function isChapterAtLeast(current: ChapterState, required: ChapterState, rankMap?: Record<string, number>): boolean;
