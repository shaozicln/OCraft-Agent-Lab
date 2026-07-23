import { z } from 'zod';
import { toolCallResultSchema } from './ws.schema';

export const agentTraceRagHitSchema = z.object({
  memory_id: z.string(),
  score: z.number(),
});

export const agentTraceTransitionSchema = z.object({
  chapter_before: z.string(),
  chapter_after: z.string(),
  flags_set: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    }),
  ),
  matched_rule_ids: z.array(z.string()).default([]),
});

export const agentTraceRuntimeSchema = z.object({
  affinity: z.number(),
  fatigue: z.number(),
  current_status: z.string(),
});

export const directorModeSchema = z.enum([
  'reply_player',
  'reply_then_exchange',
]);
export type DirectorMode = z.infer<typeof directorModeSchema>;

export const directorFallbackReasonSchema = z.enum([
  'parse_error',
  'invalid_cast',
  'llm_error',
  'skipped_whisper',
]);
export type DirectorFallbackReason = z.infer<
  typeof directorFallbackReasonSchema
>;

/** false = 决策成功；字符串 = fallback 原因码 */
export const directorFallbackSchema = z.union([
  z.literal(false),
  directorFallbackReasonSchema,
]);
export type DirectorFallback = z.infer<typeof directorFallbackSchema>;

export const agentTraceDirectorSchema = z.object({
  mode: directorModeSchema.optional(),
  speakers: z.array(z.string()).optional(),
  reason: z.string().optional(),
  fallback: directorFallbackSchema,
});
export type AgentTraceDirector = z.infer<typeof agentTraceDirectorSchema>;

/** 单轮 Agent 决策 Trace（可回放） */
export const agentTraceRecordSchema = z.object({
  id: z.string(),
  at: z.string(),
  player_id: z.string(),
  npc_id: z.string(),
  world_id: z.string(),
  pack_version_id: z.string(),
  player_message: z.string(),
  mock: z.boolean(),
  runtime_before: agentTraceRuntimeSchema,
  runtime_after: agentTraceRuntimeSchema,
  tools: z.array(toolCallResultSchema),
  transition: agentTraceTransitionSchema,
  rag_hits: z.array(agentTraceRagHitSchema),
  animation: z.string().optional(),
  /** NPC 回复后置 flag（异步补记） */
  reply_flags_set: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  /** 本轮结束后触发的关系事件互聊（异步补记） */
  exchange: z
    .object({
      event_id: z.string(),
      lines: z.array(
        z.object({
          npc_id: z.string(),
          name: z.string(),
          text: z.string(),
        }),
      ),
    })
    .optional(),
  /** 导演调度决策（焦点回复前的 mode / speakers） */
  director: agentTraceDirectorSchema.optional(),
});

export type AgentTraceRecord = z.infer<typeof agentTraceRecordSchema>;
export type AgentTraceTransition = z.infer<typeof agentTraceTransitionSchema>;

export const agentTraceListResponseSchema = z.object({
  traces: z.array(agentTraceRecordSchema),
});
export type AgentTraceListResponse = z.infer<
  typeof agentTraceListResponseSchema
>;
