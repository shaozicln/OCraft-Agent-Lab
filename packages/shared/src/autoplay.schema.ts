import { z } from 'zod';
import {
  listReachableAutoPlayEndings,
  type AutoPlayProgressSnapshot,
} from './autoplay-reachability';
import { packIdSchema } from './pack.schema';

export type { AutoPlayProgressSnapshot } from './autoplay-reachability';

/** 自动演目标：由「当前 Pack + 用户设置」组装，禁止运行时写死 feel */
export const autoPlayGoalSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  world_id: z.string().min(1).max(64).optional(),
  pack_version_id: z.string().min(1).max(128).optional(),
  /** 本局焦点对话 NPC（当前打开的聊天对象；全场演时可后置） */
  npc_id: z.string().min(1).max(64),
  /** 可选章停：先到此章则停正片（不进杀青） */
  target_chapter: z.string().min(1).max(64).optional(),
  target_exchange: z.string().min(1).max(64).optional(),
  /** 目标结局（指定或随机抽中）；无结局包时可空，改停最终章 */
  target_ending: z.string().min(1).max(64).optional(),
  /** 无可用结局时：停在最终章 */
  stop_at_final_chapter: z.boolean().default(false),
  final_chapter_id: z.string().min(1).max(64).optional(),
  /**
   * 每章发言软顶（1 条对话 = 1 次）；换章清零。
   * 顶到不硬停，触发「保持/加速」。
   */
  chapter_speak_cap: z.number().int().min(1).max(10_000).default(100),
  /**
   * @deprecated 兼容旧 payload / eval；与 chapter_speak_cap 同步，不再作整场硬停。
   */
  max_turns: z.number().int().min(1).max(10_000).default(100),
  wait_ms: z.number().int().min(0).max(30_000).default(800),
  style_id: z.string().min(1).max(64).default('direct'),
  /** allow=可接管；watch_only=只旁观 */
  takeover_mode: z.enum(['allow', 'watch_only']).default('allow'),
  /** 正片以 ending_reached 结束后是否进杀青 */
  enter_epilogue: z.boolean().default(false),
  /** 杀青台面：a 演员局 / b 无玩家位向 / c 创世神梗 */
  epilogue_mode: z.enum(['a', 'b', 'c']).optional(),
  /**
   * A 台玩家身份：creator=创世神视角（近 C）；inworld=本世界玩家名+人设。
   * C 台固定按创世神；B 台忽略。
   */
  epilogue_player_role: z.enum(['creator', 'inworld']).optional(),
  /** C / A① 希望 NPC 怎么称呼你；空则默认「创世神」 */
  epilogue_address_as: z.string().trim().max(32).optional(),
  /** 杀青破墙知情：勾选的在场 NPC id */
  break_wall_npc_ids: z.array(z.string().min(1).max(64)).max(32).optional(),
  /** 正片破墙知情：勾选的在场 NPC id（与杀青独立） */
  main_break_wall_npc_ids: z
    .array(z.string().min(1).max(64))
    .max(32)
    .optional(),
  /** 运行时加速：五句内冲升章/终章撞结局 */
  accelerate: z.boolean().default(false),
});
export type AutoPlayGoal = z.infer<typeof autoPlayGoalSchema>;

export const autoPlayEpilogueModeSchema = z.enum(['a', 'b', 'c']);
export type AutoPlayEpilogueMode = z.infer<typeof autoPlayEpilogueModeSchema>;

export const autoPlayEpiloguePlayerRoleSchema = z.enum(['creator', 'inworld']);
export type AutoPlayEpiloguePlayerRole = z.infer<
  typeof autoPlayEpiloguePlayerRoleSchema
>;

/** 正片 / 杀青 */
export type AutoPlayPhase = 'main' | 'epilogue';

/** 空称呼 → 默认「创世神」 */
export function resolveEpilogueAddress(
  addressAs: string | undefined | null,
): string {
  const t = addressAs?.trim();
  return t || '创世神';
}

