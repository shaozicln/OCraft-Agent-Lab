import { z } from 'zod';
/** 玩家自行填写的扩展资料（JSONB） */
export declare const playerProfileFieldSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    value: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type PlayerProfileField = z.infer<typeof playerProfileFieldSchema>;
/**
 * extra 约定：
 * - fields: 可增删的本世界人设项（含个人设定）
 * - 其余键保留兼容
 */
export declare const playerExtraSchema: z.ZodObject<{
    fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        value: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$catchall<z.ZodUnknown>>;
export type PlayerExtra = z.infer<typeof playerExtraSchema>;
export declare const playerGenderSchema: z.ZodEnum<{
    male: "male";
    female: "female";
    other: "other";
    undisclosed: "undisclosed";
}>;
export type PlayerGender = z.infer<typeof playerGenderSchema>;
/** 从资料列 / extra 解析出可编辑字段列表（加载用） */
export declare function resolveProfileFields(profile: {
    realName?: string | null;
    onlineName?: string | null;
    jobTitle?: string | null;
    gender?: string | null;
    age?: number | null;
    birthday?: string | null;
    extra?: PlayerExtra | null;
}): PlayerProfileField[];
/** 保存时：fields → extra，并尽量回写已知列 */
export declare function profileFieldsToPatch(fields: PlayerProfileField[]): {
    realName: string | null;
    onlineName: string | null;
    jobTitle: string | null;
    gender: PlayerGender | null;
    age: number | null;
    birthday: string | null;
    extra: PlayerExtra;
};
/** 账号层（全局，与剧情包无关） */
export declare const playerAccountSchema: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type PlayerAccount = z.infer<typeof playerAccountSchema>;
/** 改用户名 / 密码（改任一都需当前密码） */
export declare const patchMyAccountSchema: z.ZodObject<{
    username: z.ZodOptional<z.ZodString>;
    currentPassword: z.ZodString;
    newPassword: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PatchMyAccount = z.infer<typeof patchMyAccountSchema>;
/**
 * 某 Pack 版本下的角色人设（按 player + world + pack_version 隔离）
 */
export declare const playerPackProfileSchema: z.ZodObject<{
    playerId: z.ZodString;
    worldId: z.ZodString;
    packVersionId: z.ZodString;
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
    extra: z.ZodObject<{
        fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            value: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$catchall<z.ZodUnknown>>;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type PlayerPackProfile = z.infer<typeof playerPackProfileSchema>;
export declare const patchPlayerPackProfileSchema: z.ZodObject<{
    worldId: z.ZodString;
    packVersionId: z.ZodString;
    realName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    onlineName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    jobTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    gender: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        male: "male";
        female: "female";
        other: "other";
        undisclosed: "undisclosed";
    }>>>;
    age: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    birthday: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    extra: z.ZodOptional<z.ZodObject<{
        fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            value: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$catchall<z.ZodUnknown>>>;
}, z.core.$strip>;
export type PatchPlayerPackProfile = z.infer<typeof patchPlayerPackProfileSchema>;
/** @deprecated 兼容旧名：账号 + 当前包人设的拼装由前端自行组合 */
export declare const playerProfileSchema: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    realName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    onlineName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    jobTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    gender: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        male: "male";
        female: "female";
        other: "other";
        undisclosed: "undisclosed";
    }>>>;
    age: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    birthday: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    extra: z.ZodOptional<z.ZodObject<{
        fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            value: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$catchall<z.ZodUnknown>>>;
}, z.core.$strip>;
export type PlayerProfile = z.infer<typeof playerProfileSchema>;
/** @deprecated 使用 patchPlayerPackProfileSchema */
export declare const patchMyProfileSchema: z.ZodObject<{
    realName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    onlineName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    jobTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    gender: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        male: "male";
        female: "female";
        other: "other";
        undisclosed: "undisclosed";
    }>>>;
    age: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    birthday: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    extra: z.ZodOptional<z.ZodObject<{
        fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            value: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$catchall<z.ZodUnknown>>>;
}, z.core.$strip>;
export type PatchMyProfile = z.infer<typeof patchMyProfileSchema>;
/** @deprecated */
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
    extra: z.ZodOptional<z.ZodObject<{
        fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            value: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$catchall<z.ZodUnknown>>>;
}, z.core.$strip>;
export type UpdatePlayerProfilePayload = z.infer<typeof updatePlayerProfilePayloadSchema>;
