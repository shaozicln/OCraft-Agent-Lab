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
export type UpdateAffinityArgs = z.infer<typeof updateAffinitySchema>;
export type UpdateFatigueArgs = z.infer<typeof updateFatigueSchema>;
export type QueryRuntimeArgs = z.infer<typeof queryRuntimeSchema>;
export type RequestHintArgs = z.infer<typeof requestHintSchema>;
/** 软数值 tool（可方差） */
export declare const SOFT_NPC_TOOLS: readonly ["updateFatigue", "updateAffinity"];
/** 强业务 tool（严 schema、只读优先） */
export declare const STRONG_NPC_TOOLS: readonly ["query_runtime", "request_hint"];
export declare const ALLOWED_NPC_TOOLS: readonly ["updateFatigue", "updateAffinity", "query_runtime", "request_hint"];
export type AllowedNpcTool = (typeof ALLOWED_NPC_TOOLS)[number];
export declare function isAllowedNpcTool(name: string): name is AllowedNpcTool;
