"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packClarifyPolishResultSchema = exports.packClarifyPolishPayloadSchema = exports.packClarifyApplyResultSchema = exports.packClarifyApplyPayloadSchema = exports.packClarifyAnswerSchema = exports.packClarifyStartPayloadSchema = exports.packClarifySessionSchema = exports.packClarifySummarySchema = exports.packClarifyQuestionSchema = exports.packClarifyOptionSchema = void 0;
const zod_1 = require("zod");
exports.packClarifyOptionSchema = zod_1.z.object({
    key: zod_1.z.enum(['A', 'B', 'C']),
    label: zod_1.z.string().min(1).max(120),
});
exports.packClarifyQuestionSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64),
    topic: zod_1.z.string().min(1).max(80),
    ask: zod_1.z.string().min(1).max(400),
    options: zod_1.z.array(exports.packClarifyOptionSchema).min(2).max(3),
    allow_free_text: zod_1.z.boolean().default(true),
    allow_polish: zod_1.z.boolean().default(true),
    /** 可选：建议写回位置，如 npcs[npc_hilvi].system_prompt_template */
    target_hint: zod_1.z.string().max(200).optional(),
});
exports.packClarifySummarySchema = zod_1.z.object({
    world_one_liner: zod_1.z.string().min(1).max(200),
    chapters: zod_1.z.array(zod_1.z.string().max(120)).max(12).default([]),
    npcs: zod_1.z.array(zod_1.z.string().max(120)).max(12).default([]),
    risks: zod_1.z.array(zod_1.z.string().max(200)).max(8).default([]),
});
exports.packClarifySessionSchema = zod_1.z.object({
    summary: exports.packClarifySummarySchema,
    questions: zod_1.z.array(exports.packClarifyQuestionSchema).max(5),
    done: zod_1.z.boolean().default(false),
    source: zod_1.z.enum(['llm', 'mock']).default('mock'),
});
exports.packClarifyStartPayloadSchema = zod_1.z.object({
    pack: zod_1.z.unknown(),
    prompt: zod_1.z.string().max(8000).optional(),
    outline: zod_1.z.string().max(50000).optional(),
});
exports.packClarifyAnswerSchema = zod_1.z.object({
    question_id: zod_1.z.string().min(1),
    choice: zod_1.z.enum(['A', 'B', 'C']).optional(),
    free_text: zod_1.z.string().max(800).optional(),
});
exports.packClarifyApplyPayloadSchema = zod_1.z.object({
    pack: zod_1.z.unknown(),
    questions: zod_1.z.array(exports.packClarifyQuestionSchema).max(5),
    answers: zod_1.z.array(exports.packClarifyAnswerSchema).max(5),
    skip_remaining: zod_1.z.boolean().optional(),
});
exports.packClarifyApplyResultSchema = zod_1.z.object({
    pack: zod_1.z.unknown(),
    patch_notes: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.packClarifyPolishPayloadSchema = zod_1.z.object({
    question_id: zod_1.z.string().min(1),
    topic: zod_1.z.string().max(80).optional(),
    ask: zod_1.z.string().max(400).optional(),
    draft_text: zod_1.z.string().trim().min(1).max(800),
    target_hint: zod_1.z.string().max(200).optional(),
});
exports.packClarifyPolishResultSchema = zod_1.z.object({
    type: zod_1.z.literal('polish'),
    question_id: zod_1.z.string(),
    polished_text: zod_1.z.string().min(1).max(800),
    target_hint: zod_1.z.string().max(200).optional(),
});
