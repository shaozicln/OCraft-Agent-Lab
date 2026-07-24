"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEEL_DEMO_AUTO_GOAL = exports.autoPlayNextProposalSchema = exports.autoPlayStatusSchema = exports.autoPlayGoalSchema = void 0;
const zod_1 = require("zod");
/** 自动演目标（MA-A-B）：只写条件，不写死玩家句 */
exports.autoPlayGoalSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64),
    title: zod_1.z.string().min(1).max(120),
    world_id: zod_1.z.string().min(1).max(64).optional(),
    pack_version_id: zod_1.z.string().min(1).max(128).optional(),
    npc_id: zod_1.z.string().min(1).max(64),
    /** 软目标：到达该章（可选） */
    target_chapter: zod_1.z.string().min(1).max(64).optional(),
    /** 软目标：触发该互聊戏码（可选） */
    target_exchange: zod_1.z.string().min(1).max(64).optional(),
    max_turns: zod_1.z.number().int().min(1).max(16).default(6),
    /** 拍间等待 */
    wait_ms: zod_1.z.number().int().min(0).max(30_000).default(800),
});
exports.autoPlayStatusSchema = zod_1.z.enum([
    'idle',
    'running',
    'paused',
    'done',
    'abort',
]);
exports.autoPlayNextProposalSchema = zod_1.z.object({
    say: zod_1.z.string().trim().min(1).max(500).optional(),
    done: zod_1.z.boolean(),
    reason: zod_1.z.string().max(200).default(''),
    source: zod_1.z.enum(['agent', 'mock']).default('agent'),
});
/**
 * feel 默认目标：导演驱动，推到裂痕并尽量触发首次互聊（无写死玩家句）
 */
exports.FEEL_DEMO_AUTO_GOAL = exports.autoPlayGoalSchema.parse({
    id: 'feel-demo-auto-goal',
    title: '导演驱动自动演 · 裂痕登场',
    world_id: 'awaken',
    pack_version_id: 'awaken-0717feel__20260717T1450',
    npc_id: 'npc_suolunsen',
    target_chapter: 'ch2_unease',
    target_exchange: 'ex_ch2_first_meet',
    max_turns: 6,
    wait_ms: 800,
});
