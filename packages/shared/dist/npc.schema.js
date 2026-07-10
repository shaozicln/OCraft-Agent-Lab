"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.npcPublicResponseSchema = exports.npcRuntimeStateSchema = exports.npcDefinitionSchema = exports.npcAttributesSchema = exports.npcMetaSchema = exports.npcMemorySchema = exports.vec3Schema = void 0;
const zod_1 = require("zod");
exports.vec3Schema = zod_1.z.tuple([
    zod_1.z.number(),
    zod_1.z.number(),
    zod_1.z.number(),
]);
exports.npcMemorySchema = zod_1.z.object({
    id: zod_1.z.string(),
    tags: zod_1.z.array(zod_1.z.string()),
    keywords: zod_1.z.array(zod_1.z.string()),
    content: zod_1.z.string(),
    /** 解锁此记忆的最低章节 id（由 Pack 声明），默认最低章 */
    min_chapter: zod_1.z.string().min(1).max(64).optional(),
});
exports.npcMetaSchema = zod_1.z.object({
    avatar: zod_1.z.string(),
    model_path: zod_1.z.string(),
    scale: exports.vec3Schema,
    spawn_position: exports.vec3Schema,
});
exports.npcAttributesSchema = zod_1.z.object({
    fatigue: zod_1.z.number(),
    max_fatigue: zod_1.z.number(),
    affinity: zod_1.z.number(),
    current_status: zod_1.z.string(),
    /** 好感度触发主词，玩家输入命中任一词（含 favorite_synonyms）时走 Pack numeric_tools.interest_hit */
    favorite_things: zod_1.z.array(zod_1.z.string()),
    /** 主词 → 同义词/相关词，与 favorite_things 一并作为兴趣触发词 */
    favorite_synonyms: zod_1.z.record(zod_1.z.string(), zod_1.z.array(zod_1.z.string())).optional(),
});
exports.npcDefinitionSchema = zod_1.z.object({
    npc_id: zod_1.z.string(),
    name: zod_1.z.string(),
    meta: exports.npcMetaSchema,
    attributes: exports.npcAttributesSchema,
    system_prompt_template: zod_1.z.string(),
    memories: zod_1.z.array(exports.npcMemorySchema),
});
exports.npcRuntimeStateSchema = zod_1.z.object({
    fatigue: zod_1.z.number(),
    affinity: zod_1.z.number(),
    current_status: zod_1.z.string(),
});
exports.npcPublicResponseSchema = zod_1.z.object({
    npc_id: zod_1.z.string(),
    name: zod_1.z.string(),
    meta: exports.npcMetaSchema,
    runtime: exports.npcRuntimeStateSchema,
    max_fatigue: zod_1.z.number(),
});
