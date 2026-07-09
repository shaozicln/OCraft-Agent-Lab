import { z } from 'zod';

/** 登录用户名：2–32 位，中文 / 字母 / 数字 / 下划线 */
export const usernameSchema = z
  .string()
  .trim()
  .min(2, '用户名至少 2 个字符')
  .max(32, '用户名最多 32 个字符')
  .regex(
    /^[\u4e00-\u9fffA-Za-z0-9_]+$/,
    '用户名只能包含中文、字母、数字和下划线',
  );

export const passwordSchema = z
  .string()
  .min(6, '密码至少 6 位')
  .max(128, '密码最多 128 位');

export const registerPayloadSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const loginPayloadSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const authSessionSchema = z.object({
  playerId: z.string().uuid(),
  username: z.string(),
  token: z.string().min(1),
});

export type RegisterPayload = z.infer<typeof registerPayloadSchema>;
export type LoginPayload = z.infer<typeof loginPayloadSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;

/** 将 Zod 校验错误转成用户可读的中文提示 */
export function formatAuthValidationError(error: z.ZodError): string {
  const messages = error.issues
    .map((issue) => issue.message)
    .filter((msg) => msg.length > 0);
  return [...new Set(messages)].join('；') || '输入格式不正确';
}
