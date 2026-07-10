import { z } from 'zod';
import { playerIdSchema } from './ws.schema';
import { passwordSchema, usernameSchema } from './auth.schema';

/** 玩家自行填写的扩展资料（JSONB） */
export const playerProfileFieldSchema = z.object({
  id: z.string().min(1).max(64),
  /** 展示名，如「岗位」「宝剑名称」 */
  label: z.string().min(1).max(64),
  value: z.string().max(500).default(''),
});
export type PlayerProfileField = z.infer<typeof playerProfileFieldSchema>;

/**
 * extra 约定：
 * - fields: 可增删的本世界人设项（含个人设定）
 * - 其余键保留兼容
 */
export const playerExtraSchema = z
  .object({
    fields: z.array(playerProfileFieldSchema).optional(),
  })
  .catchall(z.unknown());
export type PlayerExtra = z.infer<typeof playerExtraSchema>;

export const playerGenderSchema = z.enum([
  'male',
  'female',
  'other',
  'undisclosed',
]);
export type PlayerGender = z.infer<typeof playerGenderSchema>;

/** 从资料列 / extra 解析出可编辑字段列表（加载用） */
export function resolveProfileFields(profile: {
  realName?: string | null;
  onlineName?: string | null;
  jobTitle?: string | null;
  gender?: string | null;
  age?: number | null;
  birthday?: string | null;
  extra?: PlayerExtra | null;
}): PlayerProfileField[] {
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

  const fields: PlayerProfileField[] = [];
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
export function profileFieldsToPatch(fields: PlayerProfileField[]): {
  realName: string | null;
  onlineName: string | null;
  jobTitle: string | null;
  gender: PlayerGender | null;
  age: number | null;
  birthday: string | null;
  extra: PlayerExtra;
} {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const find = (...ids: string[]) => {
    for (const id of ids) {
      const f = byId.get(id);
      if (f?.value.trim()) return f.value.trim();
    }
    const byLabel = fields.find((f) => ids.includes(f.label));
    return byLabel?.value.trim() || null;
  };

  const genderRaw = find('gender', '性别');
  const gender =
    genderRaw &&
    ['male', 'female', 'other', 'undisclosed'].includes(genderRaw)
      ? (genderRaw as PlayerGender)
      : null;

  const ageRaw = find('age', '年龄');
  const age = ageRaw && Number.isFinite(Number(ageRaw)) ? Number(ageRaw) : null;

  const birthdayRaw = find('birthday', '生日');
  const birthday =
    birthdayRaw && /^\d{4}-\d{2}-\d{2}$/.test(birthdayRaw) ? birthdayRaw : null;

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
export const playerAccountSchema = z.object({
  id: playerIdSchema,
  username: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlayerAccount = z.infer<typeof playerAccountSchema>;

/** 改用户名 / 密码（改任一都需当前密码） */
export const patchMyAccountSchema = z
  .object({
    username: usernameSchema.optional(),
    currentPassword: passwordSchema,
    newPassword: passwordSchema.optional(),
  })
  .refine(
    (v) => v.username !== undefined || v.newPassword !== undefined,
    { message: '请至少修改用户名或密码' },
  );
export type PatchMyAccount = z.infer<typeof patchMyAccountSchema>;

/**
 * 某 Pack 版本下的角色人设（按 player + world + pack_version 隔离）
 */
export const playerPackProfileSchema = z.object({
  playerId: playerIdSchema,
  worldId: z.string().min(1),
  packVersionId: z.string().min(1),
  /** 真名 / 公司用户名（工牌、协作软件显示名） */
  realName: z.string().min(1).max(64).nullable(),
  /** 游戏内网名 */
  onlineName: z.string().min(1).max(64).nullable(),
  /** 公司岗位 */
  jobTitle: z.string().min(1).max(64).nullable(),
  gender: playerGenderSchema.nullable(),
  age: z.number().int().min(0).max(150).nullable(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  extra: playerExtraSchema,
  updatedAt: z.string(),
});
export type PlayerPackProfile = z.infer<typeof playerPackProfileSchema>;

export const patchPlayerPackProfileSchema = z.object({
  worldId: z.string().min(1),
  packVersionId: z.string().min(1),
  realName: z.string().min(1).max(64).nullable().optional(),
  onlineName: z.string().min(1).max(64).nullable().optional(),
  jobTitle: z.string().min(1).max(64).nullable().optional(),
  gender: playerGenderSchema.nullable().optional(),
  age: z.number().int().min(0).max(150).nullable().optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  extra: playerExtraSchema.optional(),
});
export type PatchPlayerPackProfile = z.infer<typeof patchPlayerPackProfileSchema>;

/** @deprecated 兼容旧名：账号 + 当前包人设的拼装由前端自行组合 */
export const playerProfileSchema = playerAccountSchema.extend({
  realName: z.string().min(1).max(64).nullable().optional(),
  onlineName: z.string().min(1).max(64).nullable().optional(),
  jobTitle: z.string().min(1).max(64).nullable().optional(),
  gender: playerGenderSchema.nullable().optional(),
  age: z.number().int().min(0).max(150).nullable().optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  extra: playerExtraSchema.optional(),
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;

/** @deprecated 使用 patchPlayerPackProfileSchema */
export const patchMyProfileSchema = patchPlayerPackProfileSchema.omit({
  worldId: true,
  packVersionId: true,
});
export type PatchMyProfile = z.infer<typeof patchMyProfileSchema>;

/** @deprecated */
export const updatePlayerProfilePayloadSchema = z.object({
  playerId: playerIdSchema,
  realName: z.string().min(1).max(64).optional(),
  onlineName: z.string().min(1).max(64).optional(),
  jobTitle: z.string().min(1).max(64).optional(),
  gender: playerGenderSchema.optional(),
  age: z.number().int().min(0).max(150).optional(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  extra: playerExtraSchema.optional(),
});
export type UpdatePlayerProfilePayload = z.infer<
  typeof updatePlayerProfilePayloadSchema
>;
