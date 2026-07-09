"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authSessionSchema = exports.loginPayloadSchema = exports.registerPayloadSchema = exports.passwordSchema = exports.usernameSchema = void 0;
exports.formatAuthValidationError = formatAuthValidationError;
const zod_1 = require("zod");
/** 登录用户名：2–32 位，中文 / 字母 / 数字 / 下划线 */
exports.usernameSchema = zod_1.z
    .string()
    .trim()
    .min(2, '用户名至少 2 个字符')
    .max(32, '用户名最多 32 个字符')
    .regex(/^[\u4e00-\u9fffA-Za-z0-9_]+$/, '用户名只能包含中文、字母、数字和下划线');
exports.passwordSchema = zod_1.z
    .string()
    .min(6, '密码至少 6 位')
    .max(128, '密码最多 128 位');
exports.registerPayloadSchema = zod_1.z.object({
    username: exports.usernameSchema,
    password: exports.passwordSchema,
});
exports.loginPayloadSchema = zod_1.z.object({
    username: exports.usernameSchema,
    password: exports.passwordSchema,
});
exports.authSessionSchema = zod_1.z.object({
    playerId: zod_1.z.string().uuid(),
    username: zod_1.z.string(),
    token: zod_1.z.string().min(1),
});
/** 将 Zod 校验错误转成用户可读的中文提示 */
function formatAuthValidationError(error) {
    const messages = error.issues
        .map((issue) => issue.message)
        .filter((msg) => msg.length > 0);
    return [...new Set(messages)].join('；') || '输入格式不正确';
}