/**
 * 杀青中自然语言改称呼（补充填表）。
 * 例：「叫我阿灯」「别叫创世神，叫我导演」
 */
export function tryParseEpilogueAddressRename(message: string): string | null {
  const raw = message.trim();
  if (!raw) return null;
  const patterns = [
    /(?:别叫[^，,。！!？?\s]{0,12}[，,]?\s*)?(?:请)?(?:叫我|称呼我(?:为)?)\s*[「『""']?([^」』""'。！!？?\s，,]{1,16})/,
    /(?:改称|改叫)\s*[「『""']?([^」』""'。！!？?\s，,]{1,16})/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    const name = m?.[1]?.trim();
    if (name && name !== '你' && name !== '我') return name.slice(0, 32);
  }
  return null;
}

/** 当前相位下该 NPC 是否破墙知情 */
export function isBreakWallNpc(
  npcId: string,
  opts: {
    phase: AutoPlayPhase;
    break_wall_npc_ids?: string[] | null;
    main_break_wall_npc_ids?: string[] | null;
  },
): boolean {
  const ids =
    opts.phase === 'epilogue'
      ? opts.break_wall_npc_ids
      : opts.main_break_wall_npc_ids;
  return Boolean(npcId && (ids ?? []).includes(npcId));
}

export const AUTO_PLAY_EPILOGUE_MODE_LABELS: Record<
  AutoPlayEpilogueMode,
  string
> = {
  a: 'A 演员局',
  b: 'B 无玩家位向',
  c: 'C 创世神梗',
};

export const autoPlayStatusSchema = z.enum([
  'idle',
  'running',
  'paused',
  'done',
  'abort',
]);
export type AutoPlayStatus = z.infer<typeof autoPlayStatusSchema>;

/** AP-1：导演排场一拍里的一句（玩家演出位 stub = speaker_id `player`） */
export const autoPlayBeatLineSchema = z.object({
  speaker_kind: z.enum(['player', 'npc']),
  speaker_id: z.string().min(1).max(64),
  text: z.string().trim().min(1).max(500),
});
export type AutoPlayBeatLine = z.infer<typeof autoPlayBeatLineSchema>;

export const autoPlayNextProposalSchema = z.object({
  /**
   * @deprecated AP-1 起优先用 lines；若仅有 say，视为单句玩家演出。
   */
  say: z.string().trim().min(1).max(500).optional(),
  /** 本拍 1～N 句（顺序演出）；可无玩家句 */
  lines: z.array(autoPlayBeatLineSchema).max(6).default([]),
  done: z.boolean(),
  reason: z.string().max(200).default(''),
  source: z.enum(['agent', 'mock']).default('agent'),
});
export type AutoPlayNextProposal = z.infer<typeof autoPlayNextProposalSchema>;

