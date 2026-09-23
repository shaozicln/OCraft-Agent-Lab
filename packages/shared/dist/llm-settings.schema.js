"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmTestResultSchema = exports.testPlayerLlmSettingsSchema = exports.patchPlayerLlmSettingsSchema = exports.playerLlmSettingsSchema = void 0;
const zod_1 = require("zod");
const optionalUrl = zod_1.z
    .string()
    .trim()
    .max(500)
    .refine((v) => v.length === 0 || /^https?:\/\//i.test(v), 'Base URL 须以 http:// 或 https:// 开头');
const optionalName = zod_1.z.string().trim().max(128);
/** 账号里保存的字段（空 = 未覆盖，回退服务器 .env） */
exports.playerLlmSettingsSchema = zod_1.z.object({
    baseUrl: zod_1.z.string(),
    model: zod_1.z.string(),
    embedModel: zod_1.z.string(),
    directorModel: zod_1.z.string(),
    enableThinking: zod_1.z.boolean().nullable(),
    hasApiKey: zod_1.z.boolean(),
    apiKeyMasked: zod_1.z.string(),
    effective: zod_1.z.object({
        source: zod_1.z.enum(['player', 'env', 'none']),
        baseUrl: zod_1.z.string(),
        model: zod_1.z.string(),
        mock: zod_1.z.boolean(),
    }),
});
exports.patchPlayerLlmSettingsSchema = zod_1.z.object({
    baseUrl: optionalUrl.optional(),
    /** 非空才写入；留空表示保持原 Key */
    apiKey: zod_1.z.string().max(512).optional(),
    clearApiKey: zod_1.z.boolean().optional(),
    model: optionalName.optional(),
    embedModel: optionalName.optional(),
    directorModel: optionalName.optional(),
    /** null = 跟随服务器默认 */
    enableThinking: zod_1.z.boolean().nullable().optional(),
});
/** 连通性探测：可带未保存的草稿覆盖 */
exports.testPlayerLlmSettingsSchema = exports.patchPlayerLlmSettingsSchema;
exports.llmTestResultSchema = zod_1.z.object({
    ok: zod_1.z.boolean(),
    model: zod_1.z.string(),
    preview: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
});
