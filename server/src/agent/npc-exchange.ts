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
