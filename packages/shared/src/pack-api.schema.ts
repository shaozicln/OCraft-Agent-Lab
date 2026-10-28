import { z } from 'zod';
import {
  communityShortNameSchema,
  communityWorldIdSchema,
  packIdSchema,
} from './pack.schema';

export const packVersionSummarySchema = z.object({
  world_id: communityWorldIdSchema,
  /** versions/ 下文件夹名：版本名__时间戳 */
  version_dir: z.string().min(1),
  /** 版本名（不含时间戳），来自 pack.json；列表主展示用 version_dir */
  version_name: z.string().min(1),
  created_at: z.string().min(1),
  notes: z.string().optional(),
  /** 是否为当前全服测试默认版本（manifest 指针） */
  is_official: z.boolean(),
  /** 版本是否对社区共享 */
  is_shared: z.boolean().optional().default(false),
  /** 是否当前玩家拥有 */
  is_owner: z.boolean().optional().default(false),
  /** 审核：normal | hidden */
  moderation: z.enum(['normal', 'hidden']).optional().default('normal'),
  like_count: z.number().int().nonnegative().optional().default(0),
  favorite_count: z.number().int().nonnegative().optional().default(0),
  liked_by_me: z.boolean().optional().default(false),
  favorited_by_me: z.boolean().optional().default(false),
});

export const packWorldSummarySchema = z.object({
  world_id: communityWorldIdSchema,
  /** 展示短名（可跨作者重名）；缺省等于 world_id */
  short_name: z.string().min(1).optional(),
  description: z.string().optional(),
  official_version_dir: z.string().min(1),
  versions: z.array(packVersionSummarySchema),
  owner_player_id: z.string().nullable().optional(),
  owner_username: z.string().nullable().optional(),
  is_official_world: z.boolean().optional().default(false),
  is_shared: z.boolean().optional().default(false),
  is_owner: z.boolean().optional().default(false),
  moderation: z.enum(['normal', 'hidden']).optional().default('normal'),
  forked_from_world_id: z.string().nullable().optional(),
  forked_from_version_dirs: z.array(z.string()).nullable().optional(),
  /** @deprecated 兼容旧字段；用 forked_from_version_dirs */
  forked_from_version_dir: z.string().nullable().optional(),
  like_count: z.number().int().nonnegative().optional().default(0),
  favorite_count: z.number().int().nonnegative().optional().default(0),
  liked_by_me: z.boolean().optional().default(false),
  favorited_by_me: z.boolean().optional().default(false),
});

export const packSeedPayloadSchema = z.object({
  worldId: communityWorldIdSchema,
  versionDir: z.string().min(1),
});

export const packSaveAsPayloadSchema = z.object({
  worldId: communityWorldIdSchema,
  /** 源版本目录名；省略则用当前测试版 */
  fromVersionDir: z.string().min(1).optional(),
  /** 版本名（不含时间戳）→ 生成 版本名__时间戳 */
  versionName: z.string().trim().min(1).max(64),
  notes: z.string().max(500).optional(),
  /** true = 清空文案仅保留结构 */
  blankContent: z.boolean().optional(),
});

/**
 * 新建世界。
 * - shortName：展示短名（可与他人重名）；服务端生成唯一 world_id = u{uid}_{shortName}
 * - worldId：兼容旧客户端；若传入且无 shortName，则按短名处理（非管理员不可占用 office/awaken）
 */
export const packCreateWorldPayloadSchema = z.object({
  worldId: communityWorldIdSchema.optional(),
  shortName: communityShortNameSchema.optional(),
  /** 首个版本名；省略则用 shortName / worldId */
  versionName: z.string().trim().min(1).max(64).optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
}).superRefine((data, ctx) => {
  if (!data.shortName && !data.worldId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '请提供 shortName 或 worldId',
      path: ['shortName'],
    });
  }
});
export type PackCreateWorldPayload = z.infer<typeof packCreateWorldPayloadSchema>;

export const packShareWorldPayloadSchema = z.object({
  isShared: z.boolean(),
  /** 开启世界共享时，若尚无共享版本，可指定先共享的版本目录 */
  ensureVersionDir: z.string().min(1).optional(),
});
export type PackShareWorldPayload = z.infer<typeof packShareWorldPayloadSchema>;

export const packShareVersionPayloadSchema = z.object({
  isShared: z.boolean(),
});
export type PackShareVersionPayload = z.infer<typeof packShareVersionPayloadSchema>;

