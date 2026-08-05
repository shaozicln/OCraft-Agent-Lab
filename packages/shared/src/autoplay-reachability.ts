import { isFlagSet, type StoryFlagsSnapshot } from './story.schema';

/** 可达性判定所需的结局门控字段（运行时 / Pack 摘要均可） */
export type EndingReachGate = {
  id: string;
  display_name: string;
  enabled?: boolean;
  chapter?: string;
  require_flags?: string[];
  require_any_flags?: string[];
  forbid_flags?: string[];
  /** 空数组 = 占位结局，运行时不可结算 → 不可选 */
  set_flags?: Array<{ name: string; value?: string }>;
};

export type AutoPlayProgressSnapshot = {
  chapterState: string;
  flags: StoryFlagsSnapshot;
  rankMap: Record<string, number>;
};

/** 本局是否已写入任一结局 flag（与 ending-settle.hasSettledEnding 对齐） */
export function hasAnySettledEndingFlag(
  flags: StoryFlagsSnapshot,
  endings: EndingReachGate[],
): boolean {
  for (const e of endings) {
    for (const f of e.set_flags ?? []) {
      if (f.name.startsWith('ending_') && isFlagSet(flags, f.name)) {
        return true;
      }
    }
    if (e.id.startsWith('ending_') && isFlagSet(flags, e.id)) {
      return true;
    }
  }
  return (
    isFlagSet(flags, 'ending_jia') ||
    isFlagSet(flags, 'ending_yi') ||
    isFlagSet(flags, 'ending_bing')
  );
}

/**
 * AP-3：当前进度下结局是否仍可能走到。
 *
 * 可判定为不可达：
 * - disabled / 无 set_flags（不能结算）
 * - 已结算任一结局
 * - forbid_flags 已置
 * - 绑定章已过（当前章 rank > 结局章 rank；结算要求精确匹配该章）
 *
 * 不做完整 flag 图可达分析：未置的 require / require_any 仍视为「有机会」。
 */
export function isEndingReachableFromProgress(
  ending: EndingReachGate,
  progress: AutoPlayProgressSnapshot,
): boolean {
  if (ending.enabled === false) return false;
  if (ending.set_flags && ending.set_flags.length === 0) return false;

  for (const name of ending.forbid_flags ?? []) {
    if (isFlagSet(progress.flags, name)) return false;
  }

  if (ending.chapter) {
    const endRank = progress.rankMap[ending.chapter];
    const curRank = progress.rankMap[progress.chapterState];
    if (
      typeof endRank === 'number' &&
      typeof curRank === 'number' &&
      curRank > endRank
    ) {
      return false;
    }
  }

  return true;
}

/**
 * 开演面板 / buildAutoPlayGoal 共用：只保留进度可达结局。
 * 无 progress 时：enabled 且（未下发 set_flags 或 set_flags 非空）。
 */
export function listReachableAutoPlayEndings(
  endings: EndingReachGate[],
  progress?: AutoPlayProgressSnapshot | null,
): EndingReachGate[] {
  const base = endings.filter((e) => e.enabled !== false);
  if (!progress) {
    return base.filter(
      (e) => e.set_flags === undefined || e.set_flags.length > 0,
    );
  }
  if (hasAnySettledEndingFlag(progress.flags, endings)) {
    return [];
  }
  return base.filter((e) => isEndingReachableFromProgress(e, progress));
}
