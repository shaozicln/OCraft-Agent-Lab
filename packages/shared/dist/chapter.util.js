"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isChapterAtLeast = isChapterAtLeast;
const CHAPTER_RANK = {
    daily: 0,
    uneasy: 1,
    dream_reveal: 2,
};
/** 当前章节是否已达到记忆所需的最低章节 */
function isChapterAtLeast(current, required) {
    return CHAPTER_RANK[current] >= CHAPTER_RANK[required];
}
