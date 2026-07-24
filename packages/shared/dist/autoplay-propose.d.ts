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
};
export declare function isAutoPlayGoalReached(goal: AutoPlayGoal, actual: {
    chapter?: string;
    sawTargetExchange?: boolean;
}): boolean;
export declare function parseAutoPlayNextJson(raw: string): AutoPlayNextProposal | null;
/**
 * MOCK / 无 key：按章与目标启发式生成下一句（可推进 feel 演示路径）
 */
export declare function mockProposeAutoPlayNext(input: AutoPlayProposeInput): AutoPlayNextProposal;
