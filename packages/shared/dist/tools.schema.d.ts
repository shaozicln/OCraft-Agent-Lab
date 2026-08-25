import { z } from 'zod';
export declare const updateAffinitySchema: z.ZodObject<{
    delta: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateFatigueSchema: z.ZodObject<{
    delta: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** 强指令：只读查询当前运行时（章 / 数值 / flags） */
export declare const queryRuntimeSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** 强指令：要一条受当前章约束的提示（不剧透未解锁内容） */
export declare const requestHintSchema: z.ZodObject<{
    topic: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Mem-T：只读按 query 再取一层 Pack 长期记忆（章门控由检索侧保证） */
export declare const recallMemorySchema: z.ZodObject<{
    query: z.ZodString;
    top_k: z.ZodOptional<z.ZodNumber>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * 场景跟随：
 * - companion：跟着玩家走，直到 stop_follow
 * - to_npc：跟到靠近目标 NPC 后自动停
 */
export declare const followPlayerSchema: z.ZodObject<{
    mode: z.ZodEnum<{
        companion: "companion";
        to_npc: "to_npc";
    }>;
    target_npc_id: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const stopFollowSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type UpdateAffinityArgs = z.infer<typeof updateAffinitySchema>;
export type UpdateFatigueArgs = z.infer<typeof updateFatigueSchema>;
export type QueryRuntimeArgs = z.infer<typeof queryRuntimeSchema>;
export type RequestHintArgs = z.infer<typeof requestHintSchema>;
export type RecallMemoryArgs = z.infer<typeof recallMemorySchema>;
export type FollowPlayerArgs = z.infer<typeof followPlayerSchema>;
export type StopFollowArgs = z.infer<typeof stopFollowSchema>;
/** 软数值 / 场景行动 tool（可方差） */
export declare const SOFT_NPC_TOOLS: readonly ["updateFatigue", "updateAffinity", "follow_player", "stop_follow"];
/** 强业务 tool（严 schema、只读优先） */
export declare const STRONG_NPC_TOOLS: readonly ["query_runtime", "request_hint", "recall_memory"];
export declare const ALLOWED_NPC_TOOLS: readonly ["updateFatigue", "updateAffinity", "follow_player", "stop_follow", "query_runtime", "request_hint", "recall_memory"];
export type AllowedNpcTool = (typeof ALLOWED_NPC_TOOLS)[number];
export declare function isAllowedNpcTool(name: string): name is AllowedNpcTool;
