"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isChapterAtLeast = isChapterAtLeast;
/** 无 Pack 时的回退 rank（官方 office 三章） */
const FALLBACK_CHAPTER_RANK = {
    daily: 0,
    uneasy: 1,
    dream_reveal: 2,
};
/** 当前章节是否已达到记忆所需的最低章节 */
function isChapterAtLeast(current, required, rankMap) {
    const ranks = rankMap ?? FALLBACK_CHAPTER_RANK;
    const cur = ranks[current];
    const req = ranks[required];
    if (cur === undefined || req === undefined) {
        return current === required;
    }
    return cur >= req;
}
