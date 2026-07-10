"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packUpdatePayloadSchema = exports.packRuntimeSchema = exports.packRuntimeNpcSchema = exports.packRuntimeChapterSchema = exports.packSelectPayloadSchema = exports.packSelectionSchema = exports.packCreateWorldPayloadSchema = exports.packSaveAsPayloadSchema = exports.packSeedPayloadSchema = exports.packWorldSummarySchema = exports.packVersionSummarySchema = void 0;
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
/** 新建世界：world_id = 文件夹名；首版版本名默认等于 worldId */
exports.packCreateWorldPayloadSchema = zod_1.z.object({
    worldId: pack_schema_1.packIdSchema,
    /** 首个版本名；省略则用 worldId */
    versionName: zod_1.z.string().trim().min(1).max(64).optional(),
    description: zod_1.z.string().max(500).optional(),
    notes: zod_1.z.string().max(500).optional(),
    fromWorldId: pack_schema_1.packIdSchema.optional(),
    fromVersionDir: zod_1.z.string().min(1).optional(),
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
