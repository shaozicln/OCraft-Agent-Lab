import { z } from 'zod';
/** 软情境→反应（只进人设 prompt，不写硬 triggers） */
export declare const distillTriggerReactionSchema: z.ZodObject<{
    situation: z.ZodString;
    reaction: z.ZodString;
}, z.core.$strip>;
/**
 * 人设蒸馏卡（Character Distillation）。
 * 用户确认后才 apply 进 Pack.npcs[]。
 */
export declare const distillCardSchema: z.ZodObject<{
    name: z.ZodString;
    npc_id: z.ZodOptional<z.ZodString>;
    core_traits: z.ZodDefault<z.ZodArray<z.ZodString>>;
    speech_patterns: z.ZodDefault<z.ZodArray<z.ZodString>>;
    typical_phrases: z.ZodDefault<z.ZodArray<z.ZodString>>;
    trigger_reactions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        situation: z.ZodString;
        reaction: z.ZodString;
    }, z.core.$strip>>>;
    forbidden_behaviors: z.ZodDefault<z.ZodArray<z.ZodString>>;
    source_note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type DistillCard = z.infer<typeof distillCardSchema>;
export type DistillTriggerReaction = z.infer<typeof distillTriggerReactionSchema>;
export declare const distillBriefPayloadSchema: z.ZodObject<{
    brief: z.ZodString;
    pack: z.ZodOptional<z.ZodUnknown>;
    target_npc_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type DistillBriefPayload = z.infer<typeof distillBriefPayloadSchema>;
export declare const distillBriefResultSchema: z.ZodObject<{
    card: z.ZodObject<{
        name: z.ZodString;
        npc_id: z.ZodOptional<z.ZodString>;
        core_traits: z.ZodDefault<z.ZodArray<z.ZodString>>;
        speech_patterns: z.ZodDefault<z.ZodArray<z.ZodString>>;
        typical_phrases: z.ZodDefault<z.ZodArray<z.ZodString>>;
        trigger_reactions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            situation: z.ZodString;
            reaction: z.ZodString;
        }, z.core.$strip>>>;
        forbidden_behaviors: z.ZodDefault<z.ZodArray<z.ZodString>>;
        source_note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    source: z.ZodEnum<{
        mock: "mock";
        llm: "llm";
    }>;
}, z.core.$strip>;
export type DistillBriefResult = z.infer<typeof distillBriefResultSchema>;
export declare const distillNormalizePayloadSchema: z.ZodObject<{
    raw: z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnknown>]>;
}, z.core.$strip>;
export type DistillNormalizePayload = z.infer<typeof distillNormalizePayloadSchema>;
export declare const distillNormalizeResultSchema: z.ZodObject<{
    card: z.ZodObject<{
        name: z.ZodString;
        npc_id: z.ZodOptional<z.ZodString>;
        core_traits: z.ZodDefault<z.ZodArray<z.ZodString>>;
        speech_patterns: z.ZodDefault<z.ZodArray<z.ZodString>>;
        typical_phrases: z.ZodDefault<z.ZodArray<z.ZodString>>;
        trigger_reactions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            situation: z.ZodString;
            reaction: z.ZodString;
        }, z.core.$strip>>>;
        forbidden_behaviors: z.ZodDefault<z.ZodArray<z.ZodString>>;
        source_note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    warnings: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type DistillNormalizeResult = z.infer<typeof distillNormalizeResultSchema>;
export declare const distillApplyModeSchema: z.ZodEnum<{
    create: "create";
    update: "update";
}>;
export declare const distillApplyPayloadSchema: z.ZodObject<{
    pack: z.ZodUnknown;
    card: z.ZodObject<{
        name: z.ZodString;
        npc_id: z.ZodOptional<z.ZodString>;
        core_traits: z.ZodDefault<z.ZodArray<z.ZodString>>;
        speech_patterns: z.ZodDefault<z.ZodArray<z.ZodString>>;
        typical_phrases: z.ZodDefault<z.ZodArray<z.ZodString>>;
        trigger_reactions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            situation: z.ZodString;
            reaction: z.ZodString;
        }, z.core.$strip>>>;
        forbidden_behaviors: z.ZodDefault<z.ZodArray<z.ZodString>>;
        source_note: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    mode: z.ZodDefault<z.ZodEnum<{
        create: "create";
        update: "update";
    }>>;
    target_npc_id: z.ZodOptional<z.ZodString>;
    overwrite: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type DistillApplyPayload = z.infer<typeof distillApplyPayloadSchema>;
export declare const distillApplyResultSchema: z.ZodObject<{
    pack: z.ZodUnknown;
    patch_notes: z.ZodDefault<z.ZodArray<z.ZodString>>;
    applied_npc_id: z.ZodString;
    applied: z.ZodBoolean;
    applied_summary: z.ZodString;
}, z.core.$strip>;
export type DistillApplyResult = z.infer<typeof distillApplyResultSchema>;
