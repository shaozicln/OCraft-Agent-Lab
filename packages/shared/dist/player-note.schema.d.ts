import { z } from 'zod';
/** Mem-P：本局玩家要点可见性 */
export declare const playerNoteVisibilitySchema: z.ZodEnum<{
    public: "public";
    whisper: "whisper";
}>;
export type PlayerNoteVisibility = z.infer<typeof playerNoteVisibilitySchema>;
/**
 * Mem-P：run 级玩家要点笔记（非 Pack canon）。
 * 服务台词连贯；升章/结局仍走 Pack 规则。
 */
export declare const playerNoteSchema: z.ZodObject<{
    id: z.ZodString;
    text: z.ZodString;
    keywords: z.ZodDefault<z.ZodArray<z.ZodString>>;
    source_npc_id: z.ZodOptional<z.ZodString>;
    chapter_id: z.ZodString;
    visibility: z.ZodDefault<z.ZodEnum<{
        public: "public";
        whisper: "whisper";
    }>>;
    at: z.ZodString;
    conf: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type PlayerNote = z.infer<typeof playerNoteSchema>;
export declare const MAX_PLAYER_NOTES_PER_RUN = 40;
export declare const MAX_PLAYER_NOTES_INJECT = 12;
export declare const MAX_PLAYER_NOTES_PER_TURN = 3;