/** 风格预设（产品写死；深浅与每拍 N 藏在风格里） */
export const AUTO_PLAY_STYLE_PRESETS = [
  {
    id: 'bare',
    label: '裸 AI',
    depth: 'none' as const,
    blurb: '少约束，模型自由发挥（仍禁改章）',
    prompt_hint: '少加风格约束，自然口语即可。',
    light_npc_tint: false,
    max_speakers: 2,
  },
  {
    id: 'direct',
    label: '直给推进',
    depth: 'shallow' as const,
    blurb: '少铺垫，尽快碰关键事件',
    prompt_hint:
      '风格：直给推进。少铺垫，尽快碰到关键异常/事件；避免长篇关系戏。',
    light_npc_tint: false,
    max_speakers: 2,
  },
  {
    id: 'daily',
    label: '日常感',
    depth: 'shallow_mid' as const,
    blurb: '先像同学闲聊，再碰到事',
    prompt_hint: '风格：日常感。先闲聊口吻，再自然碰到事，别上来揭底。',
    light_npc_tint: false,
    max_speakers: 2,
  },
  {
    id: 'rumor',
    label: '传言慢热',
    depth: 'mid' as const,
    blurb: '先传闻/八卦，再坐实异常',
    prompt_hint: '风格：传言慢热。先提传闻/八卦，再逐步坐实，勿第一句揭底。',
    light_npc_tint: false,
    max_speakers: 2,
  },
  {
    id: 'bond',
    label: '关系优先',
    depth: 'mid_deep' as const,
    blurb: '先把人和羁绊说清再推进',
    prompt_hint: '风格：关系优先。先照顾同学关系/态度，再推进事件。',
    light_npc_tint: true,
    max_speakers: 3,
  },
  {
    id: 'suspense',
    label: '悬疑压步',
    depth: 'deep' as const,
    blurb: '信息憋着给，多疑点少答案',
    prompt_hint: '风格：悬疑压步。多暗示少结论，信息憋着给。',
    light_npc_tint: true,
    max_speakers: 3,
  },
  {
    id: 'warm',
    label: '温情向',
    depth: 'mid' as const,
    blurb: '冲突也偏软、少刀',
    prompt_hint: '风格：温情向。语气偏软、关心，少锋利对抗。',
    light_npc_tint: false,
    max_speakers: 2,
  },
  {
    id: 'sharp',
    label: '锋利短句',
    depth: 'shallow_mid' as const,
    blurb: '对话干脆、少解释',
    prompt_hint: '风格：锋利短句。短、干脆，少解释少内心独白。',
    light_npc_tint: false,
    max_speakers: 2,
  },
  {
    id: 'funny',
    label: '搞笑',
    depth: 'shallow_mid' as const,
    blurb: '轻喜剧节奏；玩笑不破禁区',
    prompt_hint: '风格：搞笑。轻喜剧节奏，玩笑不剧透、不破 Pack 禁区。',
    light_npc_tint: false,
    max_speakers: 2,
  },
] as const;

export type AutoPlayStyleId = (typeof AUTO_PLAY_STYLE_PRESETS)[number]['id'];

export const autoPlayStyleIdSchema = z.enum([
  'bare',
  'direct',
  'daily',
  'rumor',
  'bond',
  'suspense',
  'warm',
  'sharp',
  'funny',
]);

export const DEFAULT_AUTO_PLAY_STYLE_ID: AutoPlayStyleId = 'direct';

export const DEFAULT_CHAPTER_SPEAK_CAP = 100;
/** 超过此值须提示 token/费用风险 */
export const CHAPTER_SPEAK_CAP_COST_WARN = 200;

export function getAutoPlayStylePreset(id: string | undefined) {
  const found = AUTO_PLAY_STYLE_PRESETS.find((s) => s.id === id);
  return (
    found ??
    AUTO_PLAY_STYLE_PRESETS.find((s) => s.id === DEFAULT_AUTO_PLAY_STYLE_ID)!
  );
}

/** 风格隐含的每拍最多说话人数（不对用户单独暴露） */
export function getAutoPlayStyleMaxSpeakers(id: string | undefined): number {
  return getAutoPlayStylePreset(id).max_speakers;
}

/** 把 say / lines 归一成拍内台词列表 */
export function normalizeAutoPlayBeatLines(
  proposal: Pick<AutoPlayNextProposal, 'say' | 'lines'>,
): AutoPlayBeatLine[] {
  const fromLines = (proposal.lines ?? []).filter((l) => l.text.trim());
  if (fromLines.length > 0) return fromLines;
  const say = proposal.say?.trim();
  if (!say) return [];
  return [
    {
      speaker_kind: 'player',
      speaker_id: 'player',
      text: say,
    },
  ];
}

