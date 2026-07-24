import { z } from 'zod';

/** 自动演目标（MA-A-B）：只写条件，不写死玩家句 */
export const autoPlayGoalSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  world_id: z.string().min(1).max(64).optional(),
  pack_version_id: z.string().min(1).max(128).optional(),
  npc_id: z.string().min(1).max(64),
  /** 软目标：到达该章（可选） */
  target_chapter: z.string().min(1).max(64).optional(),
  /** 软目标：触发该互聊戏码（可选） */
  target_exchange: z.string().min(1).max(64).optional(),
  max_turns: z.number().int().min(1).max(16).default(6),
  /** 拍间等待 */
  wait_ms: z.number().int().min(0).max(30_000).default(800),
});
export type AutoPlayGoal = z.infer<typeof autoPlayGoalSchema>;

export const autoPlayStatusSchema = z.enum([
  'idle',
  'running',
  'paused',
  'done',
  'abort',
]);
export type AutoPlayStatus = z.infer<typeof autoPlayStatusSchema>;

export const autoPlayNextProposalSchema = z.object({
  say: z.string().trim().min(1).max(500).optional(),
  done: z.boolean(),
  reason: z.string().max(200).default(''),
  source: z.enum(['agent', 'mock']).default('agent'),
});
export type AutoPlayNextProposal = z.infer<typeof autoPlayNextProposalSchema>;

/**
 * feel 默认目标：导演驱动，推到裂痕并尽量触发首次互聊（无写死玩家句）
 */
export const FEEL_DEMO_AUTO_GOAL: AutoPlayGoal = autoPlayGoalSchema.parse({
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
