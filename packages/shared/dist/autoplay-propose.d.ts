import { type AutoPlayGoal, type AutoPlayNextProposal } from './autoplay.schema';
export type AutoPlayProposeInput = {
    goal: AutoPlayGoal;
    turnIndex: number;
    chapterId: string;
    chapterLabel: string;
    flagNames: string[];
    availableEvents: string[];
    recentLines: string[];
    priorSays: string[];
    focusNpcName: string;
    /** 本局是否已见目标互聊 */
    sawTargetExchange: boolean;
    styleHint?: string;
    /** 加速：尽快升章 / 终章撞结局 */
    accelerate?: boolean;
    /** 上场可点名角色（含可选 player stub） */
    castIds?: string[];
    maxSpeakers?: number;
    /** 本拍是否必须含玩家句（Pack 升章/结局门槛） */
    requirePlayerLine?: boolean;
};
export declare function isAutoPlayGoalReached(goal: AutoPlayGoal, actual: {
    chapter?: string;
    sawTargetExchange?: boolean;
    endingId?: string | null;
}): boolean;
export declare function parseAutoPlayNextJson(raw: string): AutoPlayNextProposal | null;
/**
 * MOCK / 无 key：按章与目标启发式生成下一拍（eval 夹具；运行时自动演禁 MOCK）
 */
export declare function mockProposeAutoPlayNext(input: AutoPlayProposeInput): AutoPlayNextProposal;
