import { z } from 'zod';

export const updateAffinitySchema = z.object({
  delta: z.number().int().min(-100).max(100),
  reason: z.string().optional(),
});

export const updateFatigueSchema = z.object({
  delta: z.number().int().min(-100).max(100),
  reason: z.string().optional(),
});

/** 强指令：只读查询当前运行时（章 / 数值 / flags） */
export const queryRuntimeSchema = z.object({
  reason: z.string().max(120).optional(),
});

/** 强指令：要一条受当前章约束的提示（不剧透未解锁内容） */
export const requestHintSchema = z.object({
  topic: z.string().max(80).optional(),
  reason: z.string().max(120).optional(),
});

export type UpdateAffinityArgs = z.infer<typeof updateAffinitySchema>;
export type UpdateFatigueArgs = z.infer<typeof updateFatigueSchema>;
export type QueryRuntimeArgs = z.infer<typeof queryRuntimeSchema>;
export type RequestHintArgs = z.infer<typeof requestHintSchema>;

/** 软数值 tool（可方差） */
export const SOFT_NPC_TOOLS = ['updateFatigue', 'updateAffinity'] as const;

/** 强业务 tool（严 schema、只读优先） */
export const STRONG_NPC_TOOLS = ['query_runtime', 'request_hint'] as const;

export const ALLOWED_NPC_TOOLS = [
  ...SOFT_NPC_TOOLS,
  ...STRONG_NPC_TOOLS,
] as const;

export type AllowedNpcTool = (typeof ALLOWED_NPC_TOOLS)[number];

export function isAllowedNpcTool(name: string): name is AllowedNpcTool {
  return (ALLOWED_NPC_TOOLS as readonly string[]).includes(name);
}
