import { z } from 'zod';
/** 账号里保存的字段（空 = 未覆盖，回退服务器 .env） */
export declare const playerLlmSettingsSchema: z.ZodObject<{
    baseUrl: z.ZodString;
    model: z.ZodString;
    embedModel: z.ZodString;
    directorModel: z.ZodString;
    enableThinking: z.ZodNullable<z.ZodBoolean>;
    hasApiKey: z.ZodBoolean;
    apiKeyMasked: z.ZodString;
    effective: z.ZodObject<{
        source: z.ZodEnum<{
            player: "player";
            none: "none";
            env: "env";
        }>;
        baseUrl: z.ZodString;
        model: z.ZodString;
        mock: z.ZodBoolean;
    }, z.core.$strip>;
}, z.core.$strip>;
export type PlayerLlmSettings = z.infer<typeof playerLlmSettingsSchema>;
export declare const patchPlayerLlmSettingsSchema: z.ZodObject<{
    baseUrl: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodOptional<z.ZodString>;
    clearApiKey: z.ZodOptional<z.ZodBoolean>;
    model: z.ZodOptional<z.ZodString>;
    embedModel: z.ZodOptional<z.ZodString>;
    directorModel: z.ZodOptional<z.ZodString>;
    enableThinking: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
}, z.core.$strip>;
export type PatchPlayerLlmSettings = z.infer<typeof patchPlayerLlmSettingsSchema>;
/** 连通性探测：可带未保存的草稿覆盖 */
export declare const testPlayerLlmSettingsSchema: z.ZodObject<{
    baseUrl: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodOptional<z.ZodString>;
    clearApiKey: z.ZodOptional<z.ZodBoolean>;
    model: z.ZodOptional<z.ZodString>;
    embedModel: z.ZodOptional<z.ZodString>;
    directorModel: z.ZodOptional<z.ZodString>;
    enableThinking: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
}, z.core.$strip>;
export type TestPlayerLlmSettings = z.infer<typeof testPlayerLlmSettingsSchema>;
export declare const llmTestResultSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    model: z.ZodString;
    preview: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type LlmTestResult = z.infer<typeof llmTestResultSchema>;
