import type {
  ChapterState,
  NpcRuntimeState,
  PackTriggersFile,
  StoryFlagsSnapshot,
} from '@ocraft/shared';
import { isFlagSet } from '@ocraft/shared';

export interface FlagSetEntry {
  name: string;
  value: string;
}

export interface ChapterTransitionInput {
  chapterState: ChapterState;
  playerMessage: string;
  runtimeState: NpcRuntimeState;
  flags: StoryFlagsSnapshot;
  triggers: PackTriggersFile;
}

export interface ChapterTransitionResult {
  chapterState: ChapterState;
  flagsToSet: FlagSetEntry[];
  /** 本轮命中的 trigger 规则 id（按顺序） */
  matchedRuleIds: string[];
}

export type ReadyChapterAdvance = {
  id: string;
  toChapter: string;
  playerTriggers: string[];
  notes?: string;
};

/**
 * 当前章已满足 flag/好感、且带 to_chapter 的升章规则（供自动演加速注入关键词）。
 * 不检查 player_triggers（那是要玩家说出口的）。
 */
export function listReadyChapterAdvances(opts: {
  chapterState: ChapterState;
  runtimeState: NpcRuntimeState;
  flags: StoryFlagsSnapshot;
  triggers: PackTriggersFile;
}): ReadyChapterAdvance[] {
  const out: ReadyChapterAdvance[] = [];
  for (const rule of opts.triggers.rules) {
    if (!rule.enabled) continue;
    if (rule.from_chapter !== opts.chapterState) continue;
    if (!rule.to_chapter || rule.to_chapter === opts.chapterState) continue;
    if (opts.runtimeState.affinity < rule.min_affinity) continue;
    if (
      rule.max_fatigue !== undefined &&
      opts.runtimeState.fatigue > rule.max_fatigue
    ) {
      continue;
    }
    let flagsOk = true;
    for (const flag of rule.require_flags) {
      if (!isFlagSet(opts.flags, flag)) {
        flagsOk = false;
        break;
      }
    }
    if (!flagsOk) continue;
    out.push({
      id: rule.id,
      toChapter: rule.to_chapter,
      playerTriggers: [...rule.player_triggers],
      notes: rule.notes,
    });
  }
  return out;
}

function messageHitsTriggers(message: string, triggers: string[]): boolean {
  if (triggers.length === 0) return true;
  const msg = message.toLowerCase();
  return triggers.some((t) => msg.includes(t.toLowerCase()));
}

function ruleMatches(
  rule: PackTriggersFile['rules'][number],
  chapterState: ChapterState,
  playerMessage: string,
  runtimeState: NpcRuntimeState,
  flags: StoryFlagsSnapshot,
): boolean {
  if (!rule.enabled) return false;
  if (rule.from_chapter !== chapterState) return false;
  if (runtimeState.affinity < rule.min_affinity) return false;
  if (
    rule.max_fatigue !== undefined &&
    runtimeState.fatigue > rule.max_fatigue
  ) {
    return false;
  }
  for (const flag of rule.require_flags) {
    if (!isFlagSet(flags, flag)) return false;
  }
  return messageHitsTriggers(playerMessage, rule.player_triggers);
}

/**
 * 读 Pack 触发表 + flags：输出新章节与待设 flags。
 * 同轮可命中多条规则；升章最多一次。规则按 JSON 顺序，后规则可见本轮已投影的 flags。
 */
export function evaluateChapterTransition(
  input: ChapterTransitionInput,
): ChapterTransitionResult {
  const flagsToSet: FlagSetEntry[] = [];
  let chapterState = input.chapterState;
  let chapterAdvanced = false;
  const projectedFlags: StoryFlagsSnapshot = { ...input.flags };
  const matchedRuleIds: string[] = [];

  for (const rule of input.triggers.rules) {
    if (
      !ruleMatches(
        rule,
        chapterState,
        input.playerMessage,
        input.runtimeState,
        projectedFlags,
      )
    ) {
      continue;
    }

    matchedRuleIds.push(rule.id);

    for (const f of rule.set_flags) {
      if (!isFlagSet(projectedFlags, f.name)) {
        flagsToSet.push({ name: f.name, value: f.value });
        projectedFlags[f.name] = f.value;
      }
    }

    if (
      rule.to_chapter &&
      !chapterAdvanced &&
      rule.to_chapter !== chapterState
    ) {
      chapterState = rule.to_chapter;
      chapterAdvanced = true;
    }
  }

  return { chapterState, flagsToSet, matchedRuleIds };
}

/** 扫 NPC 回复，置表演层 flags（如 ch2_npc_admitted_tired） */
export function evaluateNpcReplyFlags(
  chapterState: ChapterState,
  npcReply: string,
  flags: StoryFlagsSnapshot,
  triggers: PackTriggersFile,
): FlagSetEntry[] {
  const out: FlagSetEntry[] = [];
  const msg = npcReply.toLowerCase();

  for (const rule of triggers.npc_reply_flag_rules ?? []) {
    if (!rule.enabled) continue;
    if (!rule.when_chapter_in.includes(chapterState)) continue;
    if (isFlagSet(flags, rule.set_flag)) continue;
    // 与玩家规则一致：triggers 空 = 任意回复都命中
    const hit =
      rule.triggers.length === 0 ||
      rule.triggers.some((t) => msg.includes(t.toLowerCase()));
    if (hit) {
      out.push({ name: rule.set_flag, value: rule.value });
    }
  }
  return out;
}
