"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packGenerateDraftPayloadSchema = exports.packGenerateStreamEventSchema = exports.PACK_GENERATE_SECTION_LABELS = exports.DEFAULT_PACK_GENERATE_SECTIONS = exports.packGenerateSectionsSchema = exports.packGenerateSectionKeys = exports.packUpdatePayloadSchema = exports.packRuntimeSchema = exports.packRuntimeNpcSchema = exports.packRuntimeChapterSchema = exports.packSelectPayloadSchema = exports.packSelectionSchema = exports.packCreateWorldPayloadSchema = exports.packSaveAsPayloadSchema = exports.packSeedPayloadSchema = exports.packWorldSummarySchema = exports.packVersionSummarySchema = void 0;
const zod_1 = require("zod");
const pack_schema_1 = require("./pack.schema");
exports.packVersionSummarySchema = zod_1.z.object({
    world_id: pack_schema_1.packIdSchema,
    /** versions/ 下文件夹名：版本名__时间戳 */
    version_dir: zod_1.z.string().min(1),
    /** 版本名（不含时间戳），来自 pack.json；列表主展示用 version_dir */
    version_name: zod_1.z.string().min(1),
    created_at: zod_1.z.string().min(1),
    notes: zod_1.z.string().optional(),
    /** 是否为当前全服测试默认 */
    is_official: zod_1.z.boolean(),
});
exports.packWorldSummarySchema = zod_1.z.object({
    world_id: pack_schema_1.packIdSchema,
    description: zod_1.z.string().optional(),
    official_version_dir: zod_1.z.string().min(1),
    versions: zod_1.z.array(exports.packVersionSummarySchema),
});
exports.packSeedPayloadSchema = zod_1.z.object({
    worldId: pack_schema_1.packIdSchema,
    versionDir: zod_1.z.string().min(1),
});
exports.packSaveAsPayloadSchema = zod_1.z.object({
    worldId: pack_schema_1.packIdSchema,
    /** 源版本目录名；省略则用当前测试版 */
    fromVersionDir: zod_1.z.string().min(1).optional(),
    /** 版本名（不含时间戳）→ 生成 版本名__时间戳 */
    versionName: zod_1.z.string().trim().min(1).max(64),
    notes: zod_1.z.string().max(500).optional(),
    /** true = 清空文案仅保留结构 */
    blankContent: zod_1.z.boolean().optional(),
});
/** 新建世界：world_id = 文件夹名；首版版本名默认等于 worldId（极简空壳） */
exports.packCreateWorldPayloadSchema = zod_1.z.object({
    worldId: pack_schema_1.packIdSchema,
    /** 首个版本名；省略则用 worldId */
    versionName: zod_1.z.string().trim().min(1).max(64).optional(),
    description: zod_1.z.string().max(500).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
exports.packSelectionSchema = zod_1.z.object({
    world_id: pack_schema_1.packIdSchema,
    pack_version_id: zod_1.z.string().min(1),
    /** true = 显式选用；false = 跟随全服测试默认 */
    is_explicit: zod_1.z.boolean(),
});
exports.packSelectPayloadSchema = zod_1.z.object({
    worldId: pack_schema_1.packIdSchema,
    packVersionId: zod_1.z.string().min(1),
});
exports.packRuntimeChapterSchema = zod_1.z.object({
    id: pack_schema_1.packIdSchema,
    display_name: zod_1.z.string().min(1),
    hud_label: zod_1.z.string().min(1).optional(),
    rank: zod_1.z.number().int().nonnegative(),
});
exports.packRuntimeNpcSchema = zod_1.z.object({
    npc_id: pack_schema_1.packIdSchema,
    name: zod_1.z.string().min(1),
});
/** 当前玩家生效包的运行时摘要（进场用） */
exports.packRuntimeSchema = zod_1.z.object({
    selection: exports.packSelectionSchema,
    default_npc_id: pack_schema_1.packIdSchema,
    default_chapter: pack_schema_1.packIdSchema,
    chapters: zod_1.z.array(exports.packRuntimeChapterSchema),
    /** chapterId → 展示名（hud_label 优先） */
    chapter_labels: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
    npcs: zod_1.z.array(exports.packRuntimeNpcSchema),
});
exports.packUpdatePayloadSchema = zod_1.z.object({
    pack: zod_1.z.unknown(),
});
/** 一句话生成可勾选块（不含包头；未勾选则保留 basePack 对应内容） */
exports.packGenerateSectionKeys = [
    'chapters',
    'flags',
    'numeric_tools',
    'animation_rules',
    'endings',
    'chapter_triggers',
    'npc_reply_flags',
    'prompt_common',
    'affinity_tiers',
    'fatigue_hints',
    'chapter_constraints',
    'flag_constraints',
    'npcs',
    'pack_profile',
];
exports.packGenerateSectionsSchema = zod_1.z.object({
    chapters: zod_1.z.boolean(),
    flags: zod_1.z.boolean(),
    numeric_tools: zod_1.z.boolean(),
    animation_rules: zod_1.z.boolean(),
    endings: zod_1.z.boolean(),
    chapter_triggers: zod_1.z.boolean(),
    npc_reply_flags: zod_1.z.boolean(),
    prompt_common: zod_1.z.boolean(),
    affinity_tiers: zod_1.z.boolean(),
    fatigue_hints: zod_1.z.boolean(),
    chapter_constraints: zod_1.z.boolean(),
    flag_constraints: zod_1.z.boolean(),
    npcs: zod_1.z.boolean(),
    pack_profile: zod_1.z.boolean(),
});
exports.DEFAULT_PACK_GENERATE_SECTIONS = Object.fromEntries(exports.packGenerateSectionKeys.map((k) => [k, true]));
/** 生成进度展示名（弹窗 / 黄标） */
exports.PACK_GENERATE_SECTION_LABELS = {
    chapters: '世界·章节',
    flags: '世界·Flags',
    numeric_tools: '世界·数值工具',
    animation_rules: '世界·动画规则',
    endings: '世界·结局',
    chapter_triggers: '触发·章节触发',
    npc_reply_flags: '触发·回复置 Flag',
    prompt_common: 'Prompt·通用',
    affinity_tiers: 'Prompt·好感区间',
    fatigue_hints: 'Prompt·疲惫提示',
    chapter_constraints: 'Prompt·章节约束',
    flag_constraints: 'Prompt·Flag 约束',
    npcs: 'NPC',
    pack_profile: '本世界个人信息',
};
/** SSE：一句话生成流式事件 */
exports.packGenerateStreamEventSchema = zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({
        type: zod_1.z.literal('section_start'),
        section: zod_1.z.enum(exports.packGenerateSectionKeys),
        label: zod_1.z.string(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('section_done'),
        section: zod_1.z.enum(exports.packGenerateSectionKeys),
        label: zod_1.z.string(),
        /** 当前合并后的草稿（便于前端即时刷新编辑器） */
        pack: zod_1.z.unknown().optional(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('error'),
        section: zod_1.z.enum(exports.packGenerateSectionKeys).optional(),
        message: zod_1.z.string(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('done'),
        source: zod_1.z.enum(['llm', 'mock']),
        pack: zod_1.z.unknown(),
        profileFields: zod_1.z
            .array(zod_1.z.object({
            id: zod_1.z.string(),
            label: zod_1.z.string(),
            value: zod_1.z.string(),
        }))
            .optional(),
    }),
]);
/** 一句话生成 Pack 草稿（不落盘） */
exports.packGenerateDraftPayloadSchema = zod_1.z.object({
    prompt: zod_1.z.string().trim().min(4).max(500),
    /** 当前编辑中的包（保留 world_id / version_dir / header） */
    basePack: zod_1.z.unknown(),
    /** 省略则全部生成 */
    sections: exports.packGenerateSectionsSchema.optional(),
});
