import type {
  ChapterState,
  PackExchangeEvent,
  PackTriggersFile,
  StoryFlagsSnapshot,
} from '@ocraft/shared';
import { isFlagSet } from '@ocraft/shared';

export function exchangeEventMatches(
  event: PackExchangeEvent,
  chapterState: ChapterState,
  flags: StoryFlagsSnapshot,
): boolean {
  if (!event.enabled) return false;
  if (chapterState !== event.chapter) return false;
  for (const name of event.require_flags) {
    if (!isFlagSet(flags, name)) return false;
  }
  if (event.once) {
    for (const f of event.set_flags) {
      if (isFlagSet(flags, f.name)) return false;
    }
  }
  return true;
}

/** 取第一条命中的关系事件（按 Pack 声明顺序） */
export function evaluateExchangeEvents(
  chapterState: ChapterState,
  flags: StoryFlagsSnapshot,
  triggers: PackTriggersFile,
): PackExchangeEvent | null {
  for (const ev of triggers.exchange_events ?? []) {
    if (exchangeEventMatches(ev, chapterState, flags)) return ev;
  }
  return null;
}

/**
 * MA-H：当前章/flag 下「理论上可尝试」的 exchange 戏码 id（仅 id，无触发条件/台词）。
 * 与 evaluateExchangeEvents 同一匹配语义；真正是否演仍由 Pack 命中决定。
 */
export function listAvailableExchangeEventIds(
  chapterState: ChapterState,
  flags: StoryFlagsSnapshot,
  triggers: PackTriggersFile,
): string[] {
  const ids: string[] = [];
  for (const ev of triggers.exchange_events ?? []) {
    if (exchangeEventMatches(ev, chapterState, flags)) {
      ids.push(ev.id);
    }
  }
  return ids;
}
