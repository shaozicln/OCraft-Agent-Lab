import { z } from 'zod';

/** Flag 存库值：普通 flag 为 `"true"`；enum flag 为包内声明的枚举字符串 */
export const storyFlagValueSchema = z.string().min(1);
export type StoryFlagValue = z.infer<typeof storyFlagValueSchema>;

/** 已置位 flags 快照：flag_name → value（名由当前 Pack 声明） */
export const storyFlagsSnapshotSchema = z.record(z.string(), z.string());
export type StoryFlagsSnapshot = z.infer<typeof storyFlagsSnapshotSchema>;

export const BOOLEAN_FLAG_VALUE = 'true' as const;

export function isFlagSet(
  flags: StoryFlagsSnapshot,
  name: string,
): boolean {
  const v = flags[name];
  return typeof v === 'string' && v.length > 0;
}
