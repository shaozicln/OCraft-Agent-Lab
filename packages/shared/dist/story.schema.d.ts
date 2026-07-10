import { z } from 'zod';
/** Canon 附录 A：10 个 story flag 名 */
export declare const STORY_FLAG_NAMES: readonly ["ch1_bonded", "ch2_sleep_mentioned", "ch2_npc_admitted_tired", "ch2_floor_avoided", "ch3_dream_partial", "ch3_dream_full", "ch3_colleague_hint", "ch4_ocraft_aware", "ch5_player_stance", "ending_locked"];
export declare const storyFlagNameSchema: z.ZodEnum<{
    ch1_bonded: "ch1_bonded";
    ch2_sleep_mentioned: "ch2_sleep_mentioned";
    ch2_npc_admitted_tired: "ch2_npc_admitted_tired";
    ch2_floor_avoided: "ch2_floor_avoided";
    ch3_dream_partial: "ch3_dream_partial";
    ch3_dream_full: "ch3_dream_full";
    ch3_colleague_hint: "ch3_colleague_hint";
    ch4_ocraft_aware: "ch4_ocraft_aware";
    ch5_player_stance: "ch5_player_stance";
    ending_locked: "ending_locked";
}>;
export type StoryFlagName = z.infer<typeof storyFlagNameSchema>;
/** Ch5 站队（阶段 E 写入；阶段 C 仅占位） */
export declare const playerStanceSchema: z.ZodEnum<{
    help: "help";
    leave: "leave";
    silence: "silence";
}>;
export type PlayerStance = z.infer<typeof playerStanceSchema>;
/**
 * Flag 存库值：
 * - 普通 flag 置位为 `"true"`
 * - `ch5_player_stance` 为 help | leave | silence
 */
export declare const storyFlagValueSchema: z.ZodString;
export type StoryFlagValue = z.infer<typeof storyFlagValueSchema>;
/** 已置位 flags 快照：flag_name → value */
export declare const storyFlagsSnapshotSchema: z.ZodRecord<z.ZodString, z.ZodString>;
export type StoryFlagsSnapshot = z.infer<typeof storyFlagsSnapshotSchema>;
export declare const BOOLEAN_FLAG_VALUE: "true";
export declare function isFlagSet(flags: StoryFlagsSnapshot, name: StoryFlagName | string): boolean;
