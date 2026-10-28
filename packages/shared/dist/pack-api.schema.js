"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packGenerateDraftPayloadSchema = exports.PACK_GENERATE_OUTLINE_MAX = exports.PACK_GENERATE_PROMPT_MAX = exports.packGenerateStreamEventSchema = exports.PACK_GENERATE_SECTION_LABELS = exports.DEFAULT_PACK_GENERATE_SECTIONS = exports.packGenerateSectionsSchema = exports.packGenerateSectionKeys = exports.packUpdatePayloadSchema = exports.packRuntimeSchema = exports.packRuntimeNpcSchema = exports.packRuntimeChapterSchema = exports.packSelectPayloadSchema = exports.packSelectionSchema = exports.packTrashListResponseSchema = exports.packTrashItemSchema = exports.packWorldListQuerySchema = exports.packWorldListSortSchema = exports.packReactionPayloadSchema = exports.packSetOfficialPayloadSchema = exports.packModerationPayloadSchema = exports.packForkPayloadSchema = exports.packShareVersionPayloadSchema = exports.packShareWorldPayloadSchema = exports.packCreateWorldPayloadSchema = exports.packSaveAsPayloadSchema = exports.packSeedPayloadSchema = exports.packWorldSummarySchema = exports.packVersionSummarySchema = void 0;
const zod_1 = require("zod");
const pack_schema_1 = require("./pack.schema");
exports.packVersionSummarySchema = zod_1.z.object({
    world_id: pack_schema_1.communityWorldIdSchema,
    /** versions/ 下文件夹名：版本名__时间戳 */
    version_dir: zod_1.z.string().min(1),
    /** 版本名（不含时间戳），来自 pack.json；列表主展示用 version_dir */
    version_name: zod_1.z.string().min(1),
    created_at: zod_1.z.string().min(1),
    notes: zod_1.z.string().optional(),
    /** 是否为当前全服测试默认版本（manifest 指针） */
    is_official: zod_1.z.boolean(),
    /** 版本是否对社区共享 */
    is_shared: zod_1.z.boolean().optional().default(false),
    /** 是否当前玩家拥有 */
    is_owner: zod_1.z.boolean().optional().default(false),
    /** 审核：normal | hidden */
    moderation: zod_1.z.enum(['normal', 'hidden']).optional().default('normal'),
    like_count: zod_1.z.number().int().nonnegative().optional().default(0),
    favorite_count: zod_1.z.number().int().nonnegative().optional().default(0),
    liked_by_me: zod_1.z.boolean().optional().default(false),
    favorited_by_me: zod_1.z.boolean().optional().default(false),
});
exports.packWorldSummarySchema = zod_1.z.object({
    world_id: pack_schema_1.communityWorldIdSchema,
    /** 展示短名（可跨作者重名）；缺省等于 world_id */
    short_name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    official_version_dir: zod_1.z.string().min(1),
    versions: zod_1.z.array(exports.packVersionSummarySchema),
    owner_player_id: zod_1.z.string().nullable().optional(),
    owner_username: zod_1.z.string().nullable().optional(),
    is_official_world: zod_1.z.boolean().optional().default(false),
    is_shared: zod_1.z.boolean().optional().default(false),
    is_owner: zod_1.z.boolean().optional().default(false),
    moderation: zod_1.z.enum(['normal', 'hidden']).optional().default('normal'),
    forked_from_world_id: zod_1.z.string().nullable().optional(),
    forked_from_version_dirs: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    /** @deprecated 兼容旧字段；用 forked_from_version_dirs */
    forked_from_version_dir: zod_1.z.string().nullable().optional(),
    like_count: zod_1.z.number().int().nonnegative().optional().default(0),
    favorite_count: zod_1.z.number().int().nonnegative().optional().default(0),
    liked_by_me: zod_1.z.boolean().optional().default(false),
    favorited_by_me: zod_1.z.boolean().optional().default(false),
});
exports.packSeedPayloadSchema = zod_1.z.object({
    worldId: pack_schema_1.communityWorldIdSchema,
    versionDir: zod_1.z.string().min(1),
});
exports.packSaveAsPayloadSchema = zod_1.z.object({
    worldId: pack_schema_1.communityWorldIdSchema,
    /** 源版本目录名；省略则用当前测试版 */
    fromVersionDir: zod_1.z.string().min(1).optional(),
    /** 版本名（不含时间戳）→ 生成 版本名__时间戳 */
    versionName: zod_1.z.string().trim().min(1).max(64),
    notes: zod_1.z.string().max(500).optional(),
    /** true = 清空文案仅保留结构 */
    blankContent: zod_1.z.boolean().optional(),
});
/**
 * 新建世界。
 * - shortName：展示短名（可与他人重名）；服务端生成唯一 world_id = u{uid}_{shortName}
 * - worldId：兼容旧客户端；若传入且无 shortName，则按短名处理（非管理员不可占用 office/awaken）
 */
