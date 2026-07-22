import { z } from 'zod';
import { storyFlagsSnapshotSchema } from './story.schema';

/**
 * 章节 ID：由当前 Story Pack 声明（不再写死业务枚举）。
 */
export const chapterStateSchema = z.string().min(1).max(64);
export type ChapterState = z.infer<typeof chapterStateSchema>;

/** 玩家 UID：三位数字字符串，如 001（注册时顺序分配） */
export const playerIdSchema = z
  .string()
  .regex(/^\d{3}$/, '玩家 UID 须为三位数字');

export const playerChatPayloadSchema = z.object({
  npcId: z.string().min(1).max(64),
  message: z.string().trim().min(1).max(500),
  /** 客户端上报的附近 NPC（同场短接话用）；可空 */
  nearbyNpcIds: z.array(z.string().min(1).max(64)).max(16).optional(),
});

export const requestNpcStatePayloadSchema = z.object({
  npcId: z.string().min(1).max(64),
});

/** 按需请求：当前剧情下玩家可选回复建议（点击填入，不自动发送） */
export const requestChatSuggestionsPayloadSchema = z.object({
  npcId: z.string().min(1).max(64),
});

export const chatSuggestionsEventSchema = z.object({
  npcId: z.string(),
  suggestions: z.array(z.string().trim().min(1).max(200)).max(6),
  error: z.string().optional(),
});

export const npcStreamEventSchema = z.object({
  npcId: z.string(),
  chunk: z.string(),
  done: z.boolean().optional(),
});

export const toolCallResultSchema = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.unknown()),
  observation: z.string(),
});

export const npcStateUpdateSchema = z.object({
  npcId: z.string(),
  name: z.string().optional(),
  affinity: z.number(),
  fatigue: z.number(),
  maxFatigue: z.number().optional(),
  animation: z.string().optional(),
  current_status: z.string().optional(),
  chapter_state: chapterStateSchema.optional(),
  /** 当前会话 story flags（多 NPC 出场判定用） */
  story_flags: z.record(z.string(), z.string()).optional(),
  toolCalls: z.array(toolCallResultSchema).optional(),
});

export const npcErrorEventSchema = z.object({
  npcId: z.string(),
  message: z.string(),
});

/** 关系事件互聊（旁听）：主对话结束后一次推送整段 */
export const npcExchangeLineSchema = z.object({
  npcId: z.string(),
  name: z.string(),
  text: z.string(),
});

export const npcExchangeEventSchema = z.object({
  eventId: z.string(),
  /** 触发时玩家正在对话的 NPC（便于前端挂到当前聊天窗） */
  chatNpcId: z.string(),
  lines: z.array(npcExchangeLineSchema).min(1),
});

/** 同场短接话：附近另一人插一句（非完整 exchange） */
export const npcAsideEventSchema = z.object({
  chatNpcId: z.string(),
  npcId: z.string(),
  name: z.string(),
  text: z.string(),
});

export const saveConversationPayloadSchema = z.object({
  npcId: z.string().min(1).max(64),
});

export const listConversationArchivesPayloadSchema = z.object({
  npcId: z.string().min(1).max(64),
});

export const loadConversationArchivePayloadSchema = z.object({
  npcId: z.string().min(1).max(64),
  filename: z.string().min(1).max(128),
  snapshotIndex: z.number().int().min(0),
});

export const archivedNpcStateSchema = z.object({
  affinity: z.number(),
  fatigue: z.number(),
  current_status: z.string(),
  chapter_state: chapterStateSchema,
  /** 存档时的 story flags 快照（读档整表恢复；旧档缺省为空） */
  story_flags: storyFlagsSnapshotSchema.default({}),
});

export const archivedMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  at: z.string(),
});

/** 存档作用域：run=一局世界；npc=旧版单人会话 */
export const archiveScopeSchema = z.enum(['run', 'npc']);
export type ArchiveScope = z.infer<typeof archiveScopeSchema>;

/** 一局档里单个 NPC 的子快照 */
export const archivedNpcSlotSchema = z.object({
  affinity: z.number(),
  fatigue: z.number(),
  current_status: z.string(),
  story_flags: storyFlagsSnapshotSchema.default({}),
  messages: z.array(archivedMessageSchema).default([]),
});
export type ArchivedNpcSlot = z.infer<typeof archivedNpcSlotSchema>;

