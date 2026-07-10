"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isChapterAtLeast = isChapterAtLeast;
/** 当前章节是否已达到记忆所需的最低章节（须传入 Pack 的 rankMap） */
function isChapterAtLeast(current, required, rankMap) {
    const cur = rankMap[current];
    const req = rankMap[required];
    if (cur === undefined || req === undefined) {
        return current === required;
    }
    return cur >= req;
}
