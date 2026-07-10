import * as fs from 'fs';
import * as path from 'path';
import type {
  ChapterState,
  NpcRuntimeState,
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
}

export interface ChapterTransitionResult {
  chapterState: ChapterState;
  flagsToSet: FlagSetEntry[];
}

interface TriggerRule {
  id: string;
  enabled: boolean;
  from_chapter: ChapterState;
  to_chapter: ChapterState | null;
  min_affinity: number;
  max_fatigue?: number;
  require_flags: string[];
  player_triggers: string[];
  set_flags: Array<{ name: string; value: string }>;
}

interface NpcReplyFlagRule {
  id: string;
  enabled: boolean;
  when_chapter_in: ChapterState[];
  set_flag: string;
  value: string;
  triggers: string[];
}

interface StoryTriggersFile {
  version: number;
  rules: TriggerRule[];
  npc_reply_flag_rules: NpcReplyFlagRule[];
}

let cachedTriggers: StoryTriggersFile | null = null;

function loadTriggers(): StoryTriggersFile {
  if (cachedTriggers) return cachedTriggers;
  const filePath = path.join(
    __dirname,
    '..',
    '..',
    'mock-data',
    'story-triggers.json',
  );
  const raw = fs.readFileSync(filePath, 'utf-8');
  cachedTriggers = JSON.parse(raw) as StoryTriggersFile;
  return cachedTriggers;
}

/** 测试/热更时可清缓存 */
export function clearStoryTriggersCache() {
  cachedTriggers = null;
}

function messageHitsTriggers(message: string, triggers: string[]): boolean {
  if (triggers.length === 0) return true;
  const msg = message.toLowerCase();
  return triggers.some((t) => msg.includes(t.toLowerCase()));
}

function ruleMatches(
  rule: TriggerRule,
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
 * 读 JSON 触发表 + flags：输出新章节与待设 flags。
 * 同轮可命中多条规则；升章最多一次。规则按 JSON 顺序，后规则可见本轮已投影的 flags。
 */
export function evaluateChapterTransition(
  input: ChapterTransitionInput,
): ChapterTransitionResult {
  const triggers = loadTriggers();
  const flagsToSet: FlagSetEntry[] = [];
  let chapterState = input.chapterState;
  let chapterAdvanced = false;
  const projectedFlags: StoryFlagsSnapshot = { ...input.flags };

  for (const rule of triggers.rules) {
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

  return { chapterState, flagsToSet };
}

/** 扫 NPC 回复，置表演层 flags（如 ch2_npc_admitted_tired） */
export function evaluateNpcReplyFlags(
  chapterState: ChapterState,
  npcReply: string,
  flags: StoryFlagsSnapshot,
): FlagSetEntry[] {
  const triggers = loadTriggers();
  const out: FlagSetEntry[] = [];
  const msg = npcReply.toLowerCase();

  for (const rule of triggers.npc_reply_flag_rules ?? []) {
    if (!rule.enabled) continue;
    if (!rule.when_chapter_in.includes(chapterState)) continue;
    if (isFlagSet(flags, rule.set_flag)) continue;
    const hit = rule.triggers.some((t) => msg.includes(t.toLowerCase()));
    if (hit) {
      out.push({ name: rule.set_flag, value: rule.value });
    }
  }
  return out;
}
