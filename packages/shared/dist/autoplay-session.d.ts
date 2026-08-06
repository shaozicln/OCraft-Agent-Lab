import type { AutoPlayGoal, AutoPlayPhase, AutoPlayStatus } from './autoplay.schema';
/** 自动演会话游标（目标驱动，无写死拍脚本） */
export declare class AutoPlaySession {
    readonly goal: AutoPlayGoal;
    status: AutoPlayStatus;
    /** 正片 main；达结局且勾选后 epilogue（杀青） */
    phase: AutoPlayPhase;
    /** 已完成的拍数（即将执行的是 turnIndex） */
    turnIndex: number;
    /** 当前章内已发言次数（换章清零） */
    chapterSpeakCount: number;
    chapterIdForCap: string | undefined;
    /** 已顶到章发言上限，等待用户选保持/加速（不硬停） */
    needsAcceleratePrompt: boolean;
    /** 接管介入中：暂停自动拍，允许玩家输入 */
    intervening: boolean;
    /** 本局是否处于加速 */
    accelerate: boolean;
    failReason?: string;
    sawTargetExchange: boolean;
    constructor(goal: AutoPlayGoal);
    get progressLabel(): string;
    start(): boolean;
    /** 正片达结局后进入杀青；保持 running，不再用 goalReached 收束 */
    enterEpilogue(): boolean;
    pause(): boolean;
    resume(): boolean;
    /** 接管：暂停自动拍，解锁输入 */
    enterIntervene(): boolean;
    /** 交回：继续自动演 */
    handBack(): boolean;
    stop(reason?: string): void;
    markExchange(eventId: string | null | undefined): void;
    setAccelerate(on: boolean): void;
    /**
     * 本拍成功后推进；换章清零章内计数。
     * 顶到 chapter_speak_cap → 置 needsAcceleratePrompt，不自动 done。
     */
    advance(chapterId?: string): void;
    clearAcceleratePrompt(): void;
    complete(reason?: string): void;
    fail(reason: string): void;
    goalReached(chapter?: string, endingId?: string | null): boolean;
    isActive(): boolean;
    locksInput(): boolean;
}