exports.packCreateWorldPayloadSchema = zod_1.z.object({
    worldId: pack_schema_1.communityWorldIdSchema.optional(),
    shortName: pack_schema_1.communityShortNameSchema.optional(),
    /** 首个版本名；省略则用 shortName / worldId */
    versionName: zod_1.z.string().trim().min(1).max(64).optional(),
    description: zod_1.z.string().max(500).optional(),
    notes: zod_1.z.string().max(500).optional(),
}).superRefine((data, ctx) => {
    if (!data.shortName && !data.worldId) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: '请提供 shortName 或 worldId',
            path: ['shortName'],
        });
    }
});
exports.packShareWorldPayloadSchema = zod_1.z.object({
    isShared: zod_1.z.boolean(),
    /** 开启世界共享时，若尚无共享版本，可指定先共享的版本目录 */
    ensureVersionDir: zod_1.z.string().min(1).optional(),
});
exports.packShareVersionPayloadSchema = zod_1.z.object({
    isShared: zod_1.z.boolean(),
});
exports.packForkPayloadSchema = zod_1.z.object({
    fromWorldId: pack_schema_1.communityWorldIdSchema,
    /** 要拷贝的版本目录（可多选） */
    fromVersionDirs: zod_1.z.array(zod_1.z.string().min(1)).min(1).max(32),
    /** 新世界短名；省略则用源 short_name */
    shortName: pack_schema_1.communityShortNameSchema.optional(),
    description: zod_1.z.string().max(500).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
exports.packModerationPayloadSchema = zod_1.z.object({
    status: zod_1.z.enum(['normal', 'hidden']),
});
exports.packSetOfficialPayloadSchema = zod_1.z.object({
    isOfficial: zod_1.z.boolean(),
    /**
     * 取消官方时必填：归勺子后私密或公开（公开=现有版本全部共享）。
     * 设为官方时忽略。
     */
    afterCancel: zod_1.z.enum(['private', 'public']).optional(),
});
exports.packReactionPayloadSchema = zod_1.z.object({
    /** world = 赞/藏整个世界；version 时必须带 versionDir */
    target: zod_1.z.enum(['world', 'version']),
    kind: zod_1.z.enum(['like', 'favorite']).default('like'),
    versionDir: zod_1.z.string().min(1).optional(),
    active: zod_1.z.boolean(),
});
/** GET /packs/worlds?q=&sort= */
exports.packWorldListSortSchema = zod_1.z
    .enum(['default', 'likes', 'favorites', 'name'])
    .default('default');
exports.packWorldListQuerySchema = zod_1.z.object({
    q: zod_1.z.string().optional().default(''),
    sort: exports.packWorldListSortSchema,
});
exports.packTrashItemSchema = zod_1.z.object({
    world_id: pack_schema_1.communityWorldIdSchema,
    short_name: zod_1.z.string().min(1),
    owner_player_id: zod_1.z.string().nullable(),
    delete_scope: zod_1.z.enum(['user', 'admin']),
    deleted_at: zod_1.z.string().min(1),
    deleted_by: zod_1.z.string().min(1),
});
exports.packTrashListResponseSchema = zod_1.z.object({
    items: zod_1.z.array(exports.packTrashItemSchema),
});
exports.packSelectionSchema = zod_1.z.object({
    world_id: pack_schema_1.communityWorldIdSchema,
    pack_version_id: zod_1.z.string().min(1),
    /** true = 显式选用；false = 跟随全服测试默认 */
    is_explicit: zod_1.z.boolean(),
});
exports.packSelectPayloadSchema = zod_1.z.object({
    worldId: pack_schema_1.communityWorldIdSchema,
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
    spawn_position: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number(), zod_1.z.number()]),
    /** 相对 client/public；空或缺省 = 用 Humanoid */
    model_path: zod_1.z.string().optional(),
    /** 省略 = 开场即出场 */
    appear_from_chapter: pack_schema_1.packIdSchema.optional(),
    appear_require_flags: zod_1.z.array(zod_1.z.string()).default([]),
});
/** 当前玩家生效包的运行时摘要（进场用） */
exports.packRuntimeSchema = zod_1.z.object({
    selection: exports.packSelectionSchema,
    default_npc_id: pack_schema_1.packIdSchema,
    default_chapter: pack_schema_1.packIdSchema,
    chapters: zod_1.z.array(exports.packRuntimeChapterSchema),
    /** chapterId → 展示名（display_name 优先） */
    chapter_labels: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
    npcs: zod_1.z.array(exports.packRuntimeNpcSchema),
    /** 自动演结局选择器用（含 AP-3 可达性门控字段） */
    endings: zod_1.z
        .array(zod_1.z.object({
        id: pack_schema_1.packIdSchema,
        display_name: zod_1.z.string(),
        enabled: zod_1.z.boolean().default(true),
        chapter: pack_schema_1.packIdSchema.optional(),
        require_flags: zod_1.z.array(zod_1.z.string()).default([]),
        require_any_flags: zod_1.z.array(zod_1.z.string()).default([]),
        forbid_flags: zod_1.z.array(zod_1.z.string()).default([]),
        set_flags: zod_1.z
            .array(zod_1.z.object({
            name: zod_1.z.string(),
            value: zod_1.z.string().optional(),
        }))
            .default([]),
    }))
        .default([]),
    world_id: pack_schema_1.packIdSchema.optional(),
    display_name: zod_1.z.string().optional(),
    /** AP-2：Pack 默认自动演风格；开演可覆盖 */
    default_style_id: zod_1.z.string().min(1).max(64).optional(),
    /** AP-2：是否含可演出玩家位（旧包缺省 true） */
    playable_player_enabled: zod_1.z.boolean().default(true),
    playable_player_id: pack_schema_1.packIdSchema.optional(),
});
exports.packUpdatePayloadSchema = zod_1.z.object({
    pack: zod_1.z.unknown(),
});
/**
 * 一句话生成可勾选块（不含包头；未勾选则保留 basePack 对应内容）
 * 顺序按依赖：章节/Flags → NPC/结局 → 数值/动画 → 触发 → Prompt → 个人信息
 */
