import { z } from 'zod';

/** MA-Lab：平级 tick 预算与任务进度（纯逻辑，可 Eval） */
export const LAB_ROUND_PEER_LINE_CAP = 3;
export const LAB_SESSION_PEER_LINE_CAP = 12;

export const labStopReasonSchema = z.enum([
  'complete',
  'budget_round',
  'budget_session',
  'no_candidates',
  'whisper',
  'disabled',
]);
export type LabStopReason = z.infer<typeof labStopReasonSchema>;

export const labProgressStatusSchema = z.enum([
  'idle',
  'running',
  'done',
  'abort',
]);
export type LabProgressStatus = z.infer<typeof labProgressStatusSchema>;

export const labProgressSnapshotSchema = z.object({
  enabled: z.boolean(),
  status: labProgressStatusSchema,
  sessionPeerLines: z.number().int().min(0),
  sessionPeerLineCap: z.number().int().min(1),
  roundIndex: z.number().int().min(0),
  roundPeerLines: z.number().int().min(0),
  roundPeerLineCap: z.number().int().min(1),
  candidateCount: z.number().int().min(0),
  spokenNpcIds: z.array(z.string()).default([]),
  stopReason: labStopReasonSchema.optional(),
});
export type LabProgressSnapshot = z.infer<typeof labProgressSnapshotSchema>;

export class LabProgressMonitor {
  sessionPeerLines = 0;
  roundIndex = 0;
  roundPeerLines = 0;
  spokenNpcIds: string[] = [];
  status: LabProgressStatus = 'idle';
  stopReason?: LabStopReason;

  constructor(
    readonly sessionPeerLineCap = LAB_SESSION_PEER_LINE_CAP,
    readonly roundPeerLineCap = LAB_ROUND_PEER_LINE_CAP,
  ) {}

  resetSession(): void {
    this.sessionPeerLines = 0;
    this.roundIndex = 0;
    this.roundPeerLines = 0;
    this.spokenNpcIds = [];
    this.status = 'idle';
    this.stopReason = undefined;
  }

  /** 玩家一句后的平级 tick 开始 */
  beginRound(candidateCount: number): LabProgressSnapshot {
    this.roundIndex += 1;
    this.roundPeerLines = 0;
    this.spokenNpcIds = [];
    this.status = 'running';
    this.stopReason = undefined;

    if (candidateCount <= 0) {
      this.status = 'done';
      this.stopReason = 'no_candidates';
    } else if (this.sessionPeerLines >= this.sessionPeerLineCap) {
      this.status = 'done';
      this.stopReason = 'budget_session';
    }

    return this.snapshot(candidateCount);
  }

  canSpeakMore(candidateCount: number): boolean {
    if (this.status !== 'running') return false;
    if (this.sessionPeerLines >= this.sessionPeerLineCap) return false;
    if (this.roundPeerLines >= this.roundPeerLineCap) return false;
    if (candidateCount <= 0) return false;
    return true;
  }

  recordUtterance(npcId: string, candidateCount: number): LabProgressSnapshot {
    this.roundPeerLines += 1;
    this.sessionPeerLines += 1;
    if (!this.spokenNpcIds.includes(npcId)) {
      this.spokenNpcIds.push(npcId);
    }

    if (this.sessionPeerLines >= this.sessionPeerLineCap) {
      this.status = 'done';
      this.stopReason = 'budget_session';
    } else if (this.roundPeerLines >= this.roundPeerLineCap) {
      this.status = 'done';
      this.stopReason = 'budget_round';
    }

    return this.snapshot(candidateCount);
  }

  complete(reason: LabStopReason = 'complete'): LabProgressSnapshot {
    this.status = 'done';
    this.stopReason = reason;
    return this.snapshot(0);
  }

  abort(reason: LabStopReason): LabProgressSnapshot {
    this.status = 'abort';
    this.stopReason = reason;
    return this.snapshot(0);
  }

  snapshot(candidateCount: number): LabProgressSnapshot {
    return labProgressSnapshotSchema.parse({
      enabled: true,
      status: this.status,
      sessionPeerLines: this.sessionPeerLines,
      sessionPeerLineCap: this.sessionPeerLineCap,
      roundIndex: this.roundIndex,
      roundPeerLines: this.roundPeerLines,
      roundPeerLineCap: this.roundPeerLineCap,
      candidateCount,
      spokenNpcIds: [...this.spokenNpcIds],
      stopReason: this.stopReason,
    });
  }
}