export const packForkPayloadSchema = z.object({
  fromWorldId: communityWorldIdSchema,
  /** 要拷贝的版本目录（可多选） */
  fromVersionDirs: z.array(z.string().min(1)).min(1).max(32),
  /** 新世界短名；省略则用源 short_name */
  shortName: communityShortNameSchema.optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});
export type PackForkPayload = z.infer<typeof packForkPayloadSchema>;

export const packModerationPayloadSchema = z.object({
  status: z.enum(['normal', 'hidden']),
});
export type PackModerationPayload = z.infer<typeof packModerationPayloadSchema>;

export const packSetOfficialPayloadSchema = z.object({
  isOfficial: z.boolean(),
  /**
   * 取消官方时必填：归勺子后私密或公开（公开=现有版本全部共享）。
   * 设为官方时忽略。
   */
  afterCancel: z.enum(['private', 'public']).optional(),
});
export type PackSetOfficialPayload = z.infer<typeof packSetOfficialPayloadSchema>;

export const packReactionPayloadSchema = z.object({
  /** world = 赞/藏整个世界；version 时必须带 versionDir */
  target: z.enum(['world', 'version']),
  kind: z.enum(['like', 'favorite']).default('like'),
  versionDir: z.string().min(1).optional(),
  active: z.boolean(),
});
export type PackReactionPayload = z.infer<typeof packReactionPayloadSchema>;

/** GET /packs/worlds?q=&sort= */
export const packWorldListSortSchema = z
  .enum(['default', 'likes', 'favorites', 'name'])
  .default('default');
export type PackWorldListSort = z.infer<typeof packWorldListSortSchema>;

export const packWorldListQuerySchema = z.object({
  q: z.string().optional().default(''),
  sort: packWorldListSortSchema,
});
export type PackWorldListQuery = z.infer<typeof packWorldListQuerySchema>;

export const packTrashItemSchema = z.object({
  world_id: communityWorldIdSchema,
  short_name: z.string().min(1),
  owner_player_id: z.string().nullable(),
  delete_scope: z.enum(['user', 'admin']),
  deleted_at: z.string().min(1),
  deleted_by: z.string().min(1),
});
export type PackTrashItem = z.infer<typeof packTrashItemSchema>;

export const packTrashListResponseSchema = z.object({
  items: z.array(packTrashItemSchema),
});
export type PackTrashListResponse = z.infer<typeof packTrashListResponseSchema>;

export const packSelectionSchema = z.object({
  world_id: communityWorldIdSchema,
  pack_version_id: z.string().min(1),
  /** true = 显式选用；false = 跟随全服测试默认 */
  is_explicit: z.boolean(),
});

export const packSelectPayloadSchema = z.object({
  worldId: communityWorldIdSchema,
  packVersionId: z.string().min(1),
});

export const packRuntimeChapterSchema = z.object({
  id: packIdSchema,
  display_name: z.string().min(1),
  hud_label: z.string().min(1).optional(),
  rank: z.number().int().nonnegative(),
});

export const packRuntimeNpcSchema = z.object({
  npc_id: packIdSchema,
  name: z.string().min(1),
  spawn_position: z.tuple([z.number(), z.number(), z.number()]),
  /** 相对 client/public；空或缺省 = 用 Humanoid */
  model_path: z.string().optional(),
  /** 省略 = 开场即出场 */
  appear_from_chapter: packIdSchema.optional(),
  appear_require_flags: z.array(z.string()).default([]),
});

