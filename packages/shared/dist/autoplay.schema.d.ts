import { z } from 'zod';
/** 自动演目标（MA-A-B）：只写条件，不写死玩家句 */
export declare const autoPlayGoalSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    world_id: z.ZodOptional<z.ZodString>;
    pack_version_id: z.ZodOptional<z.ZodString>;
    npc_id: z.ZodString;
    target_chapter: z.ZodOptional<z.ZodString>;
    target_exchange: z.ZodOptional<z.ZodString>;
    max_turns: z.ZodDefault<z.ZodNumber>;
    wait_ms: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type AutoPlayGoal = z.infer<typeof autoPlayGoalSchema>;
export declare const autoPlayStatusSchema: z.ZodEnum<{
    abort: "abort";
    done: "done";
    idle: "idle";
    running: "running";
    paused: "paused";
}>;
export type AutoPlayStatus = z.infer<typeof autoPlayStatusSchema>;
export declare const autoPlayNextProposalSchema: z.ZodObject<{
    say: z.ZodOptional<z.ZodString>;
    done: z.ZodBoolean;
    reason: z.ZodDefault<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<{
        agent: "agent";
        mock: "mock";
    }>>;
}, z.core.$strip>;
export type AutoPlayNextProposal = z.infer<typeof autoPlayNextProposalSchema>;
/**
 * feel 默认目标：导演驱动，推到裂痕并尽量触发首次互聊（无写死玩家句）
 */
export declare const FEEL_DEMO_AUTO_GOAL: AutoPlayGoal;
