import { z } from 'zod';
export declare const agentTraceRagHitSchema: z.ZodObject<{
    memory_id: z.ZodString;
    score: z.ZodNumber;
}, z.core.$strip>;
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
    }, z.core.$strip>>;
    animation: z.ZodOptional<z.ZodString>;
    reply_flags_set: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>>;
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
        }, z.core.$strip>>;
        animation: z.ZodOptional<z.ZodString>;
        reply_flags_set: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            value: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AgentTraceListResponse = z.infer<typeof agentTraceListResponseSchema>;