/** 整场公共对话流中的一条发言（run 级） */
export const sceneUtteranceKindSchema = z.enum([
  'player_to_npc',
  'npc_to_player',
  'npc_to_npc',
  'system',
]);
export type SceneUtteranceKind = z.infer<typeof sceneUtteranceKindSchema>;

export const sceneUtteranceSchema = z.object({
  id: z.string().min(1),
  at: z.string(),
  kind: sceneUtteranceKindSchema,
  speaker_id: z.string().min(1),
  speaker_name: z.string(),
  addressee_id: z.string().optional(),
  addressee_name: z.string().optional(),
  text: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type SceneUtterance = z.infer<typeof sceneUtteranceSchema>;

/** 玩家在 scene_log 中的稳定 id / 默认显示名 */
export const SCENE_PLAYER_ID = 'player' as const;
export const SCENE_PLAYER_DISPLAY_NAME = '沈檐' as const;

/**
 * 存档快照 v2（一局一档）
 * 仍在 DB 的 npc_state/messages 列写入「焦点 NPC」镜像，便于旧列表预览；
 * 完整数据在 payload / 或解析时从本结构还原。
 */
export const conversationSnapshotV2Schema = z.object({
  schema_version: z.literal(2),
  saved_at: z.string(),
  focus_npc_id: z.string().min(1),
  world: z.object({
    chapter_state: chapterStateSchema,
    story_flags: storyFlagsSnapshotSchema.default({}),
  }),
  /** 焦点镜像（兼容旧列表/旧客户端） */
  npc_state: archivedNpcStateSchema,
  messages: z.array(archivedMessageSchema),
  npcs: z.record(z.string(), archivedNpcSlotSchema),
});
export type ConversationSnapshotV2 = z.infer<typeof conversationSnapshotV2Schema>;

/**
 * 存档快照 v3 = v2 + run 级 scene_log（整场对白时间线）
 */
export const conversationSnapshotV3Schema = z.object({
  schema_version: z.literal(3),
  saved_at: z.string(),
  focus_npc_id: z.string().min(1),
  world: z.object({
    chapter_state: chapterStateSchema,
    story_flags: storyFlagsSnapshotSchema.default({}),
  }),
  npc_state: archivedNpcStateSchema,
  messages: z.array(archivedMessageSchema),
  npcs: z.record(z.string(), archivedNpcSlotSchema),
  scene_log: z.array(sceneUtteranceSchema).default([]),
});
export type ConversationSnapshotV3 = z.infer<typeof conversationSnapshotV3Schema>;
/** 当前写入版本别名 */
export type ConversationSnapshotPayload = ConversationSnapshotV3;

export const conversationSnapshotSummarySchema = z.object({
  index: z.number().int(),
  saved_at: z.string(),
  message_count: z.number().int(),
  npc_state: archivedNpcStateSchema,
});

export const conversationArchiveSummarySchema = z.object({
  filename: z.string(),
  /** 自定义显示名；缺省时前端用 filename */
  display_name: z.string().optional(),
  session_started_at: z.string(),
  /** 缺省视为旧版单人档 */
  scope: archiveScopeSchema.optional(),
  snapshots: z.array(conversationSnapshotSummarySchema),
});

export const conversationSavedEventSchema = z.object({
  npcId: z.string(),
  filename: z.string(),
  snapshotIndex: z.number().int(),
  savedAt: z.string(),
  /** 存档时章节 id */
  chapter_state: chapterStateSchema.optional(),
  scope: archiveScopeSchema.optional(),
  /**
   * 本轮是否因章/世界旗变化而写入（前端仅此时插系统提示，避免每轮刷屏）。
   * 缺省视为 true，兼容旧服务端。
   */
  world_changed: z.boolean().optional(),
});

export const conversationArchivesListEventSchema = z.object({
  npcId: z.string(),
  archives: z.array(conversationArchiveSummarySchema),
});

export const conversationLoadedEventSchema = z.object({
  npcId: z.string(),
  filename: z.string(),
  snapshotIndex: z.number().int(),
  messages: z.array(archivedMessageSchema),
  npc_state: archivedNpcStateSchema,
  scope: archiveScopeSchema.optional(),
  /** 一局档：一并恢复的其他 NPC id（便于前端拉状态） */
  restored_npc_ids: z.array(z.string()).optional(),
  /** 整场对白时间线（v3）；缺省时前端回退 messages */
  scene_log: z.array(sceneUtteranceSchema).optional(),
});

/** 新开一局 / 从某章或某分歧回溯为新存档槽 */
export const startNewRunPayloadSchema = z.object({
  npcId: z.string().min(1).max(64),
  /** 起始章节；省略则用 Pack rank 最小章 */
  chapterId: chapterStateSchema.optional(),
  /** 自定义槽位名 */
  displayName: z.string().trim().min(1).max(64).optional(),
  /**
   * 沿触发规则进入：用规则的 to_chapter（若有）与 set_flags；
   * 与 chapterId 同时给时以规则目标章为准
   */
  viaRuleId: z.string().min(1).max(64).optional(),
});

export const renameArchivePayloadSchema = z.object({
  npcId: z.string().min(1).max(64),
  filename: z.string().min(1).max(128),
  displayName: z.string().trim().min(1).max(64),
});

export const requestStoryMapPayloadSchema = z.object({
  npcId: z.string().min(1).max(64),
});

export const storyMapEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string().nullable(),
  label: z.string(),
  set_flag_names: z.array(z.string()),
});

