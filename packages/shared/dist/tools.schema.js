"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_NPC_TOOLS = exports.STRONG_NPC_TOOLS = exports.SOFT_NPC_TOOLS = exports.requestHintSchema = exports.queryRuntimeSchema = exports.updateFatigueSchema = exports.updateAffinitySchema = void 0;
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
/** 软数值 tool（可方差） */
exports.SOFT_NPC_TOOLS = ['updateFatigue', 'updateAffinity'];
/** 强业务 tool（严 schema、只读优先） */
exports.STRONG_NPC_TOOLS = ['query_runtime', 'request_hint'];
exports.ALLOWED_NPC_TOOLS = [
    ...exports.SOFT_NPC_TOOLS,
    ...exports.STRONG_NPC_TOOLS,
];
function isAllowedNpcTool(name) {
    return exports.ALLOWED_NPC_TOOLS.includes(name);
}
