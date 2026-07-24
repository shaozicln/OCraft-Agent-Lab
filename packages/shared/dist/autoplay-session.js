"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoPlaySession = void 0;
const autoplay_propose_1 = require("./autoplay-propose");
/** 自动演会话游标（目标驱动，无写死拍脚本） */
class AutoPlaySession {
    goal;
    status = 'idle';
    /** 已完成的拍数（即将执行的是 turnIndex） */
    turnIndex = 0;
    failReason;
    sawTargetExchange = false;
    constructor(goal) {
        this.goal = goal;
    }
    get progressLabel() {
        return `${Math.min(this.turnIndex + 1, this.goal.max_turns)}/${this.goal.max_turns}`;
    }
    start() {
        if (this.status === 'running' || this.status === 'paused')
            return false;
        this.status = 'running';
        this.turnIndex = 0;
        this.failReason = undefined;
        this.sawTargetExchange = false;
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
        this.status = 'running';
        return true;
    }
    stop(reason = '接管') {
        if (this.status === 'idle' || this.status === 'done')
            return;
        this.status = 'abort';
        this.failReason = reason;
    }
    markExchange(eventId) {
        if (eventId &&
            this.goal.target_exchange &&
            eventId === this.goal.target_exchange) {
            this.sawTargetExchange = true;
        }
    }
    /** 本拍成功后推进；达上限 → done */
    advance() {
        if (this.status !== 'running')
            return;
        this.turnIndex += 1;
        if (this.turnIndex >= this.goal.max_turns) {
            this.status = 'done';
        }
    }
    complete(reason = '目标达成') {
        if (this.status !== 'running' && this.status !== 'paused')
            return;
        this.status = 'done';
        this.failReason = undefined;
        void reason;
    }
    fail(reason) {
        this.status = 'abort';
        this.failReason = reason;
    }
    goalReached(chapter) {
        return (0, autoplay_propose_1.isAutoPlayGoalReached)(this.goal, {
            chapter,
            sawTargetExchange: this.sawTargetExchange,
        });
    }
    isActive() {
        return this.status === 'running' || this.status === 'paused';
    }
    locksInput() {
        return this.status === 'running' || this.status === 'paused';
    }
}
exports.AutoPlaySession = AutoPlaySession;
