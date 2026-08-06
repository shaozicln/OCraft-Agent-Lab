"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.archiveRenamedEventSchema = exports.newRunStartedEventSchema = exports.storyMapEventSchema = exports.storyMapEdgeSchema = exports.requestStoryMapPayloadSchema = exports.renameArchivePayloadSchema = exports.startNewRunPayloadSchema = exports.runNpcSelectionEventSchema = exports.setRunNpcSelectionPayloadSchema = exports.conversationLoadedEventSchema = exports.conversationArchivesListEventSchema = exports.conversationSavedEventSchema = exports.conversationArchiveSummarySchema = exports.conversationSnapshotSummarySchema = exports.conversationSnapshotV3Schema = exports.conversationSnapshotV2Schema = exports.SCENE_PLAYER_DISPLAY_NAME = exports.SCENE_PLAYER_ID = exports.sceneUtteranceSchema = exports.sceneUtteranceKindSchema = exports.archivedNpcSlotSchema = exports.archiveScopeSchema = exports.archivedMessageSchema = exports.archivedNpcStateSchema = exports.loadConversationArchivePayloadSchema = exports.listConversationArchivesPayloadSchema = exports.saveConversationPayloadSchema = exports.labProgressEventSchema = exports.labPeerLineEventSchema = exports.endingReachedEventSchema = exports.npcAsideEventSchema = exports.npcExchangeEventSchema = exports.npcExchangeLineSchema = exports.npcErrorEventSchema = exports.npcStateUpdateSchema = exports.toolCallResultSchema = exports.npcStreamEventSchema = exports.autoplayNextEventSchema = exports.autoplayBeatLineEventSchema = exports.requestAutoplayNextPayloadSchema = exports.chatSuggestionsEventSchema = exports.requestChatSuggestionsPayloadSchema = exports.requestNpcStatePayloadSchema = exports.playerChatPayloadSchema = exports.playerIdSchema = exports.chapterStateSchema = void 0;
const zod_1 = require("zod");
const player_note_schema_1 = require("./player-note.schema");
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
    /** 客户端上报的附近 NPC（同场短接话用）；可空 */
    nearbyNpcIds: zod_1.z.array(zod_1.z.string().min(1).max(64)).max(16).optional(),
    /** 悄悄话：仅目标 NPC 听见；跳过 aside/exchange；scene_log 标 meta.whisper */
    whisper: zod_1.z.boolean().optional(),
    /** 自动演代发：scene_log / Trace 标 meta.auto_play */
    autoPlay: zod_1.z.boolean().optional(),
    /** AP-5：杀青态（禁写章 / 禁结局结算） */
    epilogue: zod_1.z.boolean().optional(),
    /** MA-Lab：平级多 Agent（跳过导演 LLM；受限 peer tick；禁写章） */
    labPeerAgents: zod_1.z.boolean().optional(),
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
/** AP-1：请求下一拍导演排场（目标与风格由本局设置传入） */
exports.requestAutoplayNextPayloadSchema = zod_1.z.object({
    npcId: zod_1.z.string().min(1).max(64),
    turnIndex: zod_1.z.number().int().min(0).max(10_000),
    /** 兼容旧字段；语义=章发言软顶 */
    maxTurns: zod_1.z.number().int().min(1).max(10_000).optional(),
    chapterSpeakCap: zod_1.z.number().int().min(1).max(10_000).optional(),
    priorSays: zod_1.z.array(zod_1.z.string().trim().min(1).max(500)).max(200).optional(),
    sawTargetExchange: zod_1.z.boolean().optional(),
    targetChapter: zod_1.z.string().min(1).max(64).optional(),
    targetExchange: zod_1.z.string().min(1).max(64).optional(),
    targetEnding: zod_1.z.string().min(1).max(64).optional(),
    styleId: zod_1.z.string().min(1).max(64).optional(),
    goalTitle: zod_1.z.string().max(120).optional(),
    accelerate: zod_1.z.boolean().optional(),
    /** AP-5：杀青态排场（轻松向；禁冲结局） */
    epilogue: zod_1.z.boolean().optional(),
    epilogueMode: zod_1.z.enum(['a', 'b', 'c']).optional(),
    /** 附近 NPC，供导演 cast */
    nearbyNpcIds: zod_1.z.array(zod_1.z.string().min(1).max(64)).max(32).optional(),
});
exports.autoplayBeatLineEventSchema = zod_1.z.object({
    speaker_kind: zod_1.z.enum(['player', 'npc']),
    speaker_id: zod_1.z.string().min(1).max(64),
    speaker_name: zod_1.z.string().max(64).optional(),
    text: zod_1.z.string().trim().min(1).max(500),
});
exports.autoplayNextEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    say: zod_1.z.string().trim().min(1).max(500).optional(),
    /** AP-1 排场台词；纯 NPC 拍时服务端已落 scene_log */
    lines: zod_1.z.array(exports.autoplayBeatLineEventSchema).max(6).optional(),
    /** true=本拍已在服务端落档（无需再 player_chat） */
    applied: zod_1.z.boolean().optional(),
    done: zod_1.z.boolean(),
    reason: zod_1.z.string().max(200).default(''),
    source: zod_1.z.enum(['agent', 'mock']).default('agent'),
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
/** 同场短接话：附近另一人插一句（非完整 exchange） */
exports.npcAsideEventSchema = zod_1.z.object({
    chatNpcId: zod_1.z.string(),
    npcId: zod_1.z.string(),
    name: zod_1.z.string(),
    text: zod_1.z.string(),
});
/** G：结局结算推送 */
exports.endingReachedEventSchema = zod_1.z.object({
    endingId: zod_1.z.string(),
    displayName: zod_1.z.string(),
    notes: zod_1.z.string().optional(),
    flagsSet: zod_1.z.array(zod_1.z.string()).default([]),
    flagsCleared: zod_1.z.array(zod_1.z.string()).default([]),
});
/** MA-Lab：平级一句 */
exports.labPeerLineEventSchema = zod_1.z.object({
    chatNpcId: zod_1.z.string(),
    npcId: zod_1.z.string(),
    name: zod_1.z.string(),
    text: zod_1.z.string(),
    roundIndex: zod_1.z.number().int().min(0),
});
/** MA-Lab：任务进度监控快照 */
exports.labProgressEventSchema = zod_1.z.object({
    chatNpcId: zod_1.z.string(),
    progress: zod_1.z.object({
        enabled: zod_1.z.boolean(),
        status: zod_1.z.enum(['idle', 'running', 'done', 'abort']),
        sessionPeerLines: zod_1.z.number().int().min(0),
        sessionPeerLineCap: zod_1.z.number().int().min(1),
        roundIndex: zod_1.z.number().int().min(0),
        roundPeerLines: zod_1.z.number().int().min(0),
        roundPeerLineCap: zod_1.z.number().int().min(1),
        candidateCount: zod_1.z.number().int().min(0),
        spokenNpcIds: zod_1.z.array(zod_1.z.string()).default([]),
        stopReason: zod_1.z
            .enum([
            'complete',
            'budget_round',
            'budget_session',
            'no_candidates',
            'whisper',
            'disabled',
        ])
            .optional(),
    }),
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
/** 存档作用域：run=一局世界；npc=旧版单人会话 */
exports.archiveScopeSchema = zod_1.z.enum(['run', 'npc']);
/** 一局档里单个 NPC 的子快照 */
exports.archivedNpcSlotSchema = zod_1.z.object({
    affinity: zod_1.z.number(),
    fatigue: zod_1.z.number(),
    current_status: zod_1.z.string(),
    story_flags: story_schema_1.storyFlagsSnapshotSchema.default({}),
    messages: zod_1.z.array(exports.archivedMessageSchema).default([]),
});
/** 整场公共对话流中的一条发言（run 级） */
exports.sceneUtteranceKindSchema = zod_1.z.enum([
    'player_to_npc',
    'npc_to_player',
    'npc_to_npc',
    'system',
]);
exports.sceneUtteranceSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    at: zod_1.z.string(),
    kind: exports.sceneUtteranceKindSchema,
    speaker_id: zod_1.z.string().min(1),
    speaker_name: zod_1.z.string(),
    addressee_id: zod_1.z.string().optional(),
    addressee_name: zod_1.z.string().optional(),
    text: zod_1.z.string(),
    meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/** 玩家在 scene_log 中的稳定 id / 默认显示名 */
exports.SCENE_PLAYER_ID = 'player';
exports.SCENE_PLAYER_DISPLAY_NAME = '沈檐';
/**
 * 存档快照 v2（一局一档）
 * 仍在 DB 的 npc_state/messages 列写入「焦点 NPC」镜像，便于旧列表预览；
 * 完整数据在 payload / 或解析时从本结构还原。
 */
exports.conversationSnapshotV2Schema = zod_1.z.object({
    schema_version: zod_1.z.literal(2),
    saved_at: zod_1.z.string(),
    focus_npc_id: zod_1.z.string().min(1),
    world: zod_1.z.object({
        chapter_state: exports.chapterStateSchema,
        story_flags: story_schema_1.storyFlagsSnapshotSchema.default({}),
    }),
    /** 焦点镜像（兼容旧列表/旧客户端） */
    npc_state: exports.archivedNpcStateSchema,
    messages: zod_1.z.array(exports.archivedMessageSchema),
    npcs: zod_1.z.record(zod_1.z.string(), exports.archivedNpcSlotSchema),
});
/**
 * 存档快照 v3 = v2 + run 级 scene_log（整场对白时间线）
 * selected_npc_ids：null/缺省 = 全部已可出场；非空数组 = 在已可出场中筛选（至少 1 人）
 * player_notes：Mem-P 本局玩家要点（缺省 []，旧档兼容）
 */
exports.conversationSnapshotV3Schema = zod_1.z.object({
    schema_version: zod_1.z.literal(3),
    saved_at: zod_1.z.string(),
    focus_npc_id: zod_1.z.string().min(1),
    world: zod_1.z.object({
        chapter_state: exports.chapterStateSchema,
        story_flags: story_schema_1.storyFlagsSnapshotSchema.default({}),
    }),
    npc_state: exports.archivedNpcStateSchema,
    messages: zod_1.z.array(exports.archivedMessageSchema),
    npcs: zod_1.z.record(zod_1.z.string(), exports.archivedNpcSlotSchema),
    scene_log: zod_1.z.array(exports.sceneUtteranceSchema).default([]),
    /** null = 全部已可出场；string[] = 子集；缺省视为全部 */
    selected_npc_ids: zod_1.z
        .array(zod_1.z.string().min(1).max(64))
        .min(1)
        .max(32)
        .nullable()
        .optional(),
    /** Mem-P：本局玩家要点笔记 */
    player_notes: zod_1.z.array(player_note_schema_1.playerNoteSchema).max(40).default([]),
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
    /** 缺省视为旧版单人档 */
    scope: exports.archiveScopeSchema.optional(),
    snapshots: zod_1.z.array(exports.conversationSnapshotSummarySchema),
});
exports.conversationSavedEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    filename: zod_1.z.string(),
    snapshotIndex: zod_1.z.number().int(),
    savedAt: zod_1.z.string(),
    /** 存档时章节 id */
    chapter_state: exports.chapterStateSchema.optional(),
    scope: exports.archiveScopeSchema.optional(),
    /**
     * 本轮是否因章/世界旗变化而写入（前端仅此时插系统提示，避免每轮刷屏）。
     * 缺省视为 true，兼容旧服务端。
     */
    world_changed: zod_1.z.boolean().optional(),
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
    scope: exports.archiveScopeSchema.optional(),
    /** 一局档：一并恢复的其他 NPC id（便于前端拉状态） */
    restored_npc_ids: zod_1.z.array(zod_1.z.string()).optional(),
    /** 整场对白时间线（v3）；缺省时前端回退 messages */
    scene_log: zod_1.z.array(exports.sceneUtteranceSchema).optional(),
    /** null = 全部已可出场；缺省视为全部 */
    selected_npc_ids: zod_1.z
        .array(zod_1.z.string().min(1).max(64))
        .min(1)
        .max(32)
        .nullable()
        .optional(),
});
/** 本局出场选用：null = 恢复为全部已可出场 */
exports.setRunNpcSelectionPayloadSchema = zod_1.z.object({
    npcIds: zod_1.z
        .array(zod_1.z.string().min(1).max(64))
        .min(1)
        .max(32)
        .nullable(),
});
exports.runNpcSelectionEventSchema = zod_1.z.object({
    /** null = 全部已可出场 */
    selected_npc_ids: zod_1.z
        .array(zod_1.z.string().min(1).max(64))
        .min(1)
        .max(32)
        .nullable(),
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
    /** 新开一局重置为全部已可出场 */
    selected_npc_ids: zod_1.z
        .array(zod_1.z.string().min(1).max(64))
        .min(1)
        .max(32)
        .nullable()
        .optional(),
});
exports.archiveRenamedEventSchema = zod_1.z.object({
    npcId: zod_1.z.string(),
    filename: zod_1.z.string(),
    display_name: zod_1.z.string(),
});
