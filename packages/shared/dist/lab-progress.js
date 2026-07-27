"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabProgressMonitor = exports.labProgressSnapshotSchema = exports.labProgressStatusSchema = exports.labStopReasonSchema = exports.LAB_SESSION_PEER_LINE_CAP = exports.LAB_ROUND_PEER_LINE_CAP = void 0;
const zod_1 = require("zod");
/** MA-Lab：平级 tick 预算与任务进度（纯逻辑，可 Eval） */
exports.LAB_ROUND_PEER_LINE_CAP = 3;
exports.LAB_SESSION_PEER_LINE_CAP = 12;
exports.labStopReasonSchema = zod_1.z.enum([
    'complete',
    'budget_round',
    'budget_session',
    'no_candidates',
    'whisper',
    'disabled',
]);
exports.labProgressStatusSchema = zod_1.z.enum([
    'idle',
    'running',
    'done',
    'abort',
]);
exports.labProgressSnapshotSchema = zod_1.z.object({
    enabled: zod_1.z.boolean(),
    status: exports.labProgressStatusSchema,
    sessionPeerLines: zod_1.z.number().int().min(0),
    sessionPeerLineCap: zod_1.z.number().int().min(1),
    roundIndex: zod_1.z.number().int().min(0),
    roundPeerLines: zod_1.z.number().int().min(0),
    roundPeerLineCap: zod_1.z.number().int().min(1),
    candidateCount: zod_1.z.number().int().min(0),
    spokenNpcIds: zod_1.z.array(zod_1.z.string()).default([]),
    stopReason: exports.labStopReasonSchema.optional(),
});
class LabProgressMonitor {
    sessionPeerLineCap;
    roundPeerLineCap;
    sessionPeerLines = 0;
    roundIndex = 0;
    roundPeerLines = 0;
    spokenNpcIds = [];
    status = 'idle';
    stopReason;
    constructor(sessionPeerLineCap = exports.LAB_SESSION_PEER_LINE_CAP, roundPeerLineCap = exports.LAB_ROUND_PEER_LINE_CAP) {
        this.sessionPeerLineCap = sessionPeerLineCap;
        this.roundPeerLineCap = roundPeerLineCap;
    }
    resetSession() {
        this.sessionPeerLines = 0;
        this.roundIndex = 0;
        this.roundPeerLines = 0;
        this.spokenNpcIds = [];
        this.status = 'idle';
        this.stopReason = undefined;
    }
    /** 玩家一句后的平级 tick 开始 */
    beginRound(candidateCount) {
        this.roundIndex += 1;
        this.roundPeerLines = 0;
        this.spokenNpcIds = [];
        this.status = 'running';
        this.stopReason = undefined;
        if (candidateCount <= 0) {
            this.status = 'done';
            this.stopReason = 'no_candidates';
        }
        else if (this.sessionPeerLines >= this.sessionPeerLineCap) {
            this.status = 'done';
            this.stopReason = 'budget_session';
        }
        return this.snapshot(candidateCount);
    }
    canSpeakMore(candidateCount) {
        if (this.status !== 'running')
            return false;
        if (this.sessionPeerLines >= this.sessionPeerLineCap)
            return false;
        if (this.roundPeerLines >= this.roundPeerLineCap)
            return false;
        if (candidateCount <= 0)
            return false;
        return true;
    }
    recordUtterance(npcId, candidateCount) {
        this.roundPeerLines += 1;
        this.sessionPeerLines += 1;
        if (!this.spokenNpcIds.includes(npcId)) {
            this.spokenNpcIds.push(npcId);
        }
        if (this.sessionPeerLines >= this.sessionPeerLineCap) {
            this.status = 'done';
            this.stopReason = 'budget_session';
        }
        else if (this.roundPeerLines >= this.roundPeerLineCap) {
            this.status = 'done';
            this.stopReason = 'budget_round';
        }
        return this.snapshot(candidateCount);
    }
    complete(reason = 'complete') {
        this.status = 'done';
        this.stopReason = reason;
        return this.snapshot(0);
    }
    abort(reason) {
        this.status = 'abort';
        this.stopReason = reason;
        return this.snapshot(0);
    }
    snapshot(candidateCount) {
        return exports.labProgressSnapshotSchema.parse({
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
exports.LabProgressMonitor = LabProgressMonitor;
