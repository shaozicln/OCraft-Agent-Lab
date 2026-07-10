import { z } from 'zod';

/** 包内 ID：章节 / flag / NPC 等，由 Pack 声明，代码不写死业务枚举 */
export const packIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'id 仅允许字母数字、_、-');

export const packChapterSchema = z.object({
  id: packIdSchema,
  display_name: z.string(),
  /** HUD / 列表短文案 */
  hud_label: z.string().optional(),
  /** 升序：越大越靠后；只升不降用此比较 */
  rank: z.number().int().nonnegative(),
});

export const packFlagDefSchema = z.object({
  name: packIdSchema,
  /** bool：置位存 "true"；enum：存枚举字符串 */
  type: z.enum(['bool', 'enum']),
  description: z.string().optional(),
  /** type=enum 时的合法值，如 help|leave|silence */
  enum_values: z.array(z.string().min(1)).optional(),
  irreversible: z.boolean().default(true),
});

export const packMemorySchema = z.object({
  id: z.string().min(1),
  tags: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  content: z.string(),
  /** 解锁此记忆的最低章节 id；省略则视为最低章 */
  min_chapter: packIdSchema.optional(),
});

export const packNpcSchema = z.object({
  npc_id: packIdSchema,
  name: z.string(),
  meta: z.object({
    avatar: z.string(),
    model_path: z.string(),
    scale: z.tuple([z.number(), z.number(), z.number()]),
    spawn_position: z.tuple([z.number(), z.number(), z.number()]),
  }),
  attributes: z.object({
    fatigue: z.number(),
    max_fatigue: z.number(),
    affinity: z.number(),
    current_status: z.string(),
    favorite_things: z.array(z.string()),
    favorite_synonyms: z
      .record(z.string(), z.array(z.string()))
      .optional(),
  }),
  system_prompt_template: z.string(),
  memories: z.array(packMemorySchema).default([]),
});

export const packFlagSetEntrySchema = z.object({
  name: packIdSchema,
  value: z.string().min(1).default('true'),
});

export const packTriggerRuleSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().default(true),
  from_chapter: packIdSchema,
  to_chapter: packIdSchema.nullable(),
  min_affinity: z.number().default(0),
  max_fatigue: z.number().optional(),
  require_flags: z.array(packIdSchema).default([]),
  player_triggers: z.array(z.string()).default([]),
  set_flags: z.array(packFlagSetEntrySchema).default([]),
  notes: z.string().optional(),
});

export const packNpcReplyFlagRuleSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().default(true),
  when_chapter_in: z.array(packIdSchema).min(1),
  set_flag: packIdSchema,
  value: z.string().min(1).default('true'),
  triggers: z.array(z.string()).default([]),
});

export const packTriggersFileSchema = z.object({
  version: z.number().int().positive().default(1),
  rules: z.array(packTriggerRuleSchema),
  npc_reply_flag_rules: z.array(packNpcReplyFlagRuleSchema).default([]),
});

/** 好感区间文案：affinity < max_exclusive 时命中（最后一档用极大 max） */
export const packAffinityTierSchema = z.object({
  max_exclusive: z.number(),
  text: z.string(),
});

/** 疲惫提示：fatigue >= min 时命中，按 min 降序匹配第一条 */
export const packFatigueHintSchema = z.object({
  min: z.number(),
  text: z.string(),
});

/**
 * Flag 约束条件（解释器求值）
 * - flag + set:true  → 已置位
 * - flag + set:false → 未置位
 * - chapter / chapter_not 可选收窄
 */
export const packFlagConstraintWhenSchema = z.object({
  flag: packIdSchema,
  set: z.boolean(),
  chapter: packIdSchema.optional(),
  chapter_not: packIdSchema.optional(),
});

export const packFlagConstraintSchema = z.object({
  id: z.string().min(1),
  when: packFlagConstraintWhenSchema,
  text: z.string(),
});

export const packPromptsFileSchema = z.object({
  affinity_tiers: z.array(packAffinityTierSchema).min(1),
  fatigue_hints: z.array(packFatigueHintSchema).min(1),
  /** chapterId → 约束正文 */
  chapter_constraints: z.record(z.string(), z.string()),
  flag_constraints: z.array(packFlagConstraintSchema).default([]),
  /** 拼在记忆后的通用回复要求 */
  reply_instruction: z
    .string()
    .default(
      '请用中文、口语化、符合人设地回复玩家。回复控制在 2-4 句话。',
    ),
});