/** 开演前用户设置（本局可覆盖 Pack 默认风格） */
export const autoPlayPrefsSchema = z.object({
  style_id: autoPlayStyleIdSchema.default(DEFAULT_AUTO_PLAY_STYLE_ID),
  /** 可选章停；空=不设章停，直通结局/最终章 */
  stop_at_chapter: packIdSchema.optional(),
  /**
   * specific|random：有可用结局时必选其一。
   * final_chapter：无 enabled 结局时的停条件。
   */
  ending_mode: z.enum(['specific', 'random', 'final_chapter']).default('random'),
  target_ending_id: packIdSchema.optional(),
  takeover_mode: z.enum(['allow', 'watch_only']).default('allow'),
  wait_ms: z.number().int().min(0).max(30_000).default(800),
  chapter_speak_cap: z
    .number()
    .int()
    .min(1)
    .max(10_000)
    .default(DEFAULT_CHAPTER_SPEAK_CAP),
  /** 打到结局后进杀青 */
  enter_epilogue: z.boolean().default(false),
  /** 杀青台面 */
  epilogue_mode: autoPlayEpilogueModeSchema.optional(),
  /** A 台：创世神视角 / 本世界人设 */
  epilogue_player_role: autoPlayEpiloguePlayerRoleSchema.optional(),
  /** C / A① 称呼；可空 */
  epilogue_address_as: z.string().trim().max(32).optional(),
  /** 杀青破墙 NPC */
  break_wall_npc_ids: z.array(z.string().min(1).max(64)).max(32).optional(),
  /** 正片破墙 NPC */
  main_break_wall_npc_ids: z
    .array(z.string().min(1).max(64))
    .max(32)
    .optional(),
});
export type AutoPlayPrefs = z.infer<typeof autoPlayPrefsSchema>;

export type AutoPlayEndingOption = {
  id: string;
  display_name: string;
  enabled?: boolean;
  /** AP-3 门控（运行时下发；缺省时仅按 enabled） */
  chapter?: string;
  require_flags?: string[];
  require_any_flags?: string[];
  forbid_flags?: string[];
  set_flags?: Array<{ name: string; value?: string }>;
};

export type AutoPlayStopKind = 'ending' | 'chapter' | 'final_chapter' | null;

/**
 * 由当前 Pack 摘要 + 用户设置组装本局目标（AP-0b）。
 * 不读取 FEEL 常量。传入 progress 时按 AP-3 只从可达结局中抽目标。
 */
