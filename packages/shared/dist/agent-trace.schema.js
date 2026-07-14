"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentTraceListResponseSchema = exports.agentTraceRecordSchema = exports.agentTraceRuntimeSchema = exports.agentTraceTransitionSchema = exports.agentTraceRagHitSchema = void 0;
const zod_1 = require("zod");
const ws_schema_1 = require("./ws.schema");
exports.agentTraceRagHitSchema = zod_1.z.object({
    memory_id: zod_1.z.string(),
    score: zod_1.z.number(),
});
exports.agentTraceTransitionSchema = zod_1.z.object({
    chapter_before: zod_1.z.string(),
    chapter_after: zod_1.z.string(),
    flags_set: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        value: zod_1.z.string(),
    })),
    matched_rule_ids: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.agentTraceRuntimeSchema = zod_1.z.object({
    affinity: zod_1.z.number(),
    fatigue: zod_1.z.number(),
    current_status: zod_1.z.string(),
});
/** 单轮 Agent 决策 Trace（可回放） */
exports.agentTraceRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    at: zod_1.z.string(),
    player_id: zod_1.z.string(),
    npc_id: zod_1.z.string(),
    world_id: zod_1.z.string(),
    pack_version_id: zod_1.z.string(),
    player_message: zod_1.z.string(),
    mock: zod_1.z.boolean(),
    runtime_before: exports.agentTraceRuntimeSchema,
    runtime_after: exports.agentTraceRuntimeSchema,
    tools: zod_1.z.array(ws_schema_1.toolCallResultSchema),
    transition: exports.agentTraceTransitionSchema,
    rag_hits: zod_1.z.array(exports.agentTraceRagHitSchema),
    animation: zod_1.z.string().optional(),
    /** NPC 回复后置 flag（异步补记） */
    reply_flags_set: zod_1.z
        .array(zod_1.z.object({
        name: zod_1.z.string(),
        value: zod_1.z.string(),
    }))
        .optional(),
});
exports.agentTraceListResponseSchema = zod_1.z.object({
    traces: zod_1.z.array(exports.agentTraceRecordSchema),
});
