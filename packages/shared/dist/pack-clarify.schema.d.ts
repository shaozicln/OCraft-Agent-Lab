import { z } from 'zod';
export declare const packClarifyOptionSchema: z.ZodObject<{
    key: z.ZodEnum<{
        A: "A";
        B: "B";
        C: "C";
    }>;
    label: z.ZodString;
}, z.core.$strip>;
export declare const packClarifyQuestionSchema: z.ZodObject<{
    id: z.ZodString;
    topic: z.ZodString;
    ask: z.ZodString;
    options: z.ZodArray<z.ZodObject<{
        key: z.ZodEnum<{
            A: "A";
            B: "B";
            C: "C";
        }>;
        label: z.ZodString;
    }, z.core.$strip>>;
    allow_free_text: z.ZodDefault<z.ZodBoolean>;
    allow_polish: z.ZodDefault<z.ZodBoolean>;
    target_hint: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const packClarifySummarySchema: z.ZodObject<{
    world_one_liner: z.ZodString;
    chapters: z.ZodDefault<z.ZodArray<z.ZodString>>;
    npcs: z.ZodDefault<z.ZodArray<z.ZodString>>;
    risks: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const packClarifySessionSchema: z.ZodObject<{
    summary: z.ZodObject<{
        world_one_liner: z.ZodString;
        chapters: z.ZodDefault<z.ZodArray<z.ZodString>>;
        npcs: z.ZodDefault<z.ZodArray<z.ZodString>>;
        risks: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    questions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        topic: z.ZodString;
        ask: z.ZodString;
        options: z.ZodArray<z.ZodObject<{
            key: z.ZodEnum<{
                A: "A";
                B: "B";
                C: "C";
            }>;
            label: z.ZodString;
        }, z.core.$strip>>;
        allow_free_text: z.ZodDefault<z.ZodBoolean>;
        allow_polish: z.ZodDefault<z.ZodBoolean>;
        target_hint: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    done: z.ZodDefault<z.ZodBoolean>;
    source: z.ZodDefault<z.ZodEnum<{
        mock: "mock";
        llm: "llm";
    }>>;
}, z.core.$strip>;
export type PackClarifySession = z.infer<typeof packClarifySessionSchema>;
export type PackClarifyQuestion = z.infer<typeof packClarifyQuestionSchema>;
export declare const packClarifyStartPayloadSchema: z.ZodObject<{
    pack: z.ZodUnknown;
    prompt: z.ZodOptional<z.ZodString>;
    outline: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PackClarifyStartPayload = z.infer<typeof packClarifyStartPayloadSchema>;
export declare const packClarifyAnswerSchema: z.ZodObject<{
    question_id: z.ZodString;
    choice: z.ZodOptional<z.ZodEnum<{
        A: "A";
        B: "B";
        C: "C";
    }>>;
    free_text: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PackClarifyAnswer = z.infer<typeof packClarifyAnswerSchema>;
export declare const packClarifyApplyPayloadSchema: z.ZodObject<{
    pack: z.ZodUnknown;
    questions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        topic: z.ZodString;
        ask: z.ZodString;
        options: z.ZodArray<z.ZodObject<{
            key: z.ZodEnum<{
                A: "A";
                B: "B";
                C: "C";
            }>;
            label: z.ZodString;
        }, z.core.$strip>>;
        allow_free_text: z.ZodDefault<z.ZodBoolean>;
        allow_polish: z.ZodDefault<z.ZodBoolean>;
        target_hint: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    answers: z.ZodArray<z.ZodObject<{
        question_id: z.ZodString;
        choice: z.ZodOptional<z.ZodEnum<{
            A: "A";
            B: "B";
            C: "C";
        }>>;
        free_text: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    skip_remaining: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type PackClarifyApplyPayload = z.infer<typeof packClarifyApplyPayloadSchema>;
export declare const packClarifyApplyResultSchema: z.ZodObject<{
    pack: z.ZodUnknown;
    patch_notes: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const packClarifyPolishPayloadSchema: z.ZodObject<{
    question_id: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    ask: z.ZodOptional<z.ZodString>;
    draft_text: z.ZodString;
    target_hint: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PackClarifyPolishPayload = z.infer<typeof packClarifyPolishPayloadSchema>;
export declare const packClarifyPolishResultSchema: z.ZodObject<{
    type: z.ZodLiteral<"polish">;
    question_id: z.ZodString;
    polished_text: z.ZodString;
    target_hint: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PackClarifyPolishResult = z.infer<typeof packClarifyPolishResultSchema>;
