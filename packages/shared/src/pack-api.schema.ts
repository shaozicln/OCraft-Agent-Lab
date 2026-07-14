import { z } from 'zod';
import { packIdSchema } from './pack.schema';

export const packVersionSummarySchema = z.object({
  world_id: packIdSchema,
  /** versions/ 下文件夹名：版本名__时间戳 */
  version_dir: z.string().min(1),
  /** 版本名（不含时间戳），来自 pack.json；列表主展示用 version_dir */
  version_name: z.string().min(1),
  created_at: z.string().min(1),
  notes: z.string().optional(),
  /** 是否为当前全服测试默认 */
  is_official: z.boolean(),
});

export const packWorldSummarySchema = z.object({
  world_id: packIdSchema,
  description: z.string().optional(),
  official_version_dir: z.string().min(1),
  versions: z.array(packVersionSummarySchema),
});

export const packSeedPayloadSchema = z.object({
  worldId: packIdSchema,
  versionDir: z.string().min(1),
});

export const packSaveAsPayloadSchema = z.object({
  worldId: packIdSchema,
  /** 源版本目录名；省略则用当前测试版 */
  fromVersionDir: z.string().min(1).optional(),
  /** 版本名（不含时间戳）→ 生成 版本名__时间戳 */
  versionName: z.string().trim().min(1).max(64),
  notes: z.string().max(500).optional(),
  /** true = 清空文案仅保留结构 */
  blankContent: z.boolean().optional(),
});

/** 新建世界：world_id = 文件夹名；首版版本名默认等于 worldId（极简空壳） */
export const packCreateWorldPayloadSchema = z.object({
  worldId: packIdSchema,
  /** 首个版本名；省略则用 worldId */
  versionName: z.string().trim().min(1).max(64).optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});
export type PackCreateWorldPayload = z.infer<typeof packCreateWorldPayloadSchema>;

export const packSelectionSchema = z.object({
  world_id: packIdSchema,
  pack_version_id: z.string().min(1),
  /** true = 显式选用；false = 跟随全服测试默认 */
  is_explicit: z.boolean(),
});

export const packSelectPayloadSchema = z.object({
  worldId: packIdSchema,
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
