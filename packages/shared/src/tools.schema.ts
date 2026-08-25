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

/** Mem-T：只读按 query 再取一层 Pack 长期记忆（章门控由检索侧保证） */
export const recallMemorySchema = z.object({
  query: z.string().trim().min(1).max(120),
  top_k: z.number().int().min(1).max(5).optional(),
  reason: z.string().max(120).optional(),
});

/**
 * 场景跟随：
 * - companion：跟着玩家走，直到 stop_follow
 * - to_npc：跟到靠近目标 NPC 后自动停
 */
export const followPlayerSchema = z
  .object({
    mode: z.enum(['companion', 'to_npc']),
    target_npc_id: z.string().trim().min(1).max(64).optional(),
    reason: z.string().max(120).optional(),
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

export const stopFollowSchema = z.object({
  reason: z.string().max(120).optional(),
});

export type UpdateAffinityArgs = z.infer<typeof updateAffinitySchema>;
export type UpdateFatigueArgs = z.infer<typeof updateFatigueSchema>;
export type QueryRuntimeArgs = z.infer<typeof queryRuntimeSchema>;
export type RequestHintArgs = z.infer<typeof requestHintSchema>;
export type RecallMemoryArgs = z.infer<typeof recallMemorySchema>;
export type FollowPlayerArgs = z.infer<typeof followPlayerSchema>;
export type StopFollowArgs = z.infer<typeof stopFollowSchema>;

/** 软数值 / 场景行动 tool（可方差） */
export const SOFT_NPC_TOOLS = [
  'updateFatigue',
  'updateAffinity',
  'follow_player',
  'stop_follow',
] as const;

/** 强业务 tool（严 schema、只读优先） */
export const STRONG_NPC_TOOLS = [
  'query_runtime',
  'request_hint',
  'recall_memory',
] as const;

export const ALLOWED_NPC_TOOLS = [
  ...SOFT_NPC_TOOLS,
  ...STRONG_NPC_TOOLS,
] as const;

export type AllowedNpcTool = (typeof ALLOWED_NPC_TOOLS)[number];

export function isAllowedNpcTool(name: string): name is AllowedNpcTool {
  return (ALLOWED_NPC_TOOLS as readonly string[]).includes(name);
}
