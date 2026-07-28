import type {
  ChapterState,
  PackEnding,
  StoryFlagsSnapshot,
  StoryPack,
} from '@ocraft/shared';
import { isFlagSet } from '@ocraft/shared';

export type EndingSettlement = {
  endingId: string;
  displayName: string;
  notes?: string;
  setFlags: Array<{ name: string; value: string }>;
  clearFlags: string[];
};

function messageHitsTriggers(message: string, triggers: string[]): boolean {
  if (triggers.length === 0) return true;
  const msg = message.toLowerCase();
  return triggers.some((t) => msg.includes(t.toLowerCase()));
}

function endingMatches(
  ending: PackEnding,
  chapterState: ChapterState,
  flags: StoryFlagsSnapshot,
  playerMessage: string,
): boolean {
  if (ending.enabled === false) return false;
  // 无 set_flags 的占位结局（旧 Pack）不参与运行时结算
  if ((ending.set_flags ?? []).length === 0) return false;
  if (ending.chapter && ending.chapter !== chapterState) return false;
  for (const name of ending.require_flags ?? []) {
    if (!isFlagSet(flags, name)) return false;
  }
  const any = ending.require_any_flags ?? [];
  if (any.length > 0 && !any.some((name) => isFlagSet(flags, name))) {
    return false;
  }
  for (const name of ending.forbid_flags ?? []) {
    if (isFlagSet(flags, name)) return false;
  }
  if (!messageHitsTriggers(playerMessage, ending.player_triggers ?? [])) {
    return false;
  }
  return true;
}

/** 任一结局 flag 已置 → 视为本局已结算，不再匹配 */
export function hasSettledEnding(
  flags: StoryFlagsSnapshot,
  endings: PackEnding[],
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
 * G：按 Pack endings 条件结算。返回至多一个命中（priority 高优先，同级按声明序）。
 * 不写库；调用方负责 set/clear flags 与推送 UI。
 */
export function evaluateEndingSettlement(opts: {
  pack: StoryPack;
  chapterState: ChapterState;
  flags: StoryFlagsSnapshot;
  playerMessage: string;
}): EndingSettlement | null {
  const endings = [...(opts.pack.world.endings ?? [])].sort((a, b) => {
    const pd = (b.priority ?? 0) - (a.priority ?? 0);
    return pd;
  });

  if (endings.length === 0) return null;
  if (hasSettledEnding(opts.flags, endings)) return null;

  for (const ending of endings) {
    if (
      !endingMatches(
        ending,
        opts.chapterState,
        opts.flags,
        opts.playerMessage,
      )
    ) {
      continue;
    }
    return {
      endingId: ending.id,
      displayName: ending.display_name,
      notes: ending.notes,
      setFlags: (ending.set_flags ?? []).map((f) => ({
        name: f.name,
        value: f.value ?? 'true',
      })),
      clearFlags: [...(ending.clear_flags ?? [])],
    };
  }
  return null;
}
