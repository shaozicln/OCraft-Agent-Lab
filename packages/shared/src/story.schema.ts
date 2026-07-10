import { z } from 'zod';

/** Canon 附录 A：10 个 story flag 名 */
export const STORY_FLAG_NAMES = [
  'ch1_bonded',
  'ch2_sleep_mentioned',
  'ch2_npc_admitted_tired',
  'ch2_floor_avoided',
  'ch3_dream_partial',
  'ch3_dream_full',
  'ch3_colleague_hint',
  'ch4_ocraft_aware',
  'ch5_player_stance',
  'ending_locked',
] as const;

export const storyFlagNameSchema = z.enum(STORY_FLAG_NAMES);
export type StoryFlagName = z.infer<typeof storyFlagNameSchema>;

/** Ch5 站队（阶段 E 写入；阶段 C 仅占位） */
export const playerStanceSchema = z.enum(['help', 'leave', 'silence']);
export type PlayerStance = z.infer<typeof playerStanceSchema>;

/**
 * Flag 存库值：
 * - 普通 flag 置位为 `"true"`
 * - `ch5_player_stance` 为 help | leave | silence
 */
export const storyFlagValueSchema = z.string().min(1);
export type StoryFlagValue = z.infer<typeof storyFlagValueSchema>;

/** 已置位 flags 快照：flag_name → value */
export const storyFlagsSnapshotSchema = z.record(z.string(), z.string());
export type StoryFlagsSnapshot = z.infer<typeof storyFlagsSnapshotSchema>;

export const BOOLEAN_FLAG_VALUE = 'true' as const;

export function isFlagSet(
  flags: StoryFlagsSnapshot,
  name: StoryFlagName | string,
): boolean {
  const v = flags[name];
  return typeof v === 'string' && v.length > 0;
}
