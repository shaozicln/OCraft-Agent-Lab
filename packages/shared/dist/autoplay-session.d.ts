import type { AutoPlayGoal, AutoPlayStatus } from './autoplay.schema';
/** 自动演会话游标（目标驱动，无写死拍脚本） */
export declare class AutoPlaySession {
    readonly goal: AutoPlayGoal;
    status: AutoPlayStatus;
    /** 已完成的拍数（即将执行的是 turnIndex） */
    turnIndex: number;
    failReason?: string;
    sawTargetExchange: boolean;
    constructor(goal: AutoPlayGoal);
    get progressLabel(): string;
    start(): boolean;
    pause(): boolean;
    resume(): boolean;
    stop(reason?: string): void;
    markExchange(eventId: string | null | undefined): void;
    /** 本拍成功后推进；达上限 → done */
    advance(): void;
    complete(reason?: string): void;
    fail(reason: string): void;
    goalReached(chapter?: string): boolean;
    isActive(): boolean;
    locksInput(): boolean;
}
