"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePlayerProfilePayloadSchema = exports.playerProfileSchema = exports.playerGenderSchema = exports.playerExtraSchema = void 0;
const zod_1 = require("zod");
/** 玩家自行填写的扩展资料（JSONB） */
exports.playerExtraSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown());
exports.playerGenderSchema = zod_1.z.enum([
    'male',
    'female',
    'other',
    'undisclosed',
]);
exports.playerProfileSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    /** 真名 / 公司用户名（工牌、协作软件显示名） */
    realName: zod_1.z.string().min(1).max(64).nullable(),
    /** 游戏内网名（Steam、论坛等；剧情可吐槽「怎么全网同名」） */
    onlineName: zod_1.z.string().min(1).max(64).nullable(),
    /** 公司岗位（如前端、测试、运营） */
    jobTitle: zod_1.z.string().min(1).max(64).nullable(),
    gender: exports.playerGenderSchema.nullable(),
    age: zod_1.z.number().int().min(0).max(150).nullable(),
    /** ISO 日期 YYYY-MM-DD */
    birthday: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
    extra: exports.playerExtraSchema,
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.updatePlayerProfilePayloadSchema = zod_1.z.object({
    playerId: zod_1.z.string().uuid(),
    realName: zod_1.z.string().min(1).max(64).optional(),
    onlineName: zod_1.z.string().min(1).max(64).optional(),
    jobTitle: zod_1.z.string().min(1).max(64).optional(),
    gender: exports.playerGenderSchema.optional(),
    age: zod_1.z.number().int().min(0).max(150).optional(),
    birthday: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    extra: exports.playerExtraSchema.optional(),
});
