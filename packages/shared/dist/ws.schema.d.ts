import { z } from 'zod';
/** MVP 章节状态：日常 → 异常回避 → 梦境透露 */
export declare const chapterStateSchema: z.ZodEnum<{
    daily: "daily";
    uneasy: "uneasy";
    dream_reveal: "dream_reveal";
}>;
export type ChapterState = z.infer<typeof chapterStateSchema>;
export declare const DEFAULT_CHAPTER_STATE: ChapterState;
export declare const playerIdSchema: z.ZodString;
export declare const playerChatPayloadSchema: z.ZodObject<{
    npcId: z.ZodString;
    message: z.ZodString;
}, z.core.$strip>;
export declare const requestNpcStatePayloadSchema: z.ZodObject<{
    npcId: z.ZodString;
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
    chapter_state: z.ZodOptional<z.ZodEnum<{
        daily: "daily";
        uneasy: "uneasy";
        dream_reveal: "dream_reveal";
    }>>;
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
    chapter_state: z.ZodEnum<{
        daily: "daily";
        uneasy: "uneasy";
        dream_reveal: "dream_reveal";
    }>;
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
        chapter_state: z.ZodEnum<{
            daily: "daily";
            uneasy: "uneasy";
            dream_reveal: "dream_reveal";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const conversationArchiveSummarySchema: z.ZodObject<{
    filename: z.ZodString;
    session_started_at: z.ZodString;
    snapshots: z.ZodArray<z.ZodObject<{
        index: z.ZodNumber;
        saved_at: z.ZodString;
        message_count: z.ZodNumber;
        npc_state: z.ZodObject<{
            affinity: z.ZodNumber;
            fatigue: z.ZodNumber;
            current_status: z.ZodString;
            chapter_state: z.ZodEnum<{
                daily: "daily";
                uneasy: "uneasy";
                dream_reveal: "dream_reveal";
            }>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const conversationSavedEventSchema: z.ZodObject<{
    npcId: z.ZodString;
    filename: z.ZodString;
    snapshotIndex: z.ZodNumber;
    savedAt: z.ZodString;
}, z.core.$strip>;
export declare const conversationArchivesListEventSchema: z.ZodObject<{
    npcId: z.ZodString;
    archives: z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        session_started_at: z.ZodString;
        snapshots: z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            saved_at: z.ZodString;
            message_count: z.ZodNumber;
            npc_state: z.ZodObject<{
                affinity: z.ZodNumber;
                fatigue: z.ZodNumber;
                current_status: z.ZodString;
                chapter_state: z.ZodEnum<{
                    daily: "daily";
                    uneasy: "uneasy";
                    dream_reveal: "dream_reveal";
                }>;
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
        chapter_state: z.ZodEnum<{
            daily: "daily";
            uneasy: "uneasy";
            dream_reveal: "dream_reveal";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type PlayerChatPayload = z.infer<typeof playerChatPayloadSchema>;
export type RequestNpcStatePayload = z.infer<typeof requestNpcStatePayloadSchema>;
export type NpcStreamEvent = z.infer<typeof npcStreamEventSchema>;
export type NpcStateUpdate = z.infer<typeof npcStateUpdateSchema>;
export type ToolCallResult = z.infer<typeof toolCallResultSchema>;
export type SaveConversationPayload = z.infer<typeof saveConversationPayloadSchema>;
export type ListConversationArchivesPayload = z.infer<typeof listConversationArchivesPayloadSchema>;
export type LoadConversationArchivePayload = z.infer<typeof loadConversationArchivePayloadSchema>;
export type ArchivedNpcState = z.infer<typeof archivedNpcStateSchema>;
export type ArchivedMessage = z.infer<typeof archivedMessageSchema>;
export type ConversationSnapshotSummary = z.infer<typeof conversationSnapshotSummarySchema>;
export type ConversationArchiveSummary = z.infer<typeof conversationArchiveSummarySchema>;
export type ConversationSavedEvent = z.infer<typeof conversationSavedEventSchema>;
export type ConversationArchivesListEvent = z.infer<typeof conversationArchivesListEventSchema>;
export type ConversationLoadedEvent = z.infer<typeof conversationLoadedEventSchema>;
