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

/** 新建世界：world_id = 文件夹名；首版版本名默认等于 worldId */
export const packCreateWorldPayloadSchema = z.object({
  worldId: packIdSchema,
  /** 首个版本名；省略则用 worldId */
  versionName: z.string().trim().min(1).max(64).optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  fromWorldId: packIdSchema.optional(),
  fromVersionDir: z.string().min(1).optional(),
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
});

/** 当前玩家生效包的运行时摘要（进场用） */
export const packRuntimeSchema = z.object({
  selection: packSelectionSchema,
  default_npc_id: packIdSchema,
  default_chapter: packIdSchema,
  chapters: z.array(packRuntimeChapterSchema),
  /** chapterId → 展示名（hud_label 优先） */
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
