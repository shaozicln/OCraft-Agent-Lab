import { z } from 'zod';

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v.length === 0 || /^https?:\/\//i.test(v),
    'Base URL 须以 http:// 或 https:// 开头',
  );

const optionalName = z.string().trim().max(128);

/** 账号里保存的字段（空 = 未覆盖，回退服务器 .env） */
export const playerLlmSettingsSchema = z.object({
  baseUrl: z.string(),
  model: z.string(),
  embedModel: z.string(),
  directorModel: z.string(),
  enableThinking: z.boolean().nullable(),
  hasApiKey: z.boolean(),
  apiKeyMasked: z.string(),
  effective: z.object({
    source: z.enum(['player', 'env', 'none']),
    baseUrl: z.string(),
    model: z.string(),
    mock: z.boolean(),
  }),
});
export type PlayerLlmSettings = z.infer<typeof playerLlmSettingsSchema>;

export const patchPlayerLlmSettingsSchema = z.object({
  baseUrl: optionalUrl.optional(),
  /** 非空才写入；留空表示保持原 Key */
  apiKey: z.string().max(512).optional(),
  clearApiKey: z.boolean().optional(),
  model: optionalName.optional(),
  embedModel: optionalName.optional(),
  directorModel: optionalName.optional(),
  /** null = 跟随服务器默认 */
  enableThinking: z.boolean().nullable().optional(),
});
export type PatchPlayerLlmSettings = z.infer<
  typeof patchPlayerLlmSettingsSchema
>;

/** 连通性探测：可带未保存的草稿覆盖 */
export const testPlayerLlmSettingsSchema = patchPlayerLlmSettingsSchema;
export type TestPlayerLlmSettings = z.infer<typeof testPlayerLlmSettingsSchema>;

export const llmTestResultSchema = z.object({
  ok: z.boolean(),
  model: z.string(),
  preview: z.string().optional(),
  message: z.string().optional(),
});
export type LlmTestResult = z.infer<typeof llmTestResultSchema>;
