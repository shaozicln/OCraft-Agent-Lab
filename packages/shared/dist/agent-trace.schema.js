"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentTraceListResponseSchema = exports.agentTraceRecordSchema = exports.agentTraceDirectorSchema = exports.directorFallbackSchema = exports.directorFallbackReasonSchema = exports.directorModeSchema = exports.agentTraceRuntimeSchema = exports.agentTraceTransitionSchema = exports.agentTraceRagPathSchema = exports.agentTraceRagHitSchema = void 0;
const zod_1 = require("zod");
const ws_schema_1 = require("./ws.schema");
exports.agentTraceRagHitSchema = zod_1.z.object({
    memory_id: zod_1.z.string(),
    score: zod_1.z.number(),
    /** Mem-V：命中来自向量或关键词回退 */
    source: zod_1.z.enum(['vector', 'keyword']).optional(),
});
exports.agentTraceRagPathSchema = zod_1.z.enum(['vector', 'keyword_fallback']);
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
exports.directorModeSchema = zod_1.z.enum([
    'reply_player',
    'reply_then_exchange',
]);
exports.directorFallbackReasonSchema = zod_1.z.enum([
    'parse_error',
    'invalid_cast',
    'llm_error',
    'skipped_whisper',
]);
/** false = 决策成功；字符串 = fallback 原因码 */
exports.directorFallbackSchema = zod_1.z.union([
    zod_1.z.literal(false),
    exports.directorFallbackReasonSchema,
]);
exports.agentTraceDirectorSchema = zod_1.z.object({
    mode: exports.directorModeSchema.optional(),
    speakers: zod_1.z.array(zod_1.z.string()).optional(),
    reason: zod_1.z.string().optional(),
    fallback: exports.directorFallbackSchema,
    /** MA-H：导演 prompt 可见的戏码 id（无触发/台词） */
    available_events: zod_1.z.array(zod_1.z.string()).optional(),
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
    /** Mem-V：本轮检索路径 */
    rag_path: exports.agentTraceRagPathSchema.optional(),
    rag_embed_backend: zod_1.z.enum(['api', 'local']).optional(),
    rag_error: zod_1.z.string().optional(),
    /** Mem-W：本轮注入的公开场近期句（不含悄悄话） */
    working_memory_lines: zod_1.z.array(zod_1.z.string()).optional(),
    animation: zod_1.z.string().optional(),
    /** NPC 回复后置 flag（异步补记） */
    reply_flags_set: zod_1.z
        .array(zod_1.z.object({
        name: zod_1.z.string(),
        value: zod_1.z.string(),
    }))
        .optional(),
    /** 本轮结束后触发的关系事件互聊（异步补记） */
    exchange: zod_1.z
        .object({
        event_id: zod_1.z.string(),
        lines: zod_1.z.array(zod_1.z.object({
            npc_id: zod_1.z.string(),
            name: zod_1.z.string(),
            text: zod_1.z.string(),
        })),
    })
        .optional(),
    /** 导演调度决策（焦点回复前的 mode / speakers） */
    director: exports.agentTraceDirectorSchema.optional(),
    /** MA-W：悄悄话来源（按钮 / 措辞自动） */
    whisper_source: zod_1.z.enum(['client', 'auto']).optional(),
    /** F：主回复安全扫描 */
    safety: zod_1.z
        .object({
        ok: zod_1.z.boolean(),
        rewritten: zod_1.z.boolean().optional(),
        reasons: zod_1.z
            .array(zod_1.z.object({
            code: zod_1.z.string(),
            detail: zod_1.z.string(),
        }))
            .default([]),
    })
        .optional(),
});
exports.agentTraceListResponseSchema = zod_1.z.object({
    traces: zod_1.z.array(exports.agentTraceRecordSchema),
});
