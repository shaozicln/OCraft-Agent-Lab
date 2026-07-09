import { z } from 'zod';
/** 玩家自行填写的扩展资料（JSONB） */
export declare const playerExtraSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export type PlayerExtra = z.infer<typeof playerExtraSchema>;
export declare const playerGenderSchema: z.ZodEnum<{
    male: "male";
    female: "female";
    other: "other";
    undisclosed: "undisclosed";
}>;
export type PlayerGender = z.infer<typeof playerGenderSchema>;
export declare const playerProfileSchema: z.ZodObject<{
    id: z.ZodString;
    realName: z.ZodNullable<z.ZodString>;
    onlineName: z.ZodNullable<z.ZodString>;
    jobTitle: z.ZodNullable<z.ZodString>;
    gender: z.ZodNullable<z.ZodEnum<{
        male: "male";
        female: "female";
        other: "other";
        undisclosed: "undisclosed";
    }>>;
    age: z.ZodNullable<z.ZodNumber>;
    birthday: z.ZodNullable<z.ZodString>;
    extra: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type PlayerProfile = z.infer<typeof playerProfileSchema>;
export declare const updatePlayerProfilePayloadSchema: z.ZodObject<{
    playerId: z.ZodString;
    realName: z.ZodOptional<z.ZodString>;
    onlineName: z.ZodOptional<z.ZodString>;
    jobTitle: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodEnum<{
        male: "male";
        female: "female";
        other: "other";
        undisclosed: "undisclosed";
    }>>;
    age: z.ZodOptional<z.ZodNumber>;
    birthday: z.ZodOptional<z.ZodString>;
    extra: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type UpdatePlayerProfilePayload = z.infer<typeof updatePlayerProfilePayloadSchema>;