export const storyMapEventSchema = z.object({
  npcId: z.string(),
  current_chapter: chapterStateSchema,
  flags: z.record(z.string(), z.string()),
  chapters: z.array(
    z.object({
      id: z.string(),
      display_name: z.string(),
      rank: z.number(),
    }),
  ),
  edges: z.array(storyMapEdgeSchema),
});

export const newRunStartedEventSchema = z.object({
  npcId: z.string(),
  filename: z.string(),
  display_name: z.string().optional(),
  chapter_state: chapterStateSchema,
  story_flags: z.record(z.string(), z.string()),
});

export const archiveRenamedEventSchema = z.object({
  npcId: z.string(),
  filename: z.string(),
  display_name: z.string(),
});

export type PlayerChatPayload = z.infer<typeof playerChatPayloadSchema>;
export type RequestNpcStatePayload = z.infer<typeof requestNpcStatePayloadSchema>;
export type RequestChatSuggestionsPayload = z.infer<
  typeof requestChatSuggestionsPayloadSchema
>;
export type ChatSuggestionsEvent = z.infer<typeof chatSuggestionsEventSchema>;
export type NpcStreamEvent = z.infer<typeof npcStreamEventSchema>;
export type NpcStateUpdate = z.infer<typeof npcStateUpdateSchema>;
export type ToolCallResult = z.infer<typeof toolCallResultSchema>;
export type SaveConversationPayload = z.infer<typeof saveConversationPayloadSchema>;
export type ListConversationArchivesPayload = z.infer<
  typeof listConversationArchivesPayloadSchema
>;
export type LoadConversationArchivePayload = z.infer<
  typeof loadConversationArchivePayloadSchema
>;
export type StartNewRunPayload = z.infer<typeof startNewRunPayloadSchema>;
export type RenameArchivePayload = z.infer<typeof renameArchivePayloadSchema>;
export type RequestStoryMapPayload = z.infer<typeof requestStoryMapPayloadSchema>;
export type StoryMapEdge = z.infer<typeof storyMapEdgeSchema>;
export type StoryMapEvent = z.infer<typeof storyMapEventSchema>;
export type NewRunStartedEvent = z.infer<typeof newRunStartedEventSchema>;
export type ArchiveRenamedEvent = z.infer<typeof archiveRenamedEventSchema>;
export type ArchivedNpcState = z.infer<typeof archivedNpcStateSchema>;
export type ArchivedMessage = z.infer<typeof archivedMessageSchema>;
export type ConversationSnapshotSummary = z.infer<
  typeof conversationSnapshotSummarySchema
>;
export type ConversationArchiveSummary = z.infer<
  typeof conversationArchiveSummarySchema
>;
export type ConversationSavedEvent = z.infer<typeof conversationSavedEventSchema>;
export type ConversationArchivesListEvent = z.infer<
  typeof conversationArchivesListEventSchema
>;
export type ConversationLoadedEvent = z.infer<typeof conversationLoadedEventSchema>;
export type NpcExchangeLine = z.infer<typeof npcExchangeLineSchema>;
export type NpcExchangeEvent = z.infer<typeof npcExchangeEventSchema>;
export type NpcAsideEvent = z.infer<typeof npcAsideEventSchema>;
