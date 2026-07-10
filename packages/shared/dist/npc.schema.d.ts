import { z } from 'zod';
export declare const vec3Schema: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
export declare const npcMemorySchema: z.ZodObject<{
    id: z.ZodString;
    tags: z.ZodArray<z.ZodString>;
    keywords: z.ZodArray<z.ZodString>;
    content: z.ZodString;
    min_chapter: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const npcMetaSchema: z.ZodObject<{
    avatar: z.ZodString;
    model_path: z.ZodString;
    scale: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    spawn_position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
}, z.core.$strip>;
export declare const npcAttributesSchema: z.ZodObject<{
    fatigue: z.ZodNumber;
    max_fatigue: z.ZodNumber;
    affinity: z.ZodNumber;
    current_status: z.ZodString;
    favorite_things: z.ZodArray<z.ZodString>;
    favorite_synonyms: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
}, z.core.$strip>;
export declare const npcDefinitionSchema: z.ZodObject<{
    npc_id: z.ZodString;
    name: z.ZodString;
    meta: z.ZodObject<{
        avatar: z.ZodString;
        model_path: z.ZodString;
        scale: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        spawn_position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    }, z.core.$strip>;
    attributes: z.ZodObject<{
        fatigue: z.ZodNumber;
        max_fatigue: z.ZodNumber;
        affinity: z.ZodNumber;
        current_status: z.ZodString;
        favorite_things: z.ZodArray<z.ZodString>;
        favorite_synonyms: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
    }, z.core.$strip>;
    system_prompt_template: z.ZodString;
    memories: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        tags: z.ZodArray<z.ZodString>;
        keywords: z.ZodArray<z.ZodString>;
        content: z.ZodString;
        min_chapter: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const npcRuntimeStateSchema: z.ZodObject<{
    fatigue: z.ZodNumber;
    affinity: z.ZodNumber;
    current_status: z.ZodString;
}, z.core.$strip>;
export declare const npcPublicResponseSchema: z.ZodObject<{
    npc_id: z.ZodString;
    name: z.ZodString;
    meta: z.ZodObject<{
        avatar: z.ZodString;
        model_path: z.ZodString;
        scale: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        spawn_position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    }, z.core.$strip>;
    runtime: z.ZodObject<{
        fatigue: z.ZodNumber;
        affinity: z.ZodNumber;
        current_status: z.ZodString;
    }, z.core.$strip>;
    max_fatigue: z.ZodNumber;
}, z.core.$strip>;
export type NpcMemory = z.infer<typeof npcMemorySchema>;
export type NpcMeta = z.infer<typeof npcMetaSchema>;
export type NpcAttributes = z.infer<typeof npcAttributesSchema>;
export type NpcDefinition = z.infer<typeof npcDefinitionSchema>;
export type NpcRuntimeState = z.infer<typeof npcRuntimeStateSchema>;
export type NpcPublicResponse = z.infer<typeof npcPublicResponseSchema>;
