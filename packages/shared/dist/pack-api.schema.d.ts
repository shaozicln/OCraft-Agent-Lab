import { z } from 'zod';
export declare const packVersionSummarySchema: z.ZodObject<{
    world_id: z.ZodString;
    version_dir: z.ZodString;
    version_name: z.ZodString;
    created_at: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    is_official: z.ZodBoolean;
}, z.core.$strip>;
export declare const packWorldSummarySchema: z.ZodObject<{
    world_id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    official_version_dir: z.ZodString;
    versions: z.ZodArray<z.ZodObject<{
        world_id: z.ZodString;
        version_dir: z.ZodString;
        version_name: z.ZodString;
        created_at: z.ZodString;
        notes: z.ZodOptional<z.ZodString>;
        is_official: z.ZodBoolean;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const packSeedPayloadSchema: z.ZodObject<{
    worldId: z.ZodString;
    versionDir: z.ZodString;
}, z.core.$strip>;
export declare const packSaveAsPayloadSchema: z.ZodObject<{
    worldId: z.ZodString;
    fromVersionDir: z.ZodOptional<z.ZodString>;
    versionName: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    blankContent: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
/** 新建世界：world_id = 文件夹名；首版版本名默认等于 worldId */
export declare const packCreateWorldPayloadSchema: z.ZodObject<{
    worldId: z.ZodString;
    versionName: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    fromWorldId: z.ZodOptional<z.ZodString>;
    fromVersionDir: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PackCreateWorldPayload = z.infer<typeof packCreateWorldPayloadSchema>;
export declare const packSelectionSchema: z.ZodObject<{
    world_id: z.ZodString;
    pack_version_id: z.ZodString;
    is_explicit: z.ZodBoolean;
}, z.core.$strip>;
export declare const packSelectPayloadSchema: z.ZodObject<{
    worldId: z.ZodString;
    packVersionId: z.ZodString;
}, z.core.$strip>;
export declare const packRuntimeChapterSchema: z.ZodObject<{
    id: z.ZodString;
    display_name: z.ZodString;
    hud_label: z.ZodOptional<z.ZodString>;
    rank: z.ZodNumber;
}, z.core.$strip>;
export declare const packRuntimeNpcSchema: z.ZodObject<{
    npc_id: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>;
/** 当前玩家生效包的运行时摘要（进场用） */
export declare const packRuntimeSchema: z.ZodObject<{
    selection: z.ZodObject<{
        world_id: z.ZodString;
        pack_version_id: z.ZodString;
        is_explicit: z.ZodBoolean;
    }, z.core.$strip>;
    default_npc_id: z.ZodString;
    default_chapter: z.ZodString;
    chapters: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        display_name: z.ZodString;
        hud_label: z.ZodOptional<z.ZodString>;
        rank: z.ZodNumber;
    }, z.core.$strip>>;
    chapter_labels: z.ZodRecord<z.ZodString, z.ZodString>;
    npcs: z.ZodArray<z.ZodObject<{
        npc_id: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PackVersionSummary = z.infer<typeof packVersionSummarySchema>;
export type PackWorldSummary = z.infer<typeof packWorldSummarySchema>;
export type PackSeedPayload = z.infer<typeof packSeedPayloadSchema>;
export type PackSaveAsPayload = z.infer<typeof packSaveAsPayloadSchema>;
export type PackSelection = z.infer<typeof packSelectionSchema>;
export type PackSelectPayload = z.infer<typeof packSelectPayloadSchema>;
export type PackRuntime = z.infer<typeof packRuntimeSchema>;
export declare const packUpdatePayloadSchema: z.ZodObject<{
    pack: z.ZodUnknown;
}, z.core.$strip>;
export type PackUpdatePayload = z.infer<typeof packUpdatePayloadSchema>;
