"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationLoadedEventSchema = exports.conversationArchivesListEventSchema = exports.conversationSavedEventSchema = exports.conversationArchiveSummarySchema = exports.conversationSnapshotSummarySchema = exports.archivedMessageSchema = exports.archivedNpcStateSchema = exports.loadConversationArchivePayloadSchema = exports.listConversationArchivesPayloadSchema = exports.saveConversationPayloadSchema = exports.npcErrorEventSchema = exports.npcStateUpdateSchema = exports.toolCallResultSchema = exports.npcStreamEventSchema = exports.requestNpcStatePayloadSchema = exports.playerChatPayloadSchema = exports.playerIdSchema = exports.DEFAULT_CHAPTER_STATE = exports.chapterStateSchema = void 0;
const zod_1 = require("zod");
const story_schema_1 = require("./story.schema");
/**
 * 章节 ID：由当前 Story Pack 声明（不再写死业务枚举）。
 * 官方 office 包仍使用 daily / uneasy / dream_reveal。
 */
exports.chapterStateSchema = zod_1.z.string().min(1).max(64);
/** 无 Pack 时的回退默认；有 Pack 时应用 getDefaultChapterId(pack) */
exports.DEFAULT_CHAPTER_STATE = 'daily';
exports.playerIdSchema = zod_1.z.string().uuid();
exports.playerChatPayloadSchema = zod_1.z.object({
    npcId: zod_1.z.string().min(1).max(64),
    message: zod_1.z.string().trim().min(1).max(500),
});
exports.requestNpcStatePayloadSchema = zod_1.z.object({
    npcId: zod_1.z.string().min(1).max(64),
});
exports.npcStreamEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    chunk: zod_1.z.string(),
    done: zod_1.z.boolean().optional(),
});
exports.toolCallResultSchema = zod_1.z.object({
    tool: zod_1.z.string(),
    args: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    observation: zod_1.z.string(),
});
exports.npcStateUpdateSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    name: zod_1.z.string().optional(),
    affinity: zod_1.z.number(),
    fatigue: zod_1.z.number(),
    maxFatigue: zod_1.z.number().optional(),
    animation: zod_1.z.string().optional(),
    current_status: zod_1.z.string().optional(),
    chapter_state: exports.chapterStateSchema.optional(),
    toolCalls: zod_1.z.array(exports.toolCallResultSchema).optional(),
});
exports.npcErrorEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    message: zod_1.z.string(),
});
exports.saveConversationPayloadSchema = zod_1.z.object({
    npcId: zod_1.z.string().min(1).max(64),
});
exports.listConversationArchivesPayloadSchema = zod_1.z.object({
    npcId: zod_1.z.string().min(1).max(64),
});
exports.loadConversationArchivePayloadSchema = zod_1.z.object({
    npcId: zod_1.z.string().min(1).max(64),
    filename: zod_1.z.string().min(1).max(128),
    snapshotIndex: zod_1.z.number().int().min(0),
});
exports.archivedNpcStateSchema = zod_1.z.object({
    affinity: zod_1.z.number(),
    fatigue: zod_1.z.number(),
    current_status: zod_1.z.string(),
    chapter_state: exports.chapterStateSchema,
    /** 存档时的 story flags 快照（读档整表恢复；旧档缺省为空） */
    story_flags: story_schema_1.storyFlagsSnapshotSchema.default({}),
});
exports.archivedMessageSchema = zod_1.z.object({
    role: zod_1.z.enum(['user', 'assistant']),
    content: zod_1.z.string(),
    at: zod_1.z.string(),
});
exports.conversationSnapshotSummarySchema = zod_1.z.object({
    index: zod_1.z.number().int(),
    saved_at: zod_1.z.string(),
    message_count: zod_1.z.number().int(),
    npc_state: exports.archivedNpcStateSchema,
});
exports.conversationArchiveSummarySchema = zod_1.z.object({
    filename: zod_1.z.string(),
    session_started_at: zod_1.z.string(),
    snapshots: zod_1.z.array(exports.conversationSnapshotSummarySchema),
});
exports.conversationSavedEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    filename: zod_1.z.string(),
    snapshotIndex: zod_1.z.number().int(),
    savedAt: zod_1.z.string(),
});
exports.conversationArchivesListEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    archives: zod_1.z.array(exports.conversationArchiveSummarySchema),
});
exports.conversationLoadedEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    filename: zod_1.z.string(),
    snapshotIndex: zod_1.z.number().int(),
    messages: zod_1.z.array(exports.archivedMessageSchema),
    npc_state: exports.archivedNpcStateSchema,
});
