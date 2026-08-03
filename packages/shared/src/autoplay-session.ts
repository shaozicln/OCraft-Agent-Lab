import type { AutoPlayGoal, AutoPlayStatus } from './autoplay.schema';
import { isAutoPlayGoalReached } from './autoplay-propose';

/** 自动演会话游标（目标驱动，无写死拍脚本） */
export class AutoPlaySession {
  status: AutoPlayStatus = 'idle';
  /** 已完成的拍数（即将执行的是 turnIndex） */
  turnIndex = 0;
  /** 当前章内已发言次数（换章清零） */
  chapterSpeakCount = 0;
  chapterIdForCap: string | undefined;
  /** 已顶到章发言上限，等待用户选保持/加速（不硬停） */
  needsAcceleratePrompt = false;
  /** 接管介入中：暂停自动拍，允许玩家输入 */
  intervening = false;
  /** 本局是否处于加速 */
  accelerate = false;
  failReason?: string;
  sawTargetExchange = false;

  constructor(readonly goal: AutoPlayGoal) {
    this.accelerate = goal.accelerate === true;
  }

  get progressLabel(): string {
    const cap = this.goal.chapter_speak_cap;
    return `章内 ${this.chapterSpeakCount}/${cap} · 总 ${this.turnIndex}`;
  }

  start(): boolean {
    if (this.status === 'running' || this.status === 'paused') return false;
    this.status = 'running';
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

  pause(): boolean {
    if (this.status !== 'running') return false;
    this.status = 'paused';
    return true;
  }

  resume(): boolean {
    if (this.status !== 'paused') return false;
    if (this.intervening) return false;
    this.status = 'running';
    return true;
  }

  /** 接管：暂停自动拍，解锁输入 */
  enterIntervene(): boolean {
    if (this.status !== 'running' && this.status !== 'paused') return false;
    this.status = 'paused';
    this.intervening = true;
    return true;
  }

  /** 交回：继续自动演 */
  handBack(): boolean {
    if (!this.intervening || this.status !== 'paused') return false;
    this.intervening = false;
    this.status = 'running';
    return true;
  }

  stop(reason = '停止'): void {
    if (this.status === 'idle' || this.status === 'done') return;
    this.status = 'abort';
    this.intervening = false;
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

  setAccelerate(on: boolean): void {
    this.accelerate = on;
    if (on) this.needsAcceleratePrompt = false;
  }

  /**
   * 本拍成功后推进；换章清零章内计数。
   * 顶到 chapter_speak_cap → 置 needsAcceleratePrompt，不自动 done。
   */
  advance(chapterId?: string): void {
    if (this.status !== 'running') return;
    this.turnIndex += 1;
    if (chapterId && chapterId !== this.chapterIdForCap) {
      this.chapterIdForCap = chapterId;
      this.chapterSpeakCount = 1;
      this.needsAcceleratePrompt = false;
    } else {
      this.chapterSpeakCount += 1;
    }
    if (this.chapterSpeakCount >= this.goal.chapter_speak_cap) {
      this.needsAcceleratePrompt = true;
    }
  }

  clearAcceleratePrompt(): void {
    this.needsAcceleratePrompt = false;
  }

  complete(reason = '目标达成'): void {
    if (this.status !== 'running' && this.status !== 'paused') return;
    this.status = 'done';
    this.intervening = false;
    this.failReason = undefined;
    void reason;
  }

  fail(reason: string): void {
    this.status = 'abort';
    this.intervening = false;
    this.failReason = reason;
  }

  goalReached(chapter?: string, endingId?: string | null): boolean {
    return isAutoPlayGoalReached(this.goal, {
      chapter,
      sawTargetExchange: this.sawTargetExchange,
      endingId,
    });
  }

  isActive(): boolean {
    return this.status === 'running' || this.status === 'paused';
  }

  locksInput(): boolean {
    if (this.intervening) return false;
    return this.status === 'running' || this.status === 'paused';
  }
}