export const packNumericToolsSchema = z.object({
  fatigue_increase: z.object({
    triggers: z.array(z.string()),
    delta: z.number(),
    reason: z.string(),
  }),
  /** 命中 NPC favorite 时：好感 delta + 疲惫 delta */
  interest_hit: z.object({
    affinity_delta: z.number(),
    affinity_reason: z.string(),
    fatigue_delta: z.number(),
    fatigue_reason: z.string(),
  }),
});

/** 第一期支持的动画状态（与前端 Humanoid 一致） */
export const packAnimationIdSchema = z.enum([
  'idle',
  'sleeping',
  'talk',
  'excited_talk',
]);

/**
 * 动画规则条件（按规则数组顺序，先命中先生效）
 * - fatigue_delta_gt / lt：本轮 updateFatigue 的 delta 合计
 * - message_triggers：玩家消息包含任一词
 * - interest_hit：命中 NPC favorite / synonyms
 * - current_status：当前动画状态等于该值
 */
export const packAnimationRuleWhenSchema = z.object({
  fatigue_delta_gt: z.number().optional(),
  fatigue_delta_lt: z.number().optional(),
  message_triggers: z.array(z.string()).optional(),
  interest_hit: z.boolean().optional(),
  current_status: z.string().optional(),
});

export const packAnimationRuleSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().default(true),
  when: packAnimationRuleWhenSchema,
  animation: packAnimationIdSchema,
});

export const packEndingSchema = z.object({
  id: packIdSchema,
  display_name: z.string(),
  /** 第一期仅占位；P3 再解释条件 */
  notes: z.string().optional(),
  performance_hint: z.string().optional(),
});

export const packWorldFileSchema = z.object({
  chapters: z.array(packChapterSchema).min(1),
  flags: z.array(packFlagDefSchema).min(1),
  /** 新进度默认章节 = chapters 中 rank 最小者，可显式覆盖 */
  default_chapter: packIdSchema.optional(),
  /** 进场默认 NPC；省略则取 npcs[0] */
  default_npc: packIdSchema.optional(),
  numeric_tools: packNumericToolsSchema,
  /** 玩家消息 / 数值变化 → 动画；空则保持当前状态 */
  animation_rules: z.array(packAnimationRuleSchema).default([]),
  endings: z.array(packEndingSchema).default([]),
});

export const packHeaderSchema = z.object({
  schema_version: z.number().int().positive(),
  world_id: packIdSchema,
  /** 版本名（不含时间戳）；目录为 版本名__时间戳 */
  display_name: z.string().min(1),
  /** ISO 或 yyyyMMddTHHmm */
  created_at: z.string().min(1),
  notes: z.string().optional(),
});

export const worldManifestSchema = z.object({
  world_id: packIdSchema,
  /** versions/ 下的目录名（含 __时间戳） */
  official_version_dir: z.string().min(1),
  description: z.string().optional(),
});

/** 内存中组装后的完整 Pack（校验交叉引用后） */
export const storyPackSchema = z.object({
  header: packHeaderSchema,
  world: packWorldFileSchema,
  triggers: packTriggersFileSchema,
  prompts: packPromptsFileSchema,
  npcs: z.array(packNpcSchema).min(1),
  /** 磁盘版本目录名，如 默认MVP__20260710T1045 */
  version_dir: z.string().min(1),
});

export type PackChapter = z.infer<typeof packChapterSchema>;
export type PackFlagDef = z.infer<typeof packFlagDefSchema>;
export type PackMemory = z.infer<typeof packMemorySchema>;
export type PackNpc = z.infer<typeof packNpcSchema>;
export type PackTriggerRule = z.infer<typeof packTriggerRuleSchema>;
export type PackNpcReplyFlagRule = z.infer<typeof packNpcReplyFlagRuleSchema>;
export type PackTriggersFile = z.infer<typeof packTriggersFileSchema>;
export type PackAffinityTier = z.infer<typeof packAffinityTierSchema>;
export type PackFatigueHint = z.infer<typeof packFatigueHintSchema>;
export type PackFlagConstraintWhen = z.infer<typeof packFlagConstraintWhenSchema>;
export type PackFlagConstraint = z.infer<typeof packFlagConstraintSchema>;
export type PackPromptsFile = z.infer<typeof packPromptsFileSchema>;
export type PackNumericTools = z.infer<typeof packNumericToolsSchema>;
export type PackAnimationId = z.infer<typeof packAnimationIdSchema>;
export type PackAnimationRuleWhen = z.infer<typeof packAnimationRuleWhenSchema>;
export type PackAnimationRule = z.infer<typeof packAnimationRuleSchema>;
export type PackEnding = z.infer<typeof packEndingSchema>;
export type PackWorldFile = z.infer<typeof packWorldFileSchema>;
export type PackHeader = z.infer<typeof packHeaderSchema>;
export type WorldManifest = z.infer<typeof worldManifestSchema>;
export type StoryPack = z.infer<typeof storyPackSchema>;

