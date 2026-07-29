"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storyPackSchema = exports.worldManifestSchema = exports.packHeaderSchema = exports.packWorldFileSchema = exports.packEndingSchema = exports.packAnimationRuleSchema = exports.packAnimationRuleWhenSchema = exports.packAnimationIdSchema = exports.packNumericToolsSchema = exports.packPromptsFileSchema = exports.packFlagConstraintSchema = exports.packFlagConstraintWhenSchema = exports.packFatigueHintSchema = exports.packAffinityTierSchema = exports.packTriggersFileSchema = exports.packExchangeEventSchema = exports.packNpcReplyFlagRuleSchema = exports.packTriggerRuleSchema = exports.packFlagSetEntrySchema = exports.packNpcSchema = exports.packMemorySchema = exports.packFlagDefSchema = exports.packChapterSchema = exports.packIdSchema = void 0;
exports.assertPackReferences = assertPackReferences;
exports.getDefaultChapterId = getDefaultChapterId;
exports.getFirstChapterId = getFirstChapterId;
exports.getDefaultNpcId = getDefaultNpcId;
exports.getChapterRankMap = getChapterRankMap;
exports.getChapterLabelMap = getChapterLabelMap;
exports.isNpcPresent = isNpcPresent;
const zod_1 = require("zod");
const chapter_util_1 = require("./chapter.util");
const story_schema_1 = require("./story.schema");
/** 包内 ID：章节 / flag / NPC 等，由 Pack 声明，代码不写死业务枚举 */
exports.packIdSchema = zod_1.z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, 'id 仅允许字母数字、_、-');
exports.packChapterSchema = zod_1.z.object({
    id: exports.packIdSchema,
    display_name: zod_1.z.string(),
    /** HUD / 列表短文案 */
    hud_label: zod_1.z.string().optional(),
    /** 升序：越大越靠后；只升不降用此比较 */
    rank: zod_1.z.number().int().nonnegative(),
});
exports.packFlagDefSchema = zod_1.z.object({
    name: exports.packIdSchema,
    /** bool：置位存 "true"；enum：存枚举字符串 */
    type: zod_1.z.enum(['bool', 'enum']),
    description: zod_1.z.string().optional(),
    /** type=enum 时的合法值，如 help|leave|silence */
    enum_values: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    irreversible: zod_1.z.boolean().default(true),
});
exports.packMemorySchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    keywords: zod_1.z.array(zod_1.z.string()).default([]),
    content: zod_1.z.string(),
    /** 解锁此记忆的最低章节 id；省略则视为最低章 */
    min_chapter: exports.packIdSchema.optional(),
});
exports.packNpcSchema = zod_1.z.object({
    npc_id: exports.packIdSchema,
    name: zod_1.z.string(),
    meta: zod_1.z.object({
        avatar: zod_1.z.string(),
        model_path: zod_1.z.string(),
        scale: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number(), zod_1.z.number()]),
        spawn_position: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number(), zod_1.z.number()]),
    }),
    attributes: zod_1.z.object({
        fatigue: zod_1.z.number(),
        max_fatigue: zod_1.z.number(),
        affinity: zod_1.z.number(),
        current_status: zod_1.z.string(),
        favorite_things: zod_1.z.array(zod_1.z.string()),
        favorite_synonyms: zod_1.z
            .record(zod_1.z.string(), zod_1.z.array(zod_1.z.string()))
            .optional(),
    }),
    system_prompt_template: zod_1.z.string(),
    memories: zod_1.z.array(exports.packMemorySchema).default([]),
    /**
     * CD-B：人设禁忌 → 运行时 safety 指纹源（可选；缺省 [] 兼容旧 Pack）。
     * 蒸馏 apply 会写入；也可在编辑器手改。
     */
    forbidden_behaviors: zod_1.z.array(zod_1.z.string().trim().min(1).max(200)).max(24).default([]),
    /**
     * 场景出场：当前章节 rank ≥ 该章，且 require_flags 均已置位时才刷小人。
     * 省略 appear_from_chapter = 开场即在。
     */
    appear_from_chapter: exports.packIdSchema.optional(),
    appear_require_flags: zod_1.z.array(exports.packIdSchema).default([]),
});
exports.packFlagSetEntrySchema = zod_1.z.object({
    name: exports.packIdSchema,
    value: zod_1.z.string().min(1).default('true'),
});
exports.packTriggerRuleSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    enabled: zod_1.z.boolean().default(true),
    from_chapter: exports.packIdSchema,
    to_chapter: exports.packIdSchema.nullable(),
    min_affinity: zod_1.z.number().default(0),
    max_fatigue: zod_1.z.number().optional(),
    require_flags: zod_1.z.array(exports.packIdSchema).default([]),
    player_triggers: zod_1.z.array(zod_1.z.string()).default([]),
    set_flags: zod_1.z.array(exports.packFlagSetEntrySchema).default([]),
    notes: zod_1.z.string().optional(),
});
exports.packNpcReplyFlagRuleSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    enabled: zod_1.z.boolean().default(true),
    when_chapter_in: zod_1.z.array(exports.packIdSchema).min(1),
    set_flag: exports.packIdSchema,
    value: zod_1.z.string().min(1).default('true'),
    triggers: zod_1.z.array(zod_1.z.string()).default([]),
});
/**
 * 关系事件互聊：玩家对话结束后，章/flag 满足且（once 时）set_flags 尚未置位 →
 * speakers 有序各跑一轮 LLM（不对玩家、不升章）。
 */
