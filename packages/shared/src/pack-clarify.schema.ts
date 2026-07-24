import { z } from 'zod';

export const packClarifyOptionSchema = z.object({
  key: z.enum(['A', 'B', 'C']),
  label: z.string().min(1).max(120),
});

export const packClarifyQuestionSchema = z.object({
  id: z.string().min(1).max(64),
  topic: z.string().min(1).max(80),
  ask: z.string().min(1).max(400),
  options: z.array(packClarifyOptionSchema).min(2).max(3),
  allow_free_text: z.boolean().default(true),
  allow_polish: z.boolean().default(true),
  /** 可选：建议写回位置，如 npcs[npc_hilvi].system_prompt_template */
  target_hint: z.string().max(200).optional(),
});

export const packClarifySummarySchema = z.object({
  world_one_liner: z.string().min(1).max(200),
  chapters: z.array(z.string().max(120)).max(12).default([]),
  npcs: z.array(z.string().max(120)).max(12).default([]),
  risks: z.array(z.string().max(200)).max(8).default([]),
});

export const packClarifySessionSchema = z.object({
  summary: packClarifySummarySchema,
  questions: z.array(packClarifyQuestionSchema).max(5),
  done: z.boolean().default(false),
  source: z.enum(['llm', 'mock']).default('mock'),
});
export type PackClarifySession = z.infer<typeof packClarifySessionSchema>;
export type PackClarifyQuestion = z.infer<typeof packClarifyQuestionSchema>;

export const packClarifyStartPayloadSchema = z.object({
  pack: z.unknown(),
  prompt: z.string().max(8000).optional(),
  outline: z.string().max(50000).optional(),
});
export type PackClarifyStartPayload = z.infer<
  typeof packClarifyStartPayloadSchema
>;

export const packClarifyAnswerSchema = z.object({
  question_id: z.string().min(1),
  choice: z.enum(['A', 'B', 'C']).optional(),
  free_text: z.string().max(800).optional(),
});
export type PackClarifyAnswer = z.infer<typeof packClarifyAnswerSchema>;

export const packClarifyApplyPayloadSchema = z.object({
  pack: z.unknown(),
  questions: z.array(packClarifyQuestionSchema).max(5),
  answers: z.array(packClarifyAnswerSchema).max(5),
  skip_remaining: z.boolean().optional(),
});
export type PackClarifyApplyPayload = z.infer<
  typeof packClarifyApplyPayloadSchema
>;

export const packClarifyApplyResultSchema = z.object({
  pack: z.unknown(),
  patch_notes: z.array(z.string()).default([]),
});

export const packClarifyPolishPayloadSchema = z.object({
  question_id: z.string().min(1),
  topic: z.string().max(80).optional(),
  ask: z.string().max(400).optional(),
  draft_text: z.string().trim().min(1).max(800),
  target_hint: z.string().max(200).optional(),
});
export type PackClarifyPolishPayload = z.infer<
  typeof packClarifyPolishPayloadSchema
>;

export const packClarifyPolishResultSchema = z.object({
  type: z.literal('polish'),
  question_id: z.string(),
  polished_text: z.string().min(1).max(800),
  target_hint: z.string().max(200).optional(),
});
export type PackClarifyPolishResult = z.infer<
  typeof packClarifyPolishResultSchema
>;
