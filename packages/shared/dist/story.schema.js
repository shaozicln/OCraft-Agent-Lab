"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOOLEAN_FLAG_VALUE = exports.storyFlagsSnapshotSchema = exports.storyFlagValueSchema = void 0;
exports.isFlagSet = isFlagSet;
const zod_1 = require("zod");
/** Flag 存库值：普通 flag 为 `"true"`；enum flag 为包内声明的枚举字符串 */
exports.storyFlagValueSchema = zod_1.z.string().min(1);
/** 已置位 flags 快照：flag_name → value（名由当前 Pack 声明） */
exports.storyFlagsSnapshotSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.string());
exports.BOOLEAN_FLAG_VALUE = 'true';
function isFlagSet(flags, name) {
    const v = flags[name];
    return typeof v === 'string' && v.length > 0;
}