exports.packExchangeEventSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    enabled: zod_1.z.boolean().default(true),
    /** 当前进度章节须等于该章 */
    chapter: exports.packIdSchema,
    require_flags: zod_1.z.array(exports.packIdSchema).default([]),
    /** 有序发言 NPC（P0 固定两人） */
    speakers: zod_1.z.tuple([exports.packIdSchema, exports.packIdSchema]),
    /** 软剧本提示，非逐字稿 */
    beat_hints: zod_1.z.array(zod_1.z.string()).default([]),
    /**
     * 与 speakers 对齐的保底短句；LLM 护栏失败时使用。
     * 长度可为 0～speakers.length。
     */
    fallback_lines: zod_1.z.array(zod_1.z.string()).default([]),
    set_flags: zod_1.z.array(exports.packFlagSetEntrySchema).default([]),
    /**
     * true（默认）：若 set_flags 中任一 flag 已置位则不再触发（一次）。
     */
    once: zod_1.z.boolean().default(true),
    notes: zod_1.z.string().optional(),
});
exports.packTriggersFileSchema = zod_1.z.object({
    version: zod_1.z.number().int().positive().default(1),
    rules: zod_1.z.array(exports.packTriggerRuleSchema),
    npc_reply_flag_rules: zod_1.z.array(exports.packNpcReplyFlagRuleSchema).default([]),
    exchange_events: zod_1.z.array(exports.packExchangeEventSchema).default([]),
});
/** 好感区间文案：affinity < max_exclusive 时命中（最后一档用极大 max） */
exports.packAffinityTierSchema = zod_1.z.object({
    max_exclusive: zod_1.z.number(),
    text: zod_1.z.string(),
});
/** 疲惫提示：fatigue >= min 时命中，按 min 降序匹配第一条 */
exports.packFatigueHintSchema = zod_1.z.object({
    min: zod_1.z.number(),
    text: zod_1.z.string(),
});
/**
 * Flag 约束条件（解释器求值）
 * - flag + set:true  → 已置位
 * - flag + set:false → 未置位
 * - chapter / chapter_not 可选收窄
 */
