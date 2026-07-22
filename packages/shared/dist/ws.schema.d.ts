import { z } from 'zod';
/**
 * 章节 ID：由当前 Story Pack 声明（不再写死业务枚举）。
 */
export declare const chapterStateSchema: z.ZodString;
export type ChapterState = z.infer<typeof chapterStateSchema>;
/** 玩家 UID：三位数字字符串，如 001（注册时顺序分配） */
export declare const playerIdSchema: z.ZodString;
export declare const playerChatPayloadSchema: z.ZodObject<{
    npcId: z.ZodString;
    message: z.ZodString;
    nearbyNpcIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const requestNpcStatePayloadSchema: z.ZodObject<{
    npcId: z.ZodString;
}, z.core.$strip>;
/** 按需请求：当前剧情下玩家可选回复建议（点击填入，不自动发送） */
export declare const requestChatSuggestionsPayloadSchema: z.ZodObject<{
    npcId: z.ZodString;
}, z.core.$strip>;
export declare const chatSuggestionsEventSchema: z.ZodObject<{
    npcId: z.ZodString;
    suggestions: z.ZodArray<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const npcStreamEventSchema: z.ZodObject<{
    npcId: z.ZodString;
    chunk: z.ZodString;
    done: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const toolCallResultSchema: z.ZodObject<{
    tool: z.ZodString;
    args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    observation: z.ZodString;
}, z.core.$strip>;
export declare const npcStateUpdateSchema: z.ZodObject<{
    npcId: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    affinity: z.ZodNumber;
    fatigue: z.ZodNumber;
    maxFatigue: z.ZodOptional<z.ZodNumber>;
    animation: z.ZodOptional<z.ZodString>;
    current_status: z.ZodOptional<z.ZodString>;
    chapter_state: z.ZodOptional<z.ZodString>;
    story_flags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    toolCalls: z.ZodOptional<z.ZodArray<z.ZodObject<{
        tool: z.ZodString;
        args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        observation: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const npcErrorEventSchema: z.ZodObject<{
    npcId: z.ZodString;
    message: z.ZodString;
}, z.core.$strip>;
/** 关系事件互聊（旁听）：主对话结束后一次推送整段 */
export declare const npcExchangeLineSchema: z.ZodObject<{
    npcId: z.ZodString;
    name: z.ZodString;
    text: z.ZodString;
}, z.core.$strip>;
export declare const npcExchangeEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    chatNpcId: z.ZodString;
    lines: z.ZodArray<z.ZodObject<{
        npcId: z.ZodString;
        name: z.ZodString;
        text: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** 同场短接话：附近另一人插一句（非完整 exchange） */
export declare const npcAsideEventSchema: z.ZodObject<{
    chatNpcId: z.ZodString;
    npcId: z.ZodString;
    name: z.ZodString;
    text: z.ZodString;
}, z.core.$strip>;
export declare const saveConversationPayloadSchema: z.ZodObject<{
    npcId: z.ZodString;
}, z.core.$strip>;
export declare const listConversationArchivesPayloadSchema: z.ZodObject<{
    npcId: z.ZodString;
}, z.core.$strip>;
export declare const loadConversationArchivePayloadSchema: z.ZodObject<{
    npcId: z.ZodString;
    filename: z.ZodString;
    snapshotIndex: z.ZodNumber;
}, z.core.$strip>;
export declare const archivedNpcStateSchema: z.ZodObject<{
    affinity: z.ZodNumber;
    fatigue: z.ZodNumber;
    current_status: z.ZodString;
    chapter_state: z.ZodString;
    story_flags: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export declare const archivedMessageSchema: z.ZodObject<{
    role: z.ZodEnum<{
        user: "user";
        assistant: "assistant";
    }>;
    content: z.ZodString;
    at: z.ZodString;
}, z.core.$strip>;
/** 存档作用域：run=一局世界；npc=旧版单人会话 */
export declare const archiveScopeSchema: z.ZodEnum<{
    run: "run";
    npc: "npc";
}>;
export type ArchiveScope = z.infer<typeof archiveScopeSchema>;
/** 一局档里单个 NPC 的子快照 */
export declare const archivedNpcSlotSchema: z.ZodObject<{
    affinity: z.ZodNumber;
    fatigue: z.ZodNumber;
    current_status: z.ZodString;
    story_flags: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    messages: z.ZodDefault<z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
        }>;
        content: z.ZodString;
        at: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ArchivedNpcSlot = z.infer<typeof archivedNpcSlotSchema>;
/** 整场公共对话流中的一条发言（run 级） */
export declare const sceneUtteranceKindSchema: z.ZodEnum<{
    player_to_npc: "player_to_npc";
    npc_to_player: "npc_to_player";
    npc_to_npc: "npc_to_npc";
    system: "system";
}>;
export type SceneUtteranceKind = z.infer<typeof sceneUtteranceKindSchema>;
export declare const sceneUtteranceSchema: z.ZodObject<{
    id: z.ZodString;
    at: z.ZodString;
    kind: z.ZodEnum<{
        player_to_npc: "player_to_npc";
        npc_to_player: "npc_to_player";
        npc_to_npc: "npc_to_npc";
        system: "system";
    }>;
    speaker_id: z.ZodString;
    speaker_name: z.ZodString;
    addressee_id: z.ZodOptional<z.ZodString>;
    addressee_name: z.ZodOptional<z.ZodString>;
    text: z.ZodString;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type SceneUtterance = z.infer<typeof sceneUtteranceSchema>;
/** 玩家在 scene_log 中的稳定 id / 默认显示名 */
export declare const SCENE_PLAYER_ID: "player";
export declare const SCENE_PLAYER_DISPLAY_NAME: "\u6C88\u6A90";
/**
 * 存档快照 v2（一局一档）
 * 仍在 DB 的 npc_state/messages 列写入「焦点 NPC」镜像，便于旧列表预览；
 * 完整数据在 payload / 或解析时从本结构还原。
 */
export declare const conversationSnapshotV2Schema: z.ZodObject<{
    schema_version: z.ZodLiteral<2>;
    saved_at: z.ZodString;
    focus_npc_id: z.ZodString;
    world: z.ZodObject<{
        chapter_state: z.ZodString;
        story_flags: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>;
    npc_state: z.ZodObject<{
        affinity: z.ZodNumber;
        fatigue: z.ZodNumber;
        current_status: z.ZodString;
        chapter_state: z.ZodString;
        story_flags: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
        }>;
        content: z.ZodString;
        at: z.ZodString;
    }, z.core.$strip>>;
    npcs: z.ZodRecord<z.ZodString, z.ZodObject<{
        affinity: z.ZodNumber;
        fatigue: z.ZodNumber;
        current_status: z.ZodString;
        story_flags: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        messages: z.ZodDefault<z.ZodArray<z.ZodObject<{
            role: z.ZodEnum<{
                user: "user";
                assistant: "assistant";
            }>;
            content: z.ZodString;
            at: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ConversationSnapshotV2 = z.infer<typeof conversationSnapshotV2Schema>;
/**
 * 存档快照 v3 = v2 + run 级 scene_log（整场对白时间线）
 */
export declare const conversationSnapshotV3Schema: z.ZodObject<{
    schema_version: z.ZodLiteral<3>;
    saved_at: z.ZodString;
    focus_npc_id: z.ZodString;
    world: z.ZodObject<{
        chapter_state: z.ZodString;
        story_flags: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>;
    npc_state: z.ZodObject<{
        affinity: z.ZodNumber;
        fatigue: z.ZodNumber;
        current_status: z.ZodString;
        chapter_state: z.ZodString;
        story_flags: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
        }>;
        content: z.ZodString;
        at: z.ZodString;
    }, z.core.$strip>>;
    npcs: z.ZodRecord<z.ZodString, z.ZodObject<{
        affinity: z.ZodNumber;
        fatigue: z.ZodNumber;
        current_status: z.ZodString;
        story_flags: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        messages: z.ZodDefault<z.ZodArray<z.ZodObject<{
            role: z.ZodEnum<{
                user: "user";
                assistant: "assistant";
            }>;
            content: z.ZodString;
            at: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    scene_log: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        at: z.ZodString;
        kind: z.ZodEnum<{
            player_to_npc: "player_to_npc";
            npc_to_player: "npc_to_player";
            npc_to_npc: "npc_to_npc";
            system: "system";
        }>;
        speaker_id: z.ZodString;
        speaker_name: z.ZodString;
        addressee_id: z.ZodOptional<z.ZodString>;
        addressee_name: z.ZodOptional<z.ZodString>;
        text: z.ZodString;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ConversationSnapshotV3 = z.infer<typeof conversationSnapshotV3Schema>;
/** 当前写入版本别名 */
export type ConversationSnapshotPayload = ConversationSnapshotV3;
export declare const conversationSnapshotSummarySchema: z.ZodObject<{
    index: z.ZodNumber;
    saved_at: z.ZodString;
    message_count: z.ZodNumber;
    npc_state: z.ZodObject<{
        affinity: z.ZodNumber;
        fatigue: z.ZodNumber;
        current_status: z.ZodString;
        chapter_state: z.ZodString;
        story_flags: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const conversationArchiveSummarySchema: z.ZodObject<{
    filename: z.ZodString;
    display_name: z.ZodOptional<z.ZodString>;
    session_started_at: z.ZodString;
    scope: z.ZodOptional<z.ZodEnum<{
        run: "run";
        npc: "npc";
    }>>;
    snapshots: z.ZodArray<z.ZodObject<{
        index: z.ZodNumber;
        saved_at: z.ZodString;
        message_count: z.ZodNumber;
        npc_state: z.ZodObject<{
            affinity: z.ZodNumber;
            fatigue: z.ZodNumber;
            current_status: z.ZodString;
            chapter_state: z.ZodString;
            story_flags: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const conversationSavedEventSchema: z.ZodObject<{
    npcId: z.ZodString;
    filename: z.ZodString;
    snapshotIndex: z.ZodNumber;
    savedAt: z.ZodString;
    chapter_state: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodEnum<{
        run: "run";
        npc: "npc";
    }>>;
    world_changed: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const conversationArchivesListEventSchema: z.ZodObject<{
    npcId: z.ZodString;
    archives: z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        display_name: z.ZodOptional<z.ZodString>;
        session_started_at: z.ZodString;
        scope: z.ZodOptional<z.ZodEnum<{
            run: "run";
            npc: "npc";
        }>>;
        snapshots: z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            saved_at: z.ZodString;
            message_count: z.ZodNumber;
            npc_state: z.ZodObject<{
                affinity: z.ZodNumber;
                fatigue: z.ZodNumber;
                current_status: z.ZodString;
                chapter_state: z.ZodString;
                story_flags: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
            }, z.core.$strip>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const conversationLoadedEventSchema: z.ZodObject<{
    npcId: z.ZodString;
    filename: z.ZodString;
    snapshotIndex: z.ZodNumber;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
        }>;
        content: z.ZodString;
        at: z.ZodString;
    }, z.core.$strip>>;
    npc_state: z.ZodObject<{
        affinity: z.ZodNumber;
        fatigue: z.ZodNumber;
        current_status: z.ZodString;
        chapter_state: z.ZodString;
        story_flags: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>;
    scope: z.ZodOptional<z.ZodEnum<{
        run: "run";
        npc: "npc";
    }>>;
    restored_npc_ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
    scene_log: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        at: z.ZodString;
        kind: z.ZodEnum<{
            player_to_npc: "player_to_npc";
            npc_to_player: "npc_to_player";
            npc_to_npc: "npc_to_npc";
            system: "system";
        }>;
        speaker_id: z.ZodString;
        speaker_name: z.ZodString;
        addressee_id: z.ZodOptional<z.ZodString>;
        addressee_name: z.ZodOptional<z.ZodString>;
        text: z.ZodString;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
/** 新开一局 / 从某章或某分歧回溯为新存档槽 */
export declare const startNewRunPayloadSchema: z.ZodObject<{
    npcId: z.ZodString;
    chapterId: z.ZodOptional<z.ZodString>;
    displayName: z.ZodOptional<z.ZodString>;
    viaRuleId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const renameArchivePayloadSchema: z.ZodObject<{
    npcId: z.ZodString;
    filename: z.ZodString;
    displayName: z.ZodString;
}, z.core.$strip>;
export declare const requestStoryMapPayloadSchema: z.ZodObject<{
    npcId: z.ZodString;
}, z.core.$strip>;
export declare const storyMapEdgeSchema: z.ZodObject<{
    id: z.ZodString;
    from: z.ZodString;
    to: z.ZodNullable<z.ZodString>;
    label: z.ZodString;
    set_flag_names: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const storyMapEventSchema: z.ZodObject<{
    npcId: z.ZodString;
    current_chapter: z.ZodString;
    flags: z.ZodRecord<z.ZodString, z.ZodString>;
    chapters: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        display_name: z.ZodString;
        rank: z.ZodNumber;
    }, z.core.$strip>>;
    edges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        from: z.ZodString;
        to: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        set_flag_names: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const newRunStartedEventSchema: z.ZodObject<{
    npcId: z.ZodString;
    filename: z.ZodString;
    display_name: z.ZodOptional<z.ZodString>;
    chapter_state: z.ZodString;
    story_flags: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>;
export declare const archiveRenamedEventSchema: z.ZodObject<{
    npcId: z.ZodString;
    filename: z.ZodString;
    display_name: z.ZodString;
}, z.core.$strip>;
export type PlayerChatPayload = z.infer<typeof playerChatPayloadSchema>;
export type RequestNpcStatePayload = z.infer<typeof requestNpcStatePayloadSchema>;
export type RequestChatSuggestionsPayload = z.infer<typeof requestChatSuggestionsPayloadSchema>;
export type ChatSuggestionsEvent = z.infer<typeof chatSuggestionsEventSchema>;
export type NpcStreamEvent = z.infer<typeof npcStreamEventSchema>;
export type NpcStateUpdate = z.infer<typeof npcStateUpdateSchema>;
export type ToolCallResult = z.infer<typeof toolCallResultSchema>;
export type SaveConversationPayload = z.infer<typeof saveConversationPayloadSchema>;
export type ListConversationArchivesPayload = z.infer<typeof listConversationArchivesPayloadSchema>;
export type LoadConversationArchivePayload = z.infer<typeof loadConversationArchivePayloadSchema>;
export type StartNewRunPayload = z.infer<typeof startNewRunPayloadSchema>;
export type RenameArchivePayload = z.infer<typeof renameArchivePayloadSchema>;
export type RequestStoryMapPayload = z.infer<typeof requestStoryMapPayloadSchema>;
export type StoryMapEdge = z.infer<typeof storyMapEdgeSchema>;
export type StoryMapEvent = z.infer<typeof storyMapEventSchema>;
export type NewRunStartedEvent = z.infer<typeof newRunStartedEventSchema>;
export type ArchiveRenamedEvent = z.infer<typeof archiveRenamedEventSchema>;
export type ArchivedNpcState = z.infer<typeof archivedNpcStateSchema>;
export type ArchivedMessage = z.infer<typeof archivedMessageSchema>;
export type ConversationSnapshotSummary = z.infer<typeof conversationSnapshotSummarySchema>;
export type ConversationArchiveSummary = z.infer<typeof conversationArchiveSummarySchema>;
export type ConversationSavedEvent = z.infer<typeof conversationSavedEventSchema>;
export type ConversationArchivesListEvent = z.infer<typeof conversationArchivesListEventSchema>;
export type ConversationLoadedEvent = z.infer<typeof conversationLoadedEventSchema>;
export type NpcExchangeLine = z.infer<typeof npcExchangeLineSchema>;
export type NpcExchangeEvent = z.infer<typeof npcExchangeEventSchema>;
export type NpcAsideEvent = z.infer<typeof npcAsideEventSchema>;
