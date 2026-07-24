import type { AutoPlayGoal, AutoPlayStatus } from './autoplay.schema';
import { isAutoPlayGoalReached } from './autoplay-propose';

/** 自动演会话游标（目标驱动，无写死拍脚本） */
export class AutoPlaySession {
  status: AutoPlayStatus = 'idle';
  /** 已完成的拍数（即将执行的是 turnIndex） */
  turnIndex = 0;
  failReason?: string;
  sawTargetExchange = false;

  constructor(readonly goal: AutoPlayGoal) {}

  get progressLabel(): string {
    return `${Math.min(this.turnIndex + 1, this.goal.max_turns)}/${this.goal.max_turns}`;
  }

  start(): boolean {
    if (this.status === 'running' || this.status === 'paused') return false;
    this.status = 'running';
    this.turnIndex = 0;
    this.failReason = undefined;
    this.sawTargetExchange = false;
    return true;
  }

  pause(): boolean {
    if (this.status !== 'running') return false;
    this.status = 'paused';
    return true;
  }

  resume(): boolean {
    if (this.status !== 'paused') return false;
    this.status = 'running';
    return true;
  }

  stop(reason = '接管'): void {
    if (this.status === 'idle' || this.status === 'done') return;
    this.status = 'abort';
    this.failReason = reason;
  }

  markExchange(eventId: string | null | undefined): void {
    if (
      eventId &&
      this.goal.target_exchange &&
      eventId === this.goal.target_exchange
    ) {
      this.sawTargetExchange = true;
    }
  }

  /** 本拍成功后推进；达上限 → done */
  advance(): void {
    if (this.status !== 'running') return;
    this.turnIndex += 1;
    if (this.turnIndex >= this.goal.max_turns) {
      this.status = 'done';
    }
  }

  complete(reason = '目标达成'): void {
    if (this.status !== 'running' && this.status !== 'paused') return;
    this.status = 'done';
    this.failReason = undefined;
    void reason;
  }

  fail(reason: string): void {
    this.status = 'abort';
    this.failReason = reason;
  }

  goalReached(chapter?: string): boolean {
    return isAutoPlayGoalReached(this.goal, {
      chapter,
      sawTargetExchange: this.sawTargetExchange,
    });
  }

  isActive(): boolean {
    return this.status === 'running' || this.status === 'paused';
  }

  locksInput(): boolean {
    return this.status === 'running' || this.status === 'paused';
  }
}
