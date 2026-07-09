import { z } from 'zod';
import { chapterStateSchema } from './ws.schema';

export const vec3Schema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
]);

export const npcMemorySchema = z.object({
  id: z.string(),
  tags: z.array(z.string()),
  keywords: z.array(z.string()),
  content: z.string(),
  /** 解锁此记忆的最低章节，默认 daily */
  min_chapter: chapterStateSchema.optional(),
});

export const npcMetaSchema = z.object({
  avatar: z.string(),
  model_path: z.string(),
  scale: vec3Schema,
  spawn_position: vec3Schema,
});

export const npcAttributesSchema = z.object({
  fatigue: z.number(),
  max_fatigue: z.number(),
  affinity: z.number(),
  current_status: z.string(),
  /** 好感度触发主词，玩家输入命中任一词（含 favorite_synonyms）时好感 +10 */
  favorite_things: z.array(z.string()),
  /** 主词 → 同义词/相关词，与 favorite_things 一并作为好感触发词 */
  favorite_synonyms: z.record(z.string(), z.array(z.string())).optional(),
});

export const npcDefinitionSchema = z.object({
  npc_id: z.string(),
  name: z.string(),
  meta: npcMetaSchema,
  attributes: npcAttributesSchema,
  system_prompt_template: z.string(),
  memories: z.array(npcMemorySchema),
});

export const npcRuntimeStateSchema = z.object({
  fatigue: z.number(),
  affinity: z.number(),
  current_status: z.string(),
});

export const npcPublicResponseSchema = z.object({
  npc_id: z.string(),
  name: z.string(),
  meta: npcMetaSchema,
  runtime: npcRuntimeStateSchema,
  max_fatigue: z.number(),
});

export type NpcMemory = z.infer<typeof npcMemorySchema>;
export type NpcMeta = z.infer<typeof npcMetaSchema>;
export type NpcAttributes = z.infer<typeof npcAttributesSchema>;
export type NpcDefinition = z.infer<typeof npcDefinitionSchema>;
export type NpcRuntimeState = z.infer<typeof npcRuntimeStateSchema>;
export type NpcPublicResponse = z.infer<typeof npcPublicResponseSchema>;
