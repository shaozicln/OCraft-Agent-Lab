"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.archiveRenamedEventSchema = exports.newRunStartedEventSchema = exports.storyMapEventSchema = exports.storyMapEdgeSchema = exports.requestStoryMapPayloadSchema = exports.renameArchivePayloadSchema = exports.startNewRunPayloadSchema = exports.conversationLoadedEventSchema = exports.conversationArchivesListEventSchema = exports.conversationSavedEventSchema = exports.conversationArchiveSummarySchema = exports.conversationSnapshotSummarySchema = exports.archivedMessageSchema = exports.archivedNpcStateSchema = exports.loadConversationArchivePayloadSchema = exports.listConversationArchivesPayloadSchema = exports.saveConversationPayloadSchema = exports.npcExchangeEventSchema = exports.npcExchangeLineSchema = exports.npcErrorEventSchema = exports.npcStateUpdateSchema = exports.toolCallResultSchema = exports.npcStreamEventSchema = exports.chatSuggestionsEventSchema = exports.requestChatSuggestionsPayloadSchema = exports.requestNpcStatePayloadSchema = exports.playerChatPayloadSchema = exports.playerIdSchema = exports.chapterStateSchema = void 0;
const zod_1 = require("zod");
const story_schema_1 = require("./story.schema");
/**
 * 章节 ID：由当前 Story Pack 声明（不再写死业务枚举）。
 */
exports.chapterStateSchema = zod_1.z.string().min(1).max(64);
/** 玩家 UID：三位数字字符串，如 001（注册时顺序分配） */
exports.playerIdSchema = zod_1.z
    .string()
    .regex(/^\d{3}$/, '玩家 UID 须为三位数字');
exports.playerChatPayloadSchema = zod_1.z.object({
    npcId: zod_1.z.string().min(1).max(64),
    message: zod_1.z.string().trim().min(1).max(500),
});
exports.requestNpcStatePayloadSchema = zod_1.z.object({
    npcId: zod_1.z.string().min(1).max(64),
});
/** 按需请求：当前剧情下玩家可选回复建议（点击填入，不自动发送） */
exports.requestChatSuggestionsPayloadSchema = zod_1.z.object({
    npcId: zod_1.z.string().min(1).max(64),
});
exports.chatSuggestionsEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    suggestions: zod_1.z.array(zod_1.z.string().trim().min(1).max(200)).max(6),
    error: zod_1.z.string().optional(),
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
    /** 当前会话 story flags（多 NPC 出场判定用） */
    story_flags: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    toolCalls: zod_1.z.array(exports.toolCallResultSchema).optional(),
});
exports.npcErrorEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    message: zod_1.z.string(),
});
/** 关系事件互聊（旁听）：主对话结束后一次推送整段 */
exports.npcExchangeLineSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    name: zod_1.z.string(),
    text: zod_1.z.string(),
});
exports.npcExchangeEventSchema = zod_1.z.object({
    eventId: zod_1.z.string(),
    /** 触发时玩家正在对话的 NPC（便于前端挂到当前聊天窗） */
    chatNpcId: zod_1.z.string(),
    lines: zod_1.z.array(exports.npcExchangeLineSchema).min(1),
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
    /** 自定义显示名；缺省时前端用 filename */
    display_name: zod_1.z.string().optional(),
    session_started_at: zod_1.z.string(),
    snapshots: zod_1.z.array(exports.conversationSnapshotSummarySchema),
});
exports.conversationSavedEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    filename: zod_1.z.string(),
    snapshotIndex: zod_1.z.number().int(),
    savedAt: zod_1.z.string(),
    /** 存档时章节 id */
    chapter_state: exports.chapterStateSchema.optional(),
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
/** 新开一局 / 从某章或某分歧回溯为新存档槽 */
exports.startNewRunPayloadSchema = zod_1.z.object({
    npcId: zod_1.z.string().min(1).max(64),
    /** 起始章节；省略则用 Pack rank 最小章 */
    chapterId: exports.chapterStateSchema.optional(),
    /** 自定义槽位名 */
    displayName: zod_1.z.string().trim().min(1).max(64).optional(),
    /**
     * 沿触发规则进入：用规则的 to_chapter（若有）与 set_flags；
     * 与 chapterId 同时给时以规则目标章为准
     */
    viaRuleId: zod_1.z.string().min(1).max(64).optional(),
});
exports.renameArchivePayloadSchema = zod_1.z.object({
    npcId: zod_1.z.string().min(1).max(64),
    filename: zod_1.z.string().min(1).max(128),
    displayName: zod_1.z.string().trim().min(1).max(64),
});
exports.requestStoryMapPayloadSchema = zod_1.z.object({
    npcId: zod_1.z.string().min(1).max(64),
});
exports.storyMapEdgeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    from: zod_1.z.string(),
    to: zod_1.z.string().nullable(),
    label: zod_1.z.string(),
    set_flag_names: zod_1.z.array(zod_1.z.string()),
});
exports.storyMapEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    current_chapter: exports.chapterStateSchema,
    flags: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
    chapters: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        display_name: zod_1.z.string(),
        rank: zod_1.z.number(),
    })),
    edges: zod_1.z.array(exports.storyMapEdgeSchema),
});
exports.newRunStartedEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    filename: zod_1.z.string(),
    display_name: zod_1.z.string().optional(),
    chapter_state: exports.chapterStateSchema,
    story_flags: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
});
exports.archiveRenamedEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    filename: zod_1.z.string(),
    display_name: zod_1.z.string(),
});
