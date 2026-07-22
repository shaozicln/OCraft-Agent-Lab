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
/** 新建世界：world_id = 文件夹名；首版版本名默认等于 worldId（极简空壳） */
export declare const packCreateWorldPayloadSchema: z.ZodObject<{
    worldId: z.ZodString;
    versionName: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
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
    spawn_position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    model_path: z.ZodOptional<z.ZodString>;
    appear_from_chapter: z.ZodOptional<z.ZodString>;
    appear_require_flags: z.ZodDefault<z.ZodArray<z.ZodString>>;
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
        spawn_position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        model_path: z.ZodOptional<z.ZodString>;
        appear_from_chapter: z.ZodOptional<z.ZodString>;
        appear_require_flags: z.ZodDefault<z.ZodArray<z.ZodString>>;
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
/**
 * 一句话生成可勾选块（不含包头；未勾选则保留 basePack 对应内容）
 * 顺序按依赖：章节/Flags → NPC/结局 → 数值/动画 → 触发 → Prompt → 个人信息
 */
export declare const packGenerateSectionKeys: readonly ["chapters", "flags", "npcs", "endings", "numeric_tools", "animation_rules", "chapter_triggers", "npc_reply_flags", "prompt_common", "affinity_tiers", "fatigue_hints", "chapter_constraints", "flag_constraints", "pack_profile"];
export type PackGenerateSectionKey = (typeof packGenerateSectionKeys)[number];
export declare const packGenerateSectionsSchema: z.ZodObject<{
    chapters: z.ZodBoolean;
    flags: z.ZodBoolean;
    npcs: z.ZodBoolean;
    endings: z.ZodBoolean;
    numeric_tools: z.ZodBoolean;
    animation_rules: z.ZodBoolean;
    chapter_triggers: z.ZodBoolean;
    npc_reply_flags: z.ZodBoolean;
    prompt_common: z.ZodBoolean;
    affinity_tiers: z.ZodBoolean;
    fatigue_hints: z.ZodBoolean;
    chapter_constraints: z.ZodBoolean;
    flag_constraints: z.ZodBoolean;
    pack_profile: z.ZodBoolean;
}, z.core.$strip>;
export type PackGenerateSections = z.infer<typeof packGenerateSectionsSchema>;
export declare const DEFAULT_PACK_GENERATE_SECTIONS: PackGenerateSections;
/** 生成进度展示名（弹窗 / 黄标） */
export declare const PACK_GENERATE_SECTION_LABELS: Record<PackGenerateSectionKey, string>;
/** SSE：一句话生成流式事件 */
export declare const packGenerateStreamEventSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"section_start">;
    section: z.ZodEnum<{
        npcs: "npcs";
        flags: "flags";
        chapters: "chapters";
        affinity_tiers: "affinity_tiers";
        fatigue_hints: "fatigue_hints";
        chapter_constraints: "chapter_constraints";
        flag_constraints: "flag_constraints";
        numeric_tools: "numeric_tools";
        animation_rules: "animation_rules";
        endings: "endings";
        chapter_triggers: "chapter_triggers";
        npc_reply_flags: "npc_reply_flags";
        prompt_common: "prompt_common";
        pack_profile: "pack_profile";
    }>;
    label: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"section_done">;
    section: z.ZodEnum<{
        npcs: "npcs";
        flags: "flags";
        chapters: "chapters";
        affinity_tiers: "affinity_tiers";
        fatigue_hints: "fatigue_hints";
        chapter_constraints: "chapter_constraints";
        flag_constraints: "flag_constraints";
        numeric_tools: "numeric_tools";
        animation_rules: "animation_rules";
        endings: "endings";
        chapter_triggers: "chapter_triggers";
        npc_reply_flags: "npc_reply_flags";
        prompt_common: "prompt_common";
        pack_profile: "pack_profile";
    }>;
    label: z.ZodString;
    pack: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"error">;
    section: z.ZodOptional<z.ZodEnum<{
        npcs: "npcs";
        flags: "flags";
        chapters: "chapters";
        affinity_tiers: "affinity_tiers";
        fatigue_hints: "fatigue_hints";
        chapter_constraints: "chapter_constraints";
        flag_constraints: "flag_constraints";
        numeric_tools: "numeric_tools";
        animation_rules: "animation_rules";
        endings: "endings";
        chapter_triggers: "chapter_triggers";
        npc_reply_flags: "npc_reply_flags";
        prompt_common: "prompt_common";
        pack_profile: "pack_profile";
    }>>;
    message: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"done">;
    source: z.ZodEnum<{
        mock: "mock";
        llm: "llm";
    }>;
    pack: z.ZodUnknown;
    profileFields: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>>;
    failedSections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        section: z.ZodEnum<{
            npcs: "npcs";
            flags: "flags";
            chapters: "chapters";
            affinity_tiers: "affinity_tiers";
            fatigue_hints: "fatigue_hints";
            chapter_constraints: "chapter_constraints";
            flag_constraints: "flag_constraints";
            numeric_tools: "numeric_tools";
            animation_rules: "animation_rules";
            endings: "endings";
            chapter_triggers: "chapter_triggers";
            npc_reply_flags: "npc_reply_flags";
            prompt_common: "prompt_common";
            pack_profile: "pack_profile";
        }>;
        message: z.ZodString;
    }, z.core.$strip>>>;
    summary: z.ZodOptional<z.ZodString>;
}, z.core.$strip>], "type">;
export type PackGenerateStreamEvent = z.infer<typeof packGenerateStreamEventSchema>;
/** 梗概/摘要上限；全文大纲用 outline 字段 */
export declare const PACK_GENERATE_PROMPT_MAX = 8000;
/** 导入大纲全文上限 */
export declare const PACK_GENERATE_OUTLINE_MAX = 50000;
/** 生成 Pack 草稿（不落盘）：摘要 + 可选导入大纲 */
export declare const packGenerateDraftPayloadSchema: z.ZodObject<{
    prompt: z.ZodDefault<z.ZodString>;
    outline: z.ZodOptional<z.ZodString>;
    basePack: z.ZodUnknown;
    sections: z.ZodOptional<z.ZodObject<{
        chapters: z.ZodBoolean;
        flags: z.ZodBoolean;
        npcs: z.ZodBoolean;
        endings: z.ZodBoolean;
        numeric_tools: z.ZodBoolean;
        animation_rules: z.ZodBoolean;
        chapter_triggers: z.ZodBoolean;
        npc_reply_flags: z.ZodBoolean;
        prompt_common: z.ZodBoolean;
        affinity_tiers: z.ZodBoolean;
        fatigue_hints: z.ZodBoolean;
        chapter_constraints: z.ZodBoolean;
        flag_constraints: z.ZodBoolean;
        pack_profile: z.ZodBoolean;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PackGenerateDraftPayload = z.infer<typeof packGenerateDraftPayloadSchema>;