/** 当前玩家生效包的运行时摘要（进场用） */
export const packRuntimeSchema = z.object({
  selection: packSelectionSchema,
  default_npc_id: packIdSchema,
  default_chapter: packIdSchema,
  chapters: z.array(packRuntimeChapterSchema),
  /** chapterId → 展示名（display_name 优先） */
  chapter_labels: z.record(z.string(), z.string()),
  npcs: z.array(packRuntimeNpcSchema),
  /** 自动演结局选择器用（含 AP-3 可达性门控字段） */
  endings: z
    .array(
      z.object({
        id: packIdSchema,
        display_name: z.string(),
        enabled: z.boolean().default(true),
        chapter: packIdSchema.optional(),
        require_flags: z.array(z.string()).default([]),
        require_any_flags: z.array(z.string()).default([]),
        forbid_flags: z.array(z.string()).default([]),
        set_flags: z
          .array(
            z.object({
              name: z.string(),
              value: z.string().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  world_id: packIdSchema.optional(),
  display_name: z.string().optional(),
  /** AP-2：Pack 默认自动演风格；开演可覆盖 */
  default_style_id: z.string().min(1).max(64).optional(),
  /** AP-2：是否含可演出玩家位（旧包缺省 true） */
  playable_player_enabled: z.boolean().default(true),
  playable_player_id: packIdSchema.optional(),
});

export type PackVersionSummary = z.infer<typeof packVersionSummarySchema>;
export type PackWorldSummary = z.infer<typeof packWorldSummarySchema>;
export type PackSeedPayload = z.infer<typeof packSeedPayloadSchema>;
export type PackSaveAsPayload = z.infer<typeof packSaveAsPayloadSchema>;
export type PackSelection = z.infer<typeof packSelectionSchema>;
export type PackSelectPayload = z.infer<typeof packSelectPayloadSchema>;
export type PackRuntime = z.infer<typeof packRuntimeSchema>;

export const packUpdatePayloadSchema = z.object({
  pack: z.unknown(),
});
export type PackUpdatePayload = z.infer<typeof packUpdatePayloadSchema>;

/**
 * 一句话生成可勾选块（不含包头；未勾选则保留 basePack 对应内容）
 * 顺序按依赖：章节/Flags → NPC/结局 → 数值/动画 → 触发 → Prompt → 个人信息
 */
export const packGenerateSectionKeys = [
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
] as const;

export type PackGenerateSectionKey = (typeof packGenerateSectionKeys)[number];

export const packGenerateSectionsSchema = z.object({
  chapters: z.boolean(),
  flags: z.boolean(),
  npcs: z.boolean(),
  endings: z.boolean(),
  numeric_tools: z.boolean(),
  animation_rules: z.boolean(),
  chapter_triggers: z.boolean(),
  npc_reply_flags: z.boolean(),
  prompt_common: z.boolean(),
  affinity_tiers: z.boolean(),
  fatigue_hints: z.boolean(),
  chapter_constraints: z.boolean(),
  flag_constraints: z.boolean(),
  pack_profile: z.boolean(),
});
export type PackGenerateSections = z.infer<typeof packGenerateSectionsSchema>;

export const DEFAULT_PACK_GENERATE_SECTIONS: PackGenerateSections =
  Object.fromEntries(
    packGenerateSectionKeys.map((k) => [k, true]),
  ) as PackGenerateSections;

/** 生成进度展示名（弹窗 / 黄标） */
export const PACK_GENERATE_SECTION_LABELS: Record<
  PackGenerateSectionKey,
  string
> = {
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
export const packGenerateStreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('section_start'),
    section: z.enum(packGenerateSectionKeys),
    label: z.string(),
  }),
  z.object({
    type: z.literal('section_done'),
    section: z.enum(packGenerateSectionKeys),
    label: z.string(),
    /** 当前合并后的草稿（便于前端即时刷新编辑器） */
    pack: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('error'),
    section: z.enum(packGenerateSectionKeys).optional(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('done'),
    source: z.enum(['llm', 'mock']),
    pack: z.unknown(),
    profileFields: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          value: z.string(),
        }),
      )
      .optional(),
    /** 首轮+重试后仍失败的块 */
    failedSections: z
      .array(
        z.object({
          section: z.enum(packGenerateSectionKeys),
          message: z.string(),
        }),
      )
      .optional(),
    /** 给人看的收尾总结 */
    summary: z.string().optional(),
  }),
]);
export type PackGenerateStreamEvent = z.infer<
  typeof packGenerateStreamEventSchema
>;

/** 梗概/摘要上限；全文大纲用 outline 字段 */
export const PACK_GENERATE_PROMPT_MAX = 8000;
/** 导入大纲全文上限 */
export const PACK_GENERATE_OUTLINE_MAX = 50000;

/** 生成 Pack 草稿（不落盘）：摘要 + 可选导入大纲 */
export const packGenerateDraftPayloadSchema = z
  .object({
    /** 梗概或大纲摘要 */
    prompt: z.string().trim().max(PACK_GENERATE_PROMPT_MAX).default(''),
    /** 导入的完整大纲（与 prompt 分开，避免挤在摘要框） */
    outline: z
      .string()
      .trim()
      .max(PACK_GENERATE_OUTLINE_MAX)
      .optional(),
    /** 当前编辑中的包（保留 world_id / version_dir / header） */
    basePack: z.unknown(),
    /** 省略则全部生成 */
    sections: packGenerateSectionsSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const brief = data.prompt.trim();
    const outline = (data.outline ?? '').trim();
    if (brief.length < 4 && outline.length < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请填写至少 4 字的梗概/摘要，或导入大纲全文',
        path: ['prompt'],
      });
    }
  });
export type PackGenerateDraftPayload = z.infer<
  typeof packGenerateDraftPayloadSchema
>;
