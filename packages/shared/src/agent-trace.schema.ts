import { z } from 'zod';
import { toolCallResultSchema } from './ws.schema';

export const agentTraceRagHitSchema = z.object({
  memory_id: z.string(),
  score: z.number(),
  /** Mem-V：命中来自向量或关键词回退 */
  source: z.enum(['vector', 'keyword']).optional(),
});

export const agentTraceRagPathSchema = z.enum(['vector', 'keyword_fallback']);
export type AgentTraceRagPath = z.infer<typeof agentTraceRagPathSchema>;

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
  'lab_peer',
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
  /** MA-H：导演 prompt 可见的戏码 id（无触发/台词） */
  available_events: z.array(z.string()).optional(),
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
  /** Mem-V：本轮检索路径 */
  rag_path: agentTraceRagPathSchema.optional(),
  rag_embed_backend: z.enum(['api', 'local']).optional(),
  rag_error: z.string().optional(),
  /** Mem-W：本轮注入的公开场近期句（不含悄悄话） */
  working_memory_lines: z.array(z.string()).optional(),
  /** Mem-P：本轮新抽取的玩家要点 id */
  player_notes_added: z.array(z.string()).optional(),
  /** Mem-P：本轮注入 prompt 的要点 id */
  player_notes_injected: z.array(z.string()).optional(),
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
  /** MA-W：悄悄话来源（按钮 / 措辞自动） */
  whisper_source: z.enum(['client', 'auto']).optional(),
  /** 自动演：本轮是否代发玩家句（MA-A-B 为 Agent/MOCK 生成） */
  auto_play: z.boolean().optional(),
  /** MA-Lab：平级多 Agent 标记与本轮进度 */
  lab: z
    .object({
      peer_agents: z.literal(true),
      stop_reason: z.string().optional(),
      session_peer_lines: z.number().int().optional(),
      round_peer_lines: z.number().int().optional(),
    })
    .optional(),
  /** G：本轮命中的结局结算 */
  ending: z
    .object({
      ending_id: z.string(),
      display_name: z.string(),
      flags_set: z.array(
        z.object({ name: z.string(), value: z.string() }),
      ),
      flags_cleared: z.array(z.string()).default([]),
    })
    .optional(),
  /** F：主回复安全扫描 */
  safety: z
    .object({
      ok: z.boolean(),
      rewritten: z.boolean().optional(),
      reasons: z
        .array(
          z.object({
            code: z.string(),
            detail: z.string(),
          }),
        )
        .default([]),
    })
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
