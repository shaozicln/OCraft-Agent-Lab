"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOOLEAN_FLAG_VALUE = exports.storyFlagsSnapshotSchema = exports.storyFlagValueSchema = exports.playerStanceSchema = exports.storyFlagNameSchema = exports.STORY_FLAG_NAMES = void 0;
exports.isFlagSet = isFlagSet;
const zod_1 = require("zod");
/** Canon 附录 A：10 个 story flag 名 */
exports.STORY_FLAG_NAMES = [
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
];
exports.storyFlagNameSchema = zod_1.z.enum(exports.STORY_FLAG_NAMES);
/** Ch5 站队（阶段 E 写入；阶段 C 仅占位） */
exports.playerStanceSchema = zod_1.z.enum(['help', 'leave', 'silence']);
/**
 * Flag 存库值：
 * - 普通 flag 置位为 `"true"`
 * - `ch5_player_stance` 为 help | leave | silence
 */
exports.storyFlagValueSchema = zod_1.z.string().min(1);
/** 已置位 flags 快照：flag_name → value */
exports.storyFlagsSnapshotSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.string());
exports.BOOLEAN_FLAG_VALUE = 'true';
function isFlagSet(flags, name) {
    const v = flags[name];
    return typeof v === 'string' && v.length > 0;
}
