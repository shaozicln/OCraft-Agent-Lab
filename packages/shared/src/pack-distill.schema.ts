import { z } from 'zod';
import { packIdSchema } from './pack.schema';

/** 软情境→反应（只进人设 prompt，不写硬 triggers） */
export const distillTriggerReactionSchema = z.object({
  situation: z.string().trim().min(1).max(120),
  reaction: z.string().trim().min(1).max(200),
});

/**
 * 人设蒸馏卡（Character Distillation）。
 * 用户确认后才 apply 进 Pack.npcs[]。
 */
export const distillCardSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** 建议 npc_id；可空，apply 时再生成 */
  npc_id: packIdSchema.optional(),
  core_traits: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  speech_patterns: z
    .array(z.string().trim().min(1).max(200))
    .max(8)
    .default([]),
  typical_phrases: z
    .array(z.string().trim().min(1).max(200))
    .max(12)
    .default([]),
  trigger_reactions: z.array(distillTriggerReactionSchema).max(12).default([]),
  forbidden_behaviors: z
    .array(z.string().trim().min(1).max(200))
    .max(12)
    .default([]),
  /** 溯源短注，如「蒸馏自短描述」 */
  source_note: z.string().trim().max(200).optional(),
});
export type DistillCard = z.infer<typeof distillCardSchema>;
export type DistillTriggerReaction = z.infer<
  typeof distillTriggerReactionSchema
>;

export const distillBriefPayloadSchema = z.object({
  brief: z.string().trim().min(1).max(2000),
  /** 可选：参考当前 Pack（章 id 等），不写回 */
  pack: z.unknown().optional(),
  /** 更新已有 NPC 时传入，便于 mock/LLM 对齐 id */
  target_npc_id: packIdSchema.optional(),
});
export type DistillBriefPayload = z.infer<typeof distillBriefPayloadSchema>;

export const distillBriefResultSchema = z.object({
  card: distillCardSchema,
  source: z.enum(['llm', 'mock']),
});
export type DistillBriefResult = z.infer<typeof distillBriefResultSchema>;

export const distillNormalizePayloadSchema = z.object({
  /** 粘贴的 JSON 或简易 YAML 文本，或已是对象 */
  raw: z.union([z.string().min(1).max(20000), z.record(z.string(), z.unknown())]),
});
export type DistillNormalizePayload = z.infer<
  typeof distillNormalizePayloadSchema
>;

export const distillNormalizeResultSchema = z.object({
  card: distillCardSchema,
  warnings: z.array(z.string()).default([]),
});
export type DistillNormalizeResult = z.infer<
  typeof distillNormalizeResultSchema
>;

export const distillApplyModeSchema = z.enum(['create', 'update']);

export const distillApplyPayloadSchema = z.object({
  pack: z.unknown(),
  card: distillCardSchema,
  mode: distillApplyModeSchema.default('create'),
  /** update 时必填；create 时若与现有冲突需 overwrite 或换 id */
  target_npc_id: packIdSchema.optional(),
  /** create 且 id 已存在时：true=覆盖该 NPC，false=报错 */
  overwrite: z.boolean().optional(),
});
export type DistillApplyPayload = z.infer<typeof distillApplyPayloadSchema>;

export const distillApplyResultSchema = z.object({
  pack: z.unknown(),
  patch_notes: z.array(z.string()).default([]),
  applied_npc_id: packIdSchema,
  applied: z.boolean(),
  applied_summary: z.string(),
});
export type DistillApplyResult = z.infer<typeof distillApplyResultSchema>;
