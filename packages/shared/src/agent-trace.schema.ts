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
});

export type AgentTraceRecord = z.infer<typeof agentTraceRecordSchema>;
export type AgentTraceTransition = z.infer<typeof agentTraceTransitionSchema>;

export const agentTraceListResponseSchema = z.object({
  traces: z.array(agentTraceRecordSchema),
});
export type AgentTraceListResponse = z.infer<
  typeof agentTraceListResponseSchema
>;
