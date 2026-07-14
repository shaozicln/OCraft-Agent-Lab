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
}, z.core.$strip>;
export declare const conversationArchivesListEventSchema: z.ZodObject<{
    npcId: z.ZodString;
    archives: z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        display_name: z.ZodOptional<z.ZodString>;
        session_started_at: z.ZodString;
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
