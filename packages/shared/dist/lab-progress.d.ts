import { z } from 'zod';
/** MA-Lab：平级 tick 预算与任务进度（纯逻辑，可 Eval） */
export declare const LAB_ROUND_PEER_LINE_CAP = 3;
export declare const LAB_SESSION_PEER_LINE_CAP = 12;
export declare const labStopReasonSchema: z.ZodEnum<{
    whisper: "whisper";
    complete: "complete";
    budget_round: "budget_round";
    budget_session: "budget_session";
    no_candidates: "no_candidates";
    disabled: "disabled";
}>;
export type LabStopReason = z.infer<typeof labStopReasonSchema>;
export declare const labProgressStatusSchema: z.ZodEnum<{
    abort: "abort";
    done: "done";
    idle: "idle";
    running: "running";
}>;
export type LabProgressStatus = z.infer<typeof labProgressStatusSchema>;
export declare const labProgressSnapshotSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    status: z.ZodEnum<{
        abort: "abort";
        done: "done";
        idle: "idle";
        running: "running";
    }>;
    sessionPeerLines: z.ZodNumber;
    sessionPeerLineCap: z.ZodNumber;
    roundIndex: z.ZodNumber;
    roundPeerLines: z.ZodNumber;
    roundPeerLineCap: z.ZodNumber;
    candidateCount: z.ZodNumber;
    spokenNpcIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    stopReason: z.ZodOptional<z.ZodEnum<{
        whisper: "whisper";
        complete: "complete";
        budget_round: "budget_round";
        budget_session: "budget_session";
        no_candidates: "no_candidates";
        disabled: "disabled";
    }>>;
}, z.core.$strip>;
export type LabProgressSnapshot = z.infer<typeof labProgressSnapshotSchema>;
export declare class LabProgressMonitor {
    readonly sessionPeerLineCap: number;
    readonly roundPeerLineCap: number;
    sessionPeerLines: number;
    roundIndex: number;
    roundPeerLines: number;
    spokenNpcIds: string[];
    status: LabProgressStatus;
    stopReason?: LabStopReason;
    constructor(sessionPeerLineCap?: number, roundPeerLineCap?: number);
    resetSession(): void;
    /** 玩家一句后的平级 tick 开始 */
    beginRound(candidateCount: number): LabProgressSnapshot;
    canSpeakMore(candidateCount: number): boolean;
    recordUtterance(npcId: string, candidateCount: number): LabProgressSnapshot;
    complete(reason?: LabStopReason): LabProgressSnapshot;
    abort(reason: LabStopReason): LabProgressSnapshot;
    snapshot(candidateCount: number): LabProgressSnapshot;
}
