"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_NPC_TOOLS = exports.STRONG_NPC_TOOLS = exports.SOFT_NPC_TOOLS = exports.stopFollowSchema = exports.followPlayerSchema = exports.recallMemorySchema = exports.requestHintSchema = exports.queryRuntimeSchema = exports.updateFatigueSchema = exports.updateAffinitySchema = void 0;
exports.isAllowedNpcTool = isAllowedNpcTool;
const zod_1 = require("zod");
exports.updateAffinitySchema = zod_1.z.object({
    delta: zod_1.z.number().int().min(-100).max(100),
    reason: zod_1.z.string().optional(),
});
exports.updateFatigueSchema = zod_1.z.object({
    delta: zod_1.z.number().int().min(-100).max(100),
    reason: zod_1.z.string().optional(),
});
/** 强指令：只读查询当前运行时（章 / 数值 / flags） */
exports.queryRuntimeSchema = zod_1.z.object({
    reason: zod_1.z.string().max(120).optional(),
});
/** 强指令：要一条受当前章约束的提示（不剧透未解锁内容） */
exports.requestHintSchema = zod_1.z.object({
    topic: zod_1.z.string().max(80).optional(),
    reason: zod_1.z.string().max(120).optional(),
});
/** Mem-T：只读按 query 再取一层 Pack 长期记忆（章门控由检索侧保证） */
exports.recallMemorySchema = zod_1.z.object({
    query: zod_1.z.string().trim().min(1).max(120),
    top_k: zod_1.z.number().int().min(1).max(5).optional(),
    reason: zod_1.z.string().max(120).optional(),
});
/**
 * 场景跟随：
 * - companion：跟着玩家走，直到 stop_follow
 * - to_npc：跟到靠近目标 NPC 后自动停
 */
exports.followPlayerSchema = zod_1.z
    .object({
    mode: zod_1.z.enum(['companion', 'to_npc']),
    target_npc_id: zod_1.z.string().trim().min(1).max(64).optional(),
    reason: zod_1.z.string().max(120).optional(),
})
    .superRefine((v, ctx) => {
    if (v.mode === 'to_npc' && !v.target_npc_id) {
        ctx.addIssue({
            code: 'custom',
            message: 'mode=to_npc 时必须提供 target_npc_id',
            path: ['target_npc_id'],
        });
    }
});
exports.stopFollowSchema = zod_1.z.object({
    reason: zod_1.z.string().max(120).optional(),
});
/** 软数值 / 场景行动 tool（可方差） */
exports.SOFT_NPC_TOOLS = [
    'updateFatigue',
    'updateAffinity',
    'follow_player',
    'stop_follow',
];
/** 强业务 tool（严 schema、只读优先） */
exports.STRONG_NPC_TOOLS = [
    'query_runtime',
    'request_hint',
    'recall_memory',
];
exports.ALLOWED_NPC_TOOLS = [
    ...exports.SOFT_NPC_TOOLS,
    ...exports.STRONG_NPC_TOOLS,
];
function isAllowedNpcTool(name) {
    return exports.ALLOWED_NPC_TOOLS.includes(name);
}