exports.packFlagConstraintWhenSchema = zod_1.z.object({
    flag: exports.packIdSchema,
    set: zod_1.z.boolean(),
    chapter: exports.packIdSchema.optional(),
    chapter_not: exports.packIdSchema.optional(),
});
exports.packFlagConstraintSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    when: exports.packFlagConstraintWhenSchema,
    text: zod_1.z.string(),
});
exports.packPromptsFileSchema = zod_1.z.object({
    affinity_tiers: zod_1.z.array(exports.packAffinityTierSchema).min(1),
    fatigue_hints: zod_1.z.array(exports.packFatigueHintSchema).min(1),
    /** chapterId → 约束正文 */
    chapter_constraints: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
    flag_constraints: zod_1.z.array(exports.packFlagConstraintSchema).default([]),
    /** 拼在记忆后的通用回复要求 */
    reply_instruction: zod_1.z
        .string()
        .default('请用中文、口语化、符合人设地回复玩家。回复控制在 2-4 句话。'),
});
exports.packNumericToolsSchema = zod_1.z.object({
    fatigue_increase: zod_1.z.object({
        triggers: zod_1.z.array(zod_1.z.string()),
        delta: zod_1.z.number(),
        reason: zod_1.z.string(),
    }),
    /** 命中 NPC favorite 时：好感 delta + 疲惫 delta */
    interest_hit: zod_1.z.object({
        affinity_delta: zod_1.z.number(),
        affinity_reason: zod_1.z.string(),
        fatigue_delta: zod_1.z.number(),
        fatigue_reason: zod_1.z.string(),
    }),
});
/** 第一期支持的动画状态（与前端 Humanoid 一致） */
exports.packAnimationIdSchema = zod_1.z.enum([
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
exports.packAnimationRuleWhenSchema = zod_1.z.object({
    fatigue_delta_gt: zod_1.z.number().optional(),
    fatigue_delta_lt: zod_1.z.number().optional(),
    message_triggers: zod_1.z.array(zod_1.z.string()).optional(),
    interest_hit: zod_1.z.boolean().optional(),
    current_status: zod_1.z.string().optional(),
});
exports.packAnimationRuleSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    enabled: zod_1.z.boolean().default(true),
    when: exports.packAnimationRuleWhenSchema,
    animation: exports.packAnimationIdSchema,
});
exports.packEndingSchema = zod_1.z.object({
    id: exports.packIdSchema,
    display_name: zod_1.z.string(),
    notes: zod_1.z.string().optional(),
    performance_hint: zod_1.z.string().optional(),
    /** false 时跳过结算 */
    enabled: zod_1.z.boolean().default(true),
    /** 须处于该章才可结算；省略则不限章 */
    chapter: exports.packIdSchema.optional(),
    /** 全部须已置 */
    require_flags: zod_1.z.array(exports.packIdSchema).default([]),
    /** 至少一个已置（可与 require_flags 并用） */
    require_any_flags: zod_1.z.array(exports.packIdSchema).default([]),
    /** 全部须未置 */
    forbid_flags: zod_1.z.array(exports.packIdSchema).default([]),
    /**
     * 玩家句命中关键词；空数组 = 仅靠 flag/章条件（适合乙/丙自动结算）。
     * 非空时须本轮玩家句命中至少一词。
     */
    player_triggers: zod_1.z.array(zod_1.z.string()).default([]),
    /** 结算时写入（通常含 ending_*） */
    set_flags: zod_1.z.array(exports.packFlagSetEntrySchema).default([]),
    /** 结算时清除（如结局甲清 silvie_dead） */
    clear_flags: zod_1.z.array(exports.packIdSchema).default([]),
    /** 越大越先匹配；同优先级按 Pack 声明顺序 */
    priority: zod_1.z.number().int().default(0),
});
exports.packWorldFileSchema = zod_1.z.object({
    chapters: zod_1.z.array(exports.packChapterSchema).min(1),
    flags: zod_1.z.array(exports.packFlagDefSchema).min(1),
    /** 新进度默认章节 = chapters 中 rank 最小者，可显式覆盖 */
    default_chapter: exports.packIdSchema.optional(),
    /** 进场默认 NPC；省略则取 npcs[0] */
    default_npc: exports.packIdSchema.optional(),
    numeric_tools: exports.packNumericToolsSchema,
    /** 玩家消息 / 数值变化 → 动画；空则保持当前状态 */
    animation_rules: zod_1.z.array(exports.packAnimationRuleSchema).default([]),
    endings: zod_1.z.array(exports.packEndingSchema).default([]),
});
exports.packHeaderSchema = zod_1.z.object({
    schema_version: zod_1.z.number().int().positive(),
    world_id: exports.packIdSchema,
    /** 版本名（不含时间戳）；目录为 版本名__时间戳 */
    display_name: zod_1.z.string().min(1),
    /** ISO 或 yyyyMMddTHHmm */
    created_at: zod_1.z.string().min(1),
    notes: zod_1.z.string().optional(),
});
exports.worldManifestSchema = zod_1.z.object({
    world_id: exports.packIdSchema,
    /** versions/ 下的目录名（含 __时间戳） */
    official_version_dir: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
});
/** 内存中组装后的完整 Pack（校验交叉引用后） */
exports.storyPackSchema = zod_1.z.object({
    header: exports.packHeaderSchema,
    world: exports.packWorldFileSchema,
    triggers: exports.packTriggersFileSchema,
    prompts: exports.packPromptsFileSchema,
    npcs: zod_1.z.array(exports.packNpcSchema).min(1),
    /** 磁盘版本目录名，如 默认MVP__20260710T1045 */
    version_dir: zod_1.z.string().min(1),
});
/** 交叉校验：触发/记忆/约束引用的章节与 flag 必须在 world 中声明 */
function assertPackReferences(pack) {
    const chapterIds = new Set(pack.world.chapters.map((c) => c.id));
    const flagNames = new Set(pack.world.flags.map((f) => f.name));
    const needChapter = (id, ctx) => {
        if (!chapterIds.has(id)) {
            throw new Error(`Pack 引用未知章节 "${id}" @ ${ctx}`);
        }
    };
    const needFlag = (name, ctx) => {
        if (!flagNames.has(name)) {
            throw new Error(`Pack 引用未知 flag "${name}" @ ${ctx}`);
        }
    };
    if (pack.world.default_chapter) {
        needChapter(pack.world.default_chapter, 'world.default_chapter');
    }
    if (pack.world.default_npc) {
        if (!pack.npcs.some((n) => n.npc_id === pack.world.default_npc)) {
            throw new Error(`Pack 引用未知 NPC "${pack.world.default_npc}" @ world.default_npc`);
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
    const npcIds = new Set(pack.npcs.map((n) => n.npc_id));
    for (const ev of pack.triggers.exchange_events ?? []) {
        needChapter(ev.chapter, `exchange.${ev.id}`);
        for (const f of ev.require_flags) {
            needFlag(f, `exchange.${ev.id}.require`);
        }
        for (const f of ev.set_flags) {
            needFlag(f.name, `exchange.${ev.id}.set`);
        }
        for (const sid of ev.speakers) {
            if (!npcIds.has(sid)) {
                throw new Error(`Pack 引用未知 NPC "${sid}" @ exchange.${ev.id}.speakers`);
            }
        }
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
    for (const ending of pack.world.endings ?? []) {
        if (ending.chapter) {
            needChapter(ending.chapter, `endings.${ending.id}`);
        }
        for (const f of ending.require_flags ?? []) {
            needFlag(f, `endings.${ending.id}.require`);
        }
        for (const f of ending.require_any_flags ?? []) {
            needFlag(f, `endings.${ending.id}.require_any`);
        }
        for (const f of ending.forbid_flags ?? []) {
            needFlag(f, `endings.${ending.id}.forbid`);
        }
        for (const f of ending.set_flags ?? []) {
            needFlag(f.name, `endings.${ending.id}.set`);
        }
        for (const f of ending.clear_flags ?? []) {
            needFlag(f, `endings.${ending.id}.clear`);
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
function getDefaultChapterId(pack) {
    if (pack.world.default_chapter)
        return pack.world.default_chapter;
    const sorted = [...pack.world.chapters].sort((a, b) => a.rank - b.rank);
    return sorted[0].id;
}
/** 剧情「第一章」：rank 最小的章（与 default_chapter 可能不同） */
function getFirstChapterId(pack) {
    const sorted = [...pack.world.chapters].sort((a, b) => a.rank - b.rank);
    if (sorted.length === 0) {
        throw new Error('pack has no chapters');
    }
    return sorted[0].id;
}
function getDefaultNpcId(pack) {
    if (pack.world.default_npc)
        return pack.world.default_npc;
    return pack.npcs[0].npc_id;
}
function getChapterRankMap(pack) {
    const map = {};
    for (const c of pack.world.chapters) {
        map[c.id] = c.rank;
    }
    return map;
}
/** chapterId → 展示名（优先章节名 display_name，其次 HUD 短名） */
function getChapterLabelMap(pack) {
    const map = {};
    for (const c of pack.world.chapters) {
        map[c.id] = c.display_name || c.hud_label || c.id;
    }
    return map;
}
/**
 * NPC 是否应在场景出场（章节门槛 + 可选 flags）。
 * appear_from_chapter 省略 = 无章节门槛。
 */
function isNpcPresent(opts) {
    const { appear_from_chapter, appear_require_flags = [], chapterState, flags, rankMap, } = opts;
    if (appear_from_chapter &&
        !(0, chapter_util_1.isChapterAtLeast)(chapterState, appear_from_chapter, rankMap)) {
        return false;
    }
    for (const name of appear_require_flags) {
        if (!(0, story_schema_1.isFlagSet)(flags, name))
            return false;
    }
    return true;
}
