"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.distillApplyResultSchema = exports.distillApplyPayloadSchema = exports.distillApplyModeSchema = exports.distillNormalizeResultSchema = exports.distillNormalizePayloadSchema = exports.distillBriefResultSchema = exports.distillBriefPayloadSchema = exports.distillCardSchema = exports.distillTriggerReactionSchema = void 0;
const zod_1 = require("zod");
const pack_schema_1 = require("./pack.schema");
/** 软情境→反应（只进人设 prompt，不写硬 triggers） */
exports.distillTriggerReactionSchema = zod_1.z.object({
    situation: zod_1.z.string().trim().min(1).max(120),
    reaction: zod_1.z.string().trim().min(1).max(200),
});
/**
 * 人设蒸馏卡（Character Distillation）。
 * 用户确认后才 apply 进 Pack.npcs[]。
 */
exports.distillCardSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(80),
    /** 建议 npc_id；可空，apply 时再生成 */
    npc_id: pack_schema_1.packIdSchema.optional(),
    core_traits: zod_1.z.array(zod_1.z.string().trim().min(1).max(120)).max(12).default([]),
    speech_patterns: zod_1.z
        .array(zod_1.z.string().trim().min(1).max(200))
        .max(8)
        .default([]),
    typical_phrases: zod_1.z
        .array(zod_1.z.string().trim().min(1).max(200))
        .max(12)
        .default([]),
    trigger_reactions: zod_1.z.array(exports.distillTriggerReactionSchema).max(12).default([]),
    forbidden_behaviors: zod_1.z
        .array(zod_1.z.string().trim().min(1).max(200))
        .max(12)
        .default([]),
    /** 溯源短注，如「蒸馏自短描述」 */
    source_note: zod_1.z.string().trim().max(200).optional(),
});
exports.distillBriefPayloadSchema = zod_1.z.object({
    brief: zod_1.z.string().trim().min(1).max(2000),
    /** 可选：参考当前 Pack（章 id 等），不写回 */
    pack: zod_1.z.unknown().optional(),
    /** 更新已有 NPC 时传入，便于 mock/LLM 对齐 id */
    target_npc_id: pack_schema_1.packIdSchema.optional(),
});
exports.distillBriefResultSchema = zod_1.z.object({
    card: exports.distillCardSchema,
    source: zod_1.z.enum(['llm', 'mock']),
});
exports.distillNormalizePayloadSchema = zod_1.z.object({
    /** 粘贴的 JSON 或简易 YAML 文本，或已是对象 */
    raw: zod_1.z.union([zod_1.z.string().min(1).max(20000), zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())]),
});
exports.distillNormalizeResultSchema = zod_1.z.object({
    card: exports.distillCardSchema,
    warnings: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.distillApplyModeSchema = zod_1.z.enum(['create', 'update']);
exports.distillApplyPayloadSchema = zod_1.z.object({
    pack: zod_1.z.unknown(),
    card: exports.distillCardSchema,
    mode: exports.distillApplyModeSchema.default('create'),
    /** update 时必填；create 时若与现有冲突需 overwrite 或换 id */
    target_npc_id: pack_schema_1.packIdSchema.optional(),
    /** create 且 id 已存在时：true=覆盖该 NPC，false=报错 */
    overwrite: zod_1.z.boolean().optional(),
});
exports.distillApplyResultSchema = zod_1.z.object({
    pack: zod_1.z.unknown(),
    patch_notes: zod_1.z.array(zod_1.z.string()).default([]),
    applied_npc_id: pack_schema_1.packIdSchema,
    applied: zod_1.z.boolean(),
    applied_summary: zod_1.z.string(),
});
