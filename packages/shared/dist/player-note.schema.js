"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_PLAYER_NOTES_PER_TURN = exports.MAX_PLAYER_NOTES_INJECT = exports.MAX_PLAYER_NOTES_PER_RUN = exports.playerNoteSchema = exports.playerNoteVisibilitySchema = void 0;
const zod_1 = require("zod");
/** Mem-P：本局玩家要点可见性 */
exports.playerNoteVisibilitySchema = zod_1.z.enum(['public', 'whisper']);
/**
 * Mem-P：run 级玩家要点笔记（非 Pack canon）。
 * 服务台词连贯；升章/结局仍走 Pack 规则。
 */
exports.playerNoteSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    /** 一句摘要（给人 / 给 prompt） */
    text: zod_1.z.string().trim().min(1).max(200),
    keywords: zod_1.z.array(zod_1.z.string().trim().min(1).max(40)).max(12).default([]),
    /** 对谁说的；公开场可空 */
    source_npc_id: zod_1.z.string().min(1).max(64).optional(),
    chapter_id: zod_1.z.string().min(1).max(64),
    visibility: exports.playerNoteVisibilitySchema.default('public'),
    at: zod_1.z.string(),
    /** 0～1，规则抽取可省略 */
    conf: zod_1.z.number().min(0).max(1).optional(),
});
exports.MAX_PLAYER_NOTES_PER_RUN = 40;
exports.MAX_PLAYER_NOTES_INJECT = 12;
exports.MAX_PLAYER_NOTES_PER_TURN = 3;
