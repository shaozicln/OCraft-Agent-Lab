import { z } from 'zod';

/** 单轮输入：玩家句 + 可选 MOCK NPC 回复（用于 reply_flag / 护栏断言） */
export const evalTurnSchema = z.object({
  player_message: z.string().min(1),
  mock_npc_reply: z.string().optional(),
});

export const evalSetupSchema = z.object({
  chapter: z.string().min(1),
  flags: z.record(z.string(), z.string()).default({}),
  npc_id: z.string().min(1),
  affinity: z.number().default(50),
  fatigue: z.number().default(30),
  current_status: z.string().default('idle'),
});

/**
 * 用例结束时的硬断言（规则向）。
 * 口吻/剧透真模型用例骨架：用 mock_npc_reply_*_slop / forbidden_substrings。
 */
export const evalExpectSchema = z.object({
  chapter: z.string().optional(),
  flags_include: z.record(z.string(), z.string()).optional(),
  flags_exclude: z.array(z.string()).optional(),
  matched_rule_ids_include: z.array(z.string()).optional(),
  /** 最后一轮应命中的互聊事件；与 exchange_null 互斥 */
  exchange_event_id: z.string().optional(),
  /** 最后一轮不应触发互聊 */
  exchange_null: z.boolean().optional(),
  reply_flags_include: z.record(z.string(), z.string()).optional(),
  /** 对最后一轮 mock_npc_reply 跑 looksLikeAiSlop */
  mock_reply_is_slop: z.boolean().optional(),
  mock_reply_not_slop: z.boolean().optional(),
  /** 骨架：真模型阶段可断言回复不含这些子串 */
  forbidden_substrings_in_reply: z.array(z.string()).optional(),
});

export const evalCaseSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  setup: evalSetupSchema,
  turns: z.array(evalTurnSchema).min(1),
  expect: evalExpectSchema,
});

export const evalSuiteSchema = z.object({
  id: z.string().min(1),
  world_id: z.string().min(1),
  pack_version_id: z.string().min(1),
  cases: z.array(evalCaseSchema).min(1),
});

export type EvalTurn = z.infer<typeof evalTurnSchema>;
export type EvalSetup = z.infer<typeof evalSetupSchema>;
export type EvalExpect = z.infer<typeof evalExpectSchema>;
export type EvalCase = z.infer<typeof evalCaseSchema>;
export type EvalSuite = z.infer<typeof evalSuiteSchema>;
