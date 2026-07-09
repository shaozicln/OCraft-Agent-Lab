import { z } from 'zod';

/** 玩家自行填写的扩展资料（JSONB） */
export const playerExtraSchema = z.record(z.string(), z.unknown());
export type PlayerExtra = z.infer<typeof playerExtraSchema>;

export const playerGenderSchema = z.enum([
  'male',
  'female',
  'other',
  'undisclosed',
]);
export type PlayerGender = z.infer<typeof playerGenderSchema>;

export const playerProfileSchema = z.object({
  id: z.string().uuid(),
  /** 真名 / 公司用户名（工牌、协作软件显示名） */
  realName: z.string().min(1).max(64).nullable(),
  /** 游戏内网名（Steam、论坛等；剧情可吐槽「怎么全网同名」） */
  onlineName: z.string().min(1).max(64).nullable(),
  /** 公司岗位（如前端、测试、运营） */
  jobTitle: z.string().min(1).max(64).nullable(),
  gender: playerGenderSchema.nullable(),
  age: z.number().int().min(0).max(150).nullable(),
  /** ISO 日期 YYYY-MM-DD */
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  extra: playerExtraSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;

export const updatePlayerProfilePayloadSchema = z.object({
  playerId: z.string().uuid(),
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
