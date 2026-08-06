import { z } from 'zod';
export declare const agentTraceRagHitSchema: z.ZodObject<{
    memory_id: z.ZodString;
    score: z.ZodNumber;
    source: z.ZodOptional<z.ZodEnum<{
        vector: "vector";
        keyword: "keyword";
    }>>;
}, z.core.$strip>;
export declare const agentTraceRagPathSchema: z.ZodEnum<{
    vector: "vector";
    keyword_fallback: "keyword_fallback";
}>;
export type AgentTraceRagPath = z.infer<typeof agentTraceRagPathSchema>;
export declare const agentTraceTransitionSchema: z.ZodObject<{
    chapter_before: z.ZodString;
    chapter_after: z.ZodString;
    flags_set: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>;
    matched_rule_ids: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const agentTraceRuntimeSchema: z.ZodObject<{
    affinity: z.ZodNumber;
    fatigue: z.ZodNumber;
    current_status: z.ZodString;
}, z.core.$strip>;
export declare const directorModeSchema: z.ZodEnum<{
    reply_player: "reply_player";
    reply_then_exchange: "reply_then_exchange";
}>;
export type DirectorMode = z.infer<typeof directorModeSchema>;
export declare const directorFallbackReasonSchema: z.ZodEnum<{
    parse_error: "parse_error";
    invalid_cast: "invalid_cast";
    llm_error: "llm_error";
    skipped_whisper: "skipped_whisper";
    lab_peer: "lab_peer";
}>;
export type DirectorFallbackReason = z.infer<typeof directorFallbackReasonSchema>;
/** false = 决策成功；字符串 = fallback 原因码 */
export declare const directorFallbackSchema: z.ZodUnion<readonly [z.ZodLiteral<false>, z.ZodEnum<{
    parse_error: "parse_error";
    invalid_cast: "invalid_cast";
    llm_error: "llm_error";
    skipped_whisper: "skipped_whisper";
    lab_peer: "lab_peer";
}>]>;
export type DirectorFallback = z.infer<typeof directorFallbackSchema>;
export declare const agentTraceDirectorSchema: z.ZodObject<{
    mode: z.ZodOptional<z.ZodEnum<{
        reply_player: "reply_player";
        reply_then_exchange: "reply_then_exchange";
    }>>;
    speakers: z.ZodOptional<z.ZodArray<z.ZodString>>;
    reason: z.ZodOptional<z.ZodString>;
    fallback: z.ZodUnion<readonly [z.ZodLiteral<false>, z.ZodEnum<{
        parse_error: "parse_error";
        invalid_cast: "invalid_cast";
        llm_error: "llm_error";
        skipped_whisper: "skipped_whisper";
        lab_peer: "lab_peer";
    }>]>;
    available_events: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type AgentTraceDirector = z.infer<typeof agentTraceDirectorSchema>;
/** 单轮 Agent 决策 Trace（可回放） */
export declare const agentTraceRecordSchema: z.ZodObject<{
    id: z.ZodString;
    at: z.ZodString;
    player_id: z.ZodString;
    npc_id: z.ZodString;
    world_id: z.ZodString;
    pack_version_id: z.ZodString;
    player_message: z.ZodString;
    mock: z.ZodBoolean;
    runtime_before: z.ZodObject<{
        affinity: z.ZodNumber;
        fatigue: z.ZodNumber;
        current_status: z.ZodString;
    }, z.core.$strip>;
    runtime_after: z.ZodObject<{
        affinity: z.ZodNumber;
        fatigue: z.ZodNumber;
        current_status: z.ZodString;
    }, z.core.$strip>;
    tools: z.ZodArray<z.ZodObject<{
        tool: z.ZodString;
        args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        observation: z.ZodString;
    }, z.core.$strip>>;
    transition: z.ZodObject<{
        chapter_before: z.ZodString;
        chapter_after: z.ZodString;
        flags_set: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            value: z.ZodString;
        }, z.core.$strip>>;
        matched_rule_ids: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    rag_hits: z.ZodArray<z.ZodObject<{
        memory_id: z.ZodString;
        score: z.ZodNumber;
        source: z.ZodOptional<z.ZodEnum<{
            vector: "vector";
            keyword: "keyword";
        }>>;
    }, z.core.$strip>>;
    rag_path: z.ZodOptional<z.ZodEnum<{
        vector: "vector";
        keyword_fallback: "keyword_fallback";
    }>>;
    rag_embed_backend: z.ZodOptional<z.ZodEnum<{
        api: "api";
        local: "local";
    }>>;
    rag_error: z.ZodOptional<z.ZodString>;
    working_memory_lines: z.ZodOptional<z.ZodArray<z.ZodString>>;
    player_notes_added: z.ZodOptional<z.ZodArray<z.ZodString>>;
    player_notes_injected: z.ZodOptional<z.ZodArray<z.ZodString>>;
    animation: z.ZodOptional<z.ZodString>;
    reply_flags_set: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>>;
    exchange: z.ZodOptional<z.ZodObject<{
        event_id: z.ZodString;
        lines: z.ZodArray<z.ZodObject<{
            npc_id: z.ZodString;
            name: z.ZodString;
            text: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    director: z.ZodOptional<z.ZodObject<{
        mode: z.ZodOptional<z.ZodEnum<{
            reply_player: "reply_player";
            reply_then_exchange: "reply_then_exchange";
        }>>;
        speakers: z.ZodOptional<z.ZodArray<z.ZodString>>;
        reason: z.ZodOptional<z.ZodString>;
        fallback: z.ZodUnion<readonly [z.ZodLiteral<false>, z.ZodEnum<{
            parse_error: "parse_error";
            invalid_cast: "invalid_cast";
            llm_error: "llm_error";
            skipped_whisper: "skipped_whisper";
            lab_peer: "lab_peer";
        }>]>;
        available_events: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    whisper_source: z.ZodOptional<z.ZodEnum<{
        client: "client";
        auto: "auto";
    }>>;
    auto_play: z.ZodOptional<z.ZodBoolean>;
    epilogue: z.ZodOptional<z.ZodBoolean>;
    lab: z.ZodOptional<z.ZodObject<{
        peer_agents: z.ZodLiteral<true>;
        stop_reason: z.ZodOptional<z.ZodString>;
        session_peer_lines: z.ZodOptional<z.ZodNumber>;
        round_peer_lines: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    ending: z.ZodOptional<z.ZodObject<{
        ending_id: z.ZodString;
        display_name: z.ZodString;
        flags_set: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            value: z.ZodString;
        }, z.core.$strip>>;
        flags_cleared: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    safety: z.ZodOptional<z.ZodObject<{
        ok: z.ZodBoolean;
        rewritten: z.ZodOptional<z.ZodBoolean>;
        reasons: z.ZodDefault<z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            detail: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AgentTraceRecord = z.infer<typeof agentTraceRecordSchema>;
export type AgentTraceTransition = z.infer<typeof agentTraceTransitionSchema>;
export declare const agentTraceListResponseSchema: z.ZodObject<{
    traces: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        at: z.ZodString;
        player_id: z.ZodString;
        npc_id: z.ZodString;
        world_id: z.ZodString;
        pack_version_id: z.ZodString;
        player_message: z.ZodString;
        mock: z.ZodBoolean;
        runtime_before: z.ZodObject<{
            affinity: z.ZodNumber;
            fatigue: z.ZodNumber;
            current_status: z.ZodString;
        }, z.core.$strip>;
        runtime_after: z.ZodObject<{
            affinity: z.ZodNumber;
            fatigue: z.ZodNumber;
            current_status: z.ZodString;
        }, z.core.$strip>;
        tools: z.ZodArray<z.ZodObject<{
            tool: z.ZodString;
            args: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            observation: z.ZodString;
        }, z.core.$strip>>;
        transition: z.ZodObject<{
            chapter_before: z.ZodString;
            chapter_after: z.ZodString;
            flags_set: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                value: z.ZodString;
            }, z.core.$strip>>;
            matched_rule_ids: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
        rag_hits: z.ZodArray<z.ZodObject<{
            memory_id: z.ZodString;
            score: z.ZodNumber;
            source: z.ZodOptional<z.ZodEnum<{
                vector: "vector";
                keyword: "keyword";
            }>>;
        }, z.core.$strip>>;
        rag_path: z.ZodOptional<z.ZodEnum<{
            vector: "vector";
            keyword_fallback: "keyword_fallback";
        }>>;
        rag_embed_backend: z.ZodOptional<z.ZodEnum<{
            api: "api";
            local: "local";
        }>>;
        rag_error: z.ZodOptional<z.ZodString>;
        working_memory_lines: z.ZodOptional<z.ZodArray<z.ZodString>>;
        player_notes_added: z.ZodOptional<z.ZodArray<z.ZodString>>;
        player_notes_injected: z.ZodOptional<z.ZodArray<z.ZodString>>;
        animation: z.ZodOptional<z.ZodString>;
        reply_flags_set: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            value: z.ZodString;
        }, z.core.$strip>>>;
        exchange: z.ZodOptional<z.ZodObject<{
            event_id: z.ZodString;
            lines: z.ZodArray<z.ZodObject<{
                npc_id: z.ZodString;
                name: z.ZodString;
                text: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        director: z.ZodOptional<z.ZodObject<{
            mode: z.ZodOptional<z.ZodEnum<{
                reply_player: "reply_player";
                reply_then_exchange: "reply_then_exchange";
            }>>;
            speakers: z.ZodOptional<z.ZodArray<z.ZodString>>;
            reason: z.ZodOptional<z.ZodString>;
            fallback: z.ZodUnion<readonly [z.ZodLiteral<false>, z.ZodEnum<{
                parse_error: "parse_error";
                invalid_cast: "invalid_cast";
                llm_error: "llm_error";
                skipped_whisper: "skipped_whisper";
                lab_peer: "lab_peer";
            }>]>;
            available_events: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        whisper_source: z.ZodOptional<z.ZodEnum<{
            client: "client";
            auto: "auto";
        }>>;
        auto_play: z.ZodOptional<z.ZodBoolean>;
        epilogue: z.ZodOptional<z.ZodBoolean>;
        lab: z.ZodOptional<z.ZodObject<{
            peer_agents: z.ZodLiteral<true>;
            stop_reason: z.ZodOptional<z.ZodString>;
            session_peer_lines: z.ZodOptional<z.ZodNumber>;
            round_peer_lines: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        ending: z.ZodOptional<z.ZodObject<{
            ending_id: z.ZodString;
            display_name: z.ZodString;
            flags_set: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                value: z.ZodString;
            }, z.core.$strip>>;
            flags_cleared: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        safety: z.ZodOptional<z.ZodObject<{
            ok: z.ZodBoolean;
            rewritten: z.ZodOptional<z.ZodBoolean>;
            reasons: z.ZodDefault<z.ZodArray<z.ZodObject<{
                code: z.ZodString;
                detail: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AgentTraceListResponse = z.infer<typeof agentTraceListResponseSchema>;
