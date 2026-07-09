import { z } from 'zod';
/** 登录用户名：2–32 位，中文 / 字母 / 数字 / 下划线 */
export declare const usernameSchema: z.ZodString;
export declare const passwordSchema: z.ZodString;
export declare const registerPayloadSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const loginPayloadSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const authSessionSchema: z.ZodObject<{
    playerId: z.ZodString;
    username: z.ZodString;
    token: z.ZodString;
}, z.core.$strip>;
export type RegisterPayload = z.infer<typeof registerPayloadSchema>;
export type LoginPayload = z.infer<typeof loginPayloadSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
/** 将 Zod 校验错误转成用户可读的中文提示 */
export declare function formatAuthValidationError(error: z.ZodError): string;
