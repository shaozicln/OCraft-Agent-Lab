import { z } from 'zod';

/** Mem-P：本局玩家要点可见性 */
export const playerNoteVisibilitySchema = z.enum(['public', 'whisper']);
export type PlayerNoteVisibility = z.infer<typeof playerNoteVisibilitySchema>;

/**
 * Mem-P：run 级玩家要点笔记（非 Pack canon）。
 * 服务台词连贯；升章/结局仍走 Pack 规则。
 */
export const playerNoteSchema = z.object({
  id: z.string().min(1),
  /** 一句摘要（给人 / 给 prompt） */
  text: z.string().trim().min(1).max(200),
  keywords: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  /** 对谁说的；公开场可空 */
  source_npc_id: z.string().min(1).max(64).optional(),
  chapter_id: z.string().min(1).max(64),
  visibility: playerNoteVisibilitySchema.default('public'),
  at: z.string(),
  /** 0～1，规则抽取可省略 */
  conf: z.number().min(0).max(1).optional(),
});
export type PlayerNote = z.infer<typeof playerNoteSchema>;

export const MAX_PLAYER_NOTES_PER_RUN = 40;
export const MAX_PLAYER_NOTES_INJECT = 12;
export const MAX_PLAYER_NOTES_PER_TURN = 3;
