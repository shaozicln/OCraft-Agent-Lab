"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePlayerProfilePayloadSchema = exports.patchMyProfileSchema = exports.playerProfileSchema = exports.patchPlayerPackProfileSchema = exports.playerPackProfileSchema = exports.patchMyAccountSchema = exports.playerAccountSchema = exports.playerGenderSchema = exports.playerExtraSchema = exports.playerProfileFieldSchema = void 0;
exports.resolveProfileFields = resolveProfileFields;
exports.profileFieldsToPatch = profileFieldsToPatch;
const zod_1 = require("zod");
const ws_schema_1 = require("./ws.schema");
const auth_schema_1 = require("./auth.schema");
/** 玩家自行填写的扩展资料（JSONB） */
exports.playerProfileFieldSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64),
    /** 展示名，如「岗位」「宝剑名称」 */
    label: zod_1.z.string().min(1).max(64),
    value: zod_1.z.string().max(500).default(''),
});
/**
 * extra 约定：
 * - fields: 可增删的本世界人设项（含个人设定）
 * - 其余键保留兼容
 */
exports.playerExtraSchema = zod_1.z
    .object({
    fields: zod_1.z.array(exports.playerProfileFieldSchema).optional(),
})
    .catchall(zod_1.z.unknown());
exports.playerGenderSchema = zod_1.z.enum([
    'male',
    'female',
    'other',
    'undisclosed',
]);
/** 从资料列 / extra 解析出可编辑字段列表（加载用） */
function resolveProfileFields(profile) {
    const extra = profile.extra ?? {};
    const raw = extra.fields;
    // 已写入 fields（含空数组）→ 以 JSON 为准，不再回退到列
    if (Array.isArray(raw)) {
        return raw.map((f, i) => ({
            id: typeof f.id === 'string' && f.id ? f.id : `field_${i}`,
            label: typeof f.label === 'string' && f.label ? f.label : `字段${i + 1}`,
            value: typeof f.value === 'string' ? f.value : '',
        }));
    }
    const fields = [];
    if (profile.realName)
        fields.push({ id: 'realName', label: '真名', value: profile.realName });
    if (profile.onlineName)
        fields.push({ id: 'onlineName', label: '网名', value: profile.onlineName });
    if (profile.jobTitle)
        fields.push({ id: 'jobTitle', label: '岗位', value: profile.jobTitle });
    if (profile.gender)
        fields.push({ id: 'gender', label: '性别', value: profile.gender });
    if (profile.age != null)
        fields.push({ id: 'age', label: '年龄', value: String(profile.age) });
    if (profile.birthday)
        fields.push({ id: 'birthday', label: '生日', value: profile.birthday });
    if (typeof extra.notes === 'string' && extra.notes) {
        fields.push({ id: 'notes', label: '个人设定', value: extra.notes });
    }
    if (fields.length === 0) {
        return [
            { id: 'realName', label: '真名', value: '' },
            { id: 'onlineName', label: '网名', value: '' },
            { id: 'jobTitle', label: '岗位', value: '' },
            { id: 'notes', label: '个人设定', value: '' },
        ];
    }
    return fields;
}
/** 保存时：fields → extra，并尽量回写已知列 */
function profileFieldsToPatch(fields) {
    const byId = new Map(fields.map((f) => [f.id, f]));
    const find = (...ids) => {
        for (const id of ids) {
            const f = byId.get(id);
            if (f?.value.trim())
                return f.value.trim();
        }
        const byLabel = fields.find((f) => ids.includes(f.label));
        return byLabel?.value.trim() || null;
    };
    const genderRaw = find('gender', '性别');
    const gender = genderRaw &&
        ['male', 'female', 'other', 'undisclosed'].includes(genderRaw)
        ? genderRaw
        : null;
    const ageRaw = find('age', '年龄');
    const age = ageRaw && Number.isFinite(Number(ageRaw)) ? Number(ageRaw) : null;
    const birthdayRaw = find('birthday', '生日');
    const birthday = birthdayRaw && /^\d{4}-\d{2}-\d{2}$/.test(birthdayRaw) ? birthdayRaw : null;
    return {
        realName: find('realName', '真名'),
        onlineName: find('onlineName', '网名'),
        jobTitle: find('jobTitle', '岗位'),
        gender,
        age,
        birthday,
        extra: { fields },
    };
}
/** 账号层（全局，与剧情包无关） */
exports.playerAccountSchema = zod_1.z.object({
    id: ws_schema_1.playerIdSchema,
    username: zod_1.z.string().min(1),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
/** 改用户名 / 密码（改任一都需当前密码） */
exports.patchMyAccountSchema = zod_1.z
    .object({
    username: auth_schema_1.usernameSchema.optional(),
    currentPassword: auth_schema_1.passwordSchema,
    newPassword: auth_schema_1.passwordSchema.optional(),
})
    .refine((v) => v.username !== undefined || v.newPassword !== undefined, { message: '请至少修改用户名或密码' });
/**
 * 某 Pack 版本下的角色人设（按 player + world + pack_version 隔离）
 */
exports.playerPackProfileSchema = zod_1.z.object({
    playerId: ws_schema_1.playerIdSchema,
    worldId: zod_1.z.string().min(1),
    packVersionId: zod_1.z.string().min(1),
    /** 真名 / 公司用户名（工牌、协作软件显示名） */
    realName: zod_1.z.string().min(1).max(64).nullable(),
    /** 游戏内网名 */
    onlineName: zod_1.z.string().min(1).max(64).nullable(),
    /** 公司岗位 */
    jobTitle: zod_1.z.string().min(1).max(64).nullable(),
    gender: exports.playerGenderSchema.nullable(),
    age: zod_1.z.number().int().min(0).max(150).nullable(),
    birthday: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
    extra: exports.playerExtraSchema,
    updatedAt: zod_1.z.string(),
});
exports.patchPlayerPackProfileSchema = zod_1.z.object({
    worldId: zod_1.z.string().min(1),
    packVersionId: zod_1.z.string().min(1),
    realName: zod_1.z.string().min(1).max(64).nullable().optional(),
    onlineName: zod_1.z.string().min(1).max(64).nullable().optional(),
    jobTitle: zod_1.z.string().min(1).max(64).nullable().optional(),
    gender: exports.playerGenderSchema.nullable().optional(),
    age: zod_1.z.number().int().min(0).max(150).nullable().optional(),
    birthday: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
    extra: exports.playerExtraSchema.optional(),
});
/** @deprecated 兼容旧名：账号 + 当前包人设的拼装由前端自行组合 */
exports.playerProfileSchema = exports.playerAccountSchema.extend({
    realName: zod_1.z.string().min(1).max(64).nullable().optional(),
    onlineName: zod_1.z.string().min(1).max(64).nullable().optional(),
    jobTitle: zod_1.z.string().min(1).max(64).nullable().optional(),
    gender: exports.playerGenderSchema.nullable().optional(),
    age: zod_1.z.number().int().min(0).max(150).nullable().optional(),
    birthday: zod_1.z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
    extra: exports.playerExtraSchema.optional(),
});
/** @deprecated 使用 patchPlayerPackProfileSchema */
exports.patchMyProfileSchema = exports.patchPlayerPackProfileSchema.omit({
    worldId: true,
    packVersionId: true,
});
/** @deprecated */
exports.updatePlayerProfilePayloadSchema = zod_1.z.object({
    playerId: ws_schema_1.playerIdSchema,
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