/** 交叉校验：触发/记忆/约束引用的章节与 flag 必须在 world 中声明 */
export function assertPackReferences(pack: StoryPack): void {
  const chapterIds = new Set(pack.world.chapters.map((c) => c.id));
  const flagNames = new Set(pack.world.flags.map((f) => f.name));

  const needChapter = (id: string, ctx: string) => {
    if (!chapterIds.has(id)) {
      throw new Error(`Pack 引用未知章节 "${id}" @ ${ctx}`);
    }
  };
  const needFlag = (name: string, ctx: string) => {
    if (!flagNames.has(name)) {
      throw new Error(`Pack 引用未知 flag "${name}" @ ${ctx}`);
    }
  };

  if (pack.world.default_chapter) {
    needChapter(pack.world.default_chapter, 'world.default_chapter');
  }

  if (pack.world.default_npc) {
    if (!pack.npcs.some((n) => n.npc_id === pack.world.default_npc)) {
      throw new Error(
        `Pack 引用未知 NPC "${pack.world.default_npc}" @ world.default_npc`,
      );
    }
  }

  for (const [ch] of Object.entries(pack.prompts.chapter_constraints)) {
    needChapter(ch, 'prompts.chapter_constraints');
  }

  for (const rule of pack.triggers.rules) {
    needChapter(rule.from_chapter, `triggers.rules.${rule.id}`);
    if (rule.to_chapter) {
      needChapter(rule.to_chapter, `triggers.rules.${rule.id}`);
    }
    for (const f of rule.require_flags) {
      needFlag(f, `triggers.rules.${rule.id}.require`);
    }
    for (const f of rule.set_flags) {
      needFlag(f.name, `triggers.rules.${rule.id}.set`);
    }
  }

  for (const rule of pack.triggers.npc_reply_flag_rules) {
    for (const ch of rule.when_chapter_in) {
      needChapter(ch, `npc_reply.${rule.id}`);
    }
    needFlag(rule.set_flag, `npc_reply.${rule.id}`);
  }

  for (const fc of pack.prompts.flag_constraints) {
    needFlag(fc.when.flag, `flag_constraints.${fc.id}`);
    if (fc.when.chapter) {
      needChapter(fc.when.chapter, `flag_constraints.${fc.id}`);
    }
    if (fc.when.chapter_not) {
      needChapter(fc.when.chapter_not, `flag_constraints.${fc.id}`);
    }
  }

  for (const npc of pack.npcs) {
    for (const mem of npc.memories) {
      if (mem.min_chapter) {
        needChapter(mem.min_chapter, `npc.${npc.npc_id}.mem.${mem.id}`);
      }
    }
  }

  for (const flag of pack.world.flags) {
    if (flag.type === 'enum' && (!flag.enum_values || flag.enum_values.length === 0)) {
      throw new Error(`enum flag "${flag.name}" 缺少 enum_values`);
    }
  }
}

export function getDefaultChapterId(pack: StoryPack): string {
  if (pack.world.default_chapter) return pack.world.default_chapter;
  const sorted = [...pack.world.chapters].sort((a, b) => a.rank - b.rank);
  return sorted[0].id;
}

export function getDefaultNpcId(pack: StoryPack): string {
  if (pack.world.default_npc) return pack.world.default_npc;
  return pack.npcs[0].npc_id;
}

export function getChapterRankMap(pack: StoryPack): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of pack.world.chapters) {
    map[c.id] = c.rank;
  }
  return map;
}

/** chapterId → HUD / 列表显示名（优先 hud_label） */
export function getChapterLabelMap(pack: StoryPack): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of pack.world.chapters) {
    map[c.id] = c.hud_label || c.display_name || c.id;
  }
  return map;
}
