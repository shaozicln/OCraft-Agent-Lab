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
});

export const requestNpcStatePayloadSchema = z.object({
  npcId: z.string().min(1).max(64),
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
  toolCalls: z.array(toolCallResultSchema).optional(),
});

export const npcErrorEventSchema = z.object({
  npcId: z.string(),
  message: z.string(),
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

export const conversationSnapshotSummarySchema = z.object({
  index: z.number().int(),
  saved_at: z.string(),
  message_count: z.number().int(),
  npc_state: archivedNpcStateSchema,
});

export const conversationArchiveSummarySchema = z.object({
  filename: z.string(),
  session_started_at: z.string(),
  snapshots: z.array(conversationSnapshotSummarySchema),
});

export const conversationSavedEventSchema = z.object({
  npcId: z.string(),
  filename: z.string(),
  snapshotIndex: z.number().int(),
  savedAt: z.string(),
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
});

export type PlayerChatPayload = z.infer<typeof playerChatPayloadSchema>;
export type RequestNpcStatePayload = z.infer<typeof requestNpcStatePayloadSchema>;
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
