"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoPlaySession = void 0;
const autoplay_propose_1 = require("./autoplay-propose");
/** 自动演会话游标（目标驱动，无写死拍脚本） */
class AutoPlaySession {
    goal;
    status = 'idle';
    /** 正片 main；达结局且勾选后 epilogue（杀青） */
    phase = 'main';
    /** 已完成的拍数（即将执行的是 turnIndex） */
    turnIndex = 0;
    /** 当前章内已发言次数（换章清零） */
    chapterSpeakCount = 0;
    chapterIdForCap;
    /** 已顶到章发言上限，等待用户选保持/加速（不硬停） */
    needsAcceleratePrompt = false;
    /** 接管介入中：暂停自动拍，允许玩家输入 */
    intervening = false;
    /** 本局是否处于加速 */
    accelerate = false;
    failReason;
    sawTargetExchange = false;
    constructor(goal) {
        this.goal = goal;
        this.accelerate = goal.accelerate === true;
    }
    get progressLabel() {
        const cap = this.goal.chapter_speak_cap;
        const prefix = this.phase === 'epilogue' ? '杀青 · ' : '';
        return `${prefix}章内 ${this.chapterSpeakCount}/${cap} · 总 ${this.turnIndex}`;
    }
    start() {
        if (this.status === 'running' || this.status === 'paused')
            return false;
        this.status = 'running';
        this.phase = 'main';
        this.turnIndex = 0;
        this.chapterSpeakCount = 0;
        this.chapterIdForCap = undefined;
        this.needsAcceleratePrompt = false;
        this.intervening = false;
        this.accelerate = this.goal.accelerate === true;
        this.failReason = undefined;
        this.sawTargetExchange = false;
        return true;
    }
    /** 正片达结局后进入杀青；保持 running，不再用 goalReached 收束 */
    enterEpilogue() {
        if (this.phase === 'epilogue')
            return false;
        if (this.status !== 'running' && this.status !== 'paused')
            return false;
        if (!this.goal.enter_epilogue)
            return false;
        this.phase = 'epilogue';
        this.status = 'running';
        this.intervening = false;
        this.accelerate = false;
        this.needsAcceleratePrompt = false;
        return true;
    }
    pause() {
        if (this.status !== 'running')
            return false;
        this.status = 'paused';
        return true;
    }
    resume() {
        if (this.status !== 'paused')
            return false;
        if (this.intervening)
            return false;
        this.status = 'running';
        return true;
    }
    /** 接管：暂停自动拍，解锁输入 */
    enterIntervene() {
        if (this.status !== 'running' && this.status !== 'paused')
            return false;
        this.status = 'paused';
        this.intervening = true;
        return true;
    }
    /** 交回：继续自动演 */
    handBack() {
        if (!this.intervening || this.status !== 'paused')
            return false;
        this.intervening = false;
        this.status = 'running';
        return true;
    }
    stop(reason = '停止') {
        if (this.status === 'idle' || this.status === 'done')
            return;
        this.status = 'abort';
        this.intervening = false;
        this.failReason = reason;
    }
    markExchange(eventId) {
        if (eventId &&
            this.goal.target_exchange &&
            eventId === this.goal.target_exchange) {
            this.sawTargetExchange = true;
        }
    }
    setAccelerate(on) {
        this.accelerate = on;
        if (on)
            this.needsAcceleratePrompt = false;
    }
    /**
     * 本拍成功后推进；换章清零章内计数。
     * 顶到 chapter_speak_cap → 置 needsAcceleratePrompt，不自动 done。
     */
    advance(chapterId) {
        if (this.status !== 'running')
            return;
        this.turnIndex += 1;
        if (chapterId && chapterId !== this.chapterIdForCap) {
            this.chapterIdForCap = chapterId;
            this.chapterSpeakCount = 1;
            this.needsAcceleratePrompt = false;
        }
        else {
            this.chapterSpeakCount += 1;
        }
        if (this.chapterSpeakCount >= this.goal.chapter_speak_cap) {
            this.needsAcceleratePrompt = true;
        }
    }
    clearAcceleratePrompt() {
        this.needsAcceleratePrompt = false;
    }
    complete(reason = '目标达成') {
        if (this.status !== 'running' && this.status !== 'paused')
            return;
        this.status = 'done';
        this.intervening = false;
        this.failReason = undefined;
        void reason;
    }
    fail(reason) {
        this.status = 'abort';
        this.intervening = false;
        this.failReason = reason;
    }
    goalReached(chapter, endingId) {
        if (this.phase === 'epilogue')
            return false;
        return (0, autoplay_propose_1.isAutoPlayGoalReached)(this.goal, {
            chapter,
            sawTargetExchange: this.sawTargetExchange,
            endingId,
        });
    }
    isActive() {
        return this.status === 'running' || this.status === 'paused';
    }
    locksInput() {
        if (this.intervening)
            return false;
        return this.status === 'running' || this.status === 'paused';
    }
}
exports.AutoPlaySession = AutoPlaySession;