exports.packGenerateSectionKeys = [
    'chapters',
    'flags',
    'npcs',
    'endings',
    'numeric_tools',
    'animation_rules',
    'chapter_triggers',
    'npc_reply_flags',
    'prompt_common',
    'affinity_tiers',
    'fatigue_hints',
    'chapter_constraints',
    'flag_constraints',
    'pack_profile',
];
exports.packGenerateSectionsSchema = zod_1.z.object({
    chapters: zod_1.z.boolean(),
    flags: zod_1.z.boolean(),
    npcs: zod_1.z.boolean(),
    endings: zod_1.z.boolean(),
    numeric_tools: zod_1.z.boolean(),
    animation_rules: zod_1.z.boolean(),
    chapter_triggers: zod_1.z.boolean(),
    npc_reply_flags: zod_1.z.boolean(),
    prompt_common: zod_1.z.boolean(),
    affinity_tiers: zod_1.z.boolean(),
    fatigue_hints: zod_1.z.boolean(),
    chapter_constraints: zod_1.z.boolean(),
    flag_constraints: zod_1.z.boolean(),
    pack_profile: zod_1.z.boolean(),
});
exports.DEFAULT_PACK_GENERATE_SECTIONS = Object.fromEntries(exports.packGenerateSectionKeys.map((k) => [k, true]));
/** 生成进度展示名（弹窗 / 黄标） */
exports.PACK_GENERATE_SECTION_LABELS = {
    chapters: '世界·章节',
    flags: '世界·Flags',
    npcs: 'NPC',
    endings: '世界·结局',
    numeric_tools: '世界·数值工具',
    animation_rules: '世界·动画规则',
    chapter_triggers: '触发·章节触发',
    npc_reply_flags: '触发·回复置 Flag',
    prompt_common: 'Prompt·通用',
    affinity_tiers: 'Prompt·好感区间',
    fatigue_hints: 'Prompt·疲惫提示',
    chapter_constraints: 'Prompt·章节约束',
    flag_constraints: 'Prompt·Flag 约束',
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
        /** 首轮+重试后仍失败的块 */
        failedSections: zod_1.z
            .array(zod_1.z.object({
            section: zod_1.z.enum(exports.packGenerateSectionKeys),
            message: zod_1.z.string(),
        }))
            .optional(),
        /** 给人看的收尾总结 */
        summary: zod_1.z.string().optional(),
    }),
]);
/** 梗概/摘要上限；全文大纲用 outline 字段 */
exports.PACK_GENERATE_PROMPT_MAX = 8000;
/** 导入大纲全文上限 */
exports.PACK_GENERATE_OUTLINE_MAX = 50000;
/** 生成 Pack 草稿（不落盘）：摘要 + 可选导入大纲 */
exports.packGenerateDraftPayloadSchema = zod_1.z
    .object({
    /** 梗概或大纲摘要 */
    prompt: zod_1.z.string().trim().max(exports.PACK_GENERATE_PROMPT_MAX).default(''),
    /** 导入的完整大纲（与 prompt 分开，避免挤在摘要框） */
    outline: zod_1.z
        .string()
        .trim()
        .max(exports.PACK_GENERATE_OUTLINE_MAX)
        .optional(),
    /** 当前编辑中的包（保留 world_id / version_dir / header） */
    basePack: zod_1.z.unknown(),
    /** 省略则全部生成 */
    sections: exports.packGenerateSectionsSchema.optional(),
})
    .superRefine((data, ctx) => {
    const brief = data.prompt.trim();
    const outline = (data.outline ?? '').trim();
    if (brief.length < 4 && outline.length < 4) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: '请填写至少 4 字的梗概/摘要，或导入大纲全文',
            path: ['prompt'],
        });
    }
});