export function buildAutoPlayGoal(opts: {
  npcId: string;
  prefs: AutoPlayPrefs;
  pack?: {
    world_id?: string;
    version_dir?: string;
    display_name?: string;
    endings?: AutoPlayEndingOption[];
    chapters?: { id: string }[];
  };
  /** AP-3：当前章 / flags / rank → 可达结局筛选 */
  progress?: AutoPlayProgressSnapshot | null;
}): AutoPlayGoal {
  const prefs = autoPlayPrefsSchema.parse(opts.prefs);
  const endings = listReachableAutoPlayEndings(
    opts.pack?.endings ?? [],
    opts.progress,
  );
  const chapters = opts.pack?.chapters ?? [];
  const finalChapterId =
    chapters.length > 0 ? chapters[chapters.length - 1]!.id : undefined;

  let target_ending: string | undefined;
  let stop_at_final_chapter = false;
  let endingMode = prefs.ending_mode;

  if (endings.length === 0) {
    endingMode = 'final_chapter';
    stop_at_final_chapter = true;
  } else if (endingMode === 'final_chapter') {
    endingMode = 'random';
  }

  if (endingMode === 'specific' && prefs.target_ending_id) {
    const ok = endings.some((e) => e.id === prefs.target_ending_id);
    if (ok) {
      target_ending = prefs.target_ending_id;
    } else if (endings.length > 0) {
      // 指定结局已不可达 → 退回随机可达
      const i = Math.floor(Math.random() * endings.length);
      target_ending = endings[i]!.id;
    }
  } else if (endingMode === 'random' && endings.length > 0) {
    const i = Math.floor(Math.random() * endings.length);
    target_ending = endings[i]!.id;
  }

  // 无结局时：章停默认落到最终章（若用户另选了更早的章停则尊重）
  let target_chapter = prefs.stop_at_chapter;
  if (stop_at_final_chapter && !target_chapter && finalChapterId) {
    target_chapter = finalChapterId;
  }

  const style = getAutoPlayStylePreset(prefs.style_id);
  const packLabel = opts.pack?.display_name?.trim() || '当前剧本';
  const titleBits = [
    packLabel,
    style.label,
    target_ending
      ? `→${target_ending}`
      : stop_at_final_chapter
        ? '→最终章'
        : null,
    prefs.stop_at_chapter ? `章停:${prefs.stop_at_chapter}` : null,
    prefs.enter_epilogue ? '杀青' : null,
  ].filter(Boolean);

  const cap = prefs.chapter_speak_cap;

  return autoPlayGoalSchema.parse({
    id: `auto-${Date.now().toString(36)}`,
    title: titleBits.join(' · ').slice(0, 120),
    world_id: opts.pack?.world_id,
    pack_version_id: opts.pack?.version_dir,
    npc_id: opts.npcId,
    target_chapter,
    target_ending,
    stop_at_final_chapter,
    final_chapter_id: finalChapterId,
    chapter_speak_cap: cap,
    max_turns: cap,
    wait_ms: prefs.wait_ms,
    style_id: style.id,
    takeover_mode: prefs.takeover_mode,
    enter_epilogue: prefs.enter_epilogue && Boolean(target_ending),
    epilogue_mode:
      prefs.enter_epilogue && target_ending
        ? (prefs.epilogue_mode ?? 'a')
        : undefined,
    epilogue_player_role:
      prefs.enter_epilogue && target_ending
        ? prefs.epilogue_mode === 'c'
          ? 'creator'
          : prefs.epilogue_mode === 'b'
            ? undefined
            : (prefs.epilogue_player_role ?? 'creator')
        : undefined,
    epilogue_address_as:
      prefs.enter_epilogue && target_ending
        ? prefs.epilogue_address_as?.trim() || undefined
        : undefined,
    break_wall_npc_ids:
      prefs.enter_epilogue && target_ending
        ? prefs.break_wall_npc_ids
        : undefined,
    main_break_wall_npc_ids: prefs.main_break_wall_npc_ids,
    accelerate: false,
  });
}

/** 完成时属于哪种停因（杀青仅 ending） */
export function resolveAutoPlayStopKind(
  goal: AutoPlayGoal,
  actual: {
    chapter?: string;
    endingId?: string | null;
    sawTargetExchange?: boolean;
  },
): AutoPlayStopKind {
  if (goal.target_ending && actual.endingId === goal.target_ending) {
    return 'ending';
  }
  if (
    goal.stop_at_final_chapter &&
    goal.final_chapter_id &&
    actual.chapter === goal.final_chapter_id &&
    !goal.target_ending
  ) {
    return 'final_chapter';
  }
  if (goal.target_chapter && actual.chapter === goal.target_chapter) {
    if (goal.target_exchange && !actual.sawTargetExchange) return null;
    return 'chapter';
  }
  return null;
}

/**
 * @deprecated 仅离线 eval / 历史对照；运行时禁止作为默认目标。
 */
export const FEEL_DEMO_AUTO_GOAL: AutoPlayGoal = autoPlayGoalSchema.parse({
  id: 'feel-demo-auto-goal',
  title: '（eval 夹具）裂痕登场',
  world_id: 'awaken',
  pack_version_id: 'awaken-0717feel__20260717T1450',
  npc_id: 'npc_suolunsen',
  target_chapter: 'ch2_unease',
  target_exchange: 'ex_ch2_first_meet',
  chapter_speak_cap: 6,
  max_turns: 6,
  wait_ms: 800,
  style_id: 'direct',
  takeover_mode: 'allow',
  enter_epilogue: false,
  accelerate: false,
});
