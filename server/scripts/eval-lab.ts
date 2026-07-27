/**
 * MA-Lab 离线 Eval：平级预算 / 进度监控（纯逻辑）。
 *
 * 用法：npm run lab:eval
 */
import {
  LAB_ROUND_PEER_LINE_CAP,
  LabProgressMonitor,
} from '@ocraft/shared';

type Case = {
  name: string;
  run: () => { ok: boolean; detail: string };
};

const cases: Case[] = [
  {
    name: 'beginRound：无候选 → no_candidates',
    run: () => {
      const m = new LabProgressMonitor(12, 3);
      const s = m.beginRound(0);
      const ok =
        s.status === 'done' &&
        s.stopReason === 'no_candidates' &&
        s.roundIndex === 1;
      return { ok, detail: `${s.status}/${s.stopReason}/r${s.roundIndex}` };
    },
  },
  {
    name: 'round 预算：满 3 句 → budget_round',
    run: () => {
      const m = new LabProgressMonitor(12, 3);
      m.beginRound(5);
      m.recordUtterance('a', 4);
      m.recordUtterance('b', 3);
      const s = m.recordUtterance('c', 2);
      const ok =
        s.status === 'done' &&
        s.stopReason === 'budget_round' &&
        s.roundPeerLines === LAB_ROUND_PEER_LINE_CAP &&
        !m.canSpeakMore(2);
      return {
        ok,
        detail: `${s.stopReason} lines=${s.roundPeerLines}`,
      };
    },
  },
  {
    name: 'session 预算：跨轮累计顶 → budget_session',
    run: () => {
      const m = new LabProgressMonitor(5, 3);
      m.beginRound(3);
      m.recordUtterance('a', 2);
      m.recordUtterance('b', 1);
      m.recordUtterance('c', 0);
      m.beginRound(3);
      m.recordUtterance('a', 2);
      const s = m.recordUtterance('b', 1);
      const ok =
        s.status === 'done' &&
        s.stopReason === 'budget_session' &&
        s.sessionPeerLines === 5;
      return { ok, detail: `${s.stopReason} session=${s.sessionPeerLines}` };
    },
  },
  {
    name: 'session 已满时 beginRound 直接 done',
    run: () => {
      const m = new LabProgressMonitor(2, 3);
      m.beginRound(2);
      m.recordUtterance('a', 1);
      m.recordUtterance('b', 0);
      const s = m.beginRound(3);
      const ok =
        s.status === 'done' &&
        s.stopReason === 'budget_session' &&
        s.roundPeerLines === 0;
      return { ok, detail: `${s.status}/${s.stopReason}` };
    },
  },
  {
    name: 'complete / abort / resetSession',
    run: () => {
      const m = new LabProgressMonitor();
      m.beginRound(2);
      m.recordUtterance('a', 1);
      const done = m.complete('complete');
      const aborted = m.abort('whisper');
      m.resetSession();
      const idle = m.snapshot(0);
      const ok =
        done.stopReason === 'complete' &&
        aborted.status === 'abort' &&
        aborted.stopReason === 'whisper' &&
        idle.status === 'idle' &&
        idle.sessionPeerLines === 0 &&
        idle.roundIndex === 0;
      return {
        ok,
        detail: `done=${done.stopReason} abort=${aborted.stopReason} idle=${idle.status}`,
      };
    },
  },
  {
    name: 'spokenNpcIds 去重累计',
    run: () => {
      const m = new LabProgressMonitor(12, 3);
      m.beginRound(3);
      m.recordUtterance('npc_a', 2);
      m.recordUtterance('npc_a', 1);
      const s = m.recordUtterance('npc_b', 0);
      const ok =
        s.spokenNpcIds.length === 2 &&
        s.spokenNpcIds.includes('npc_a') &&
        s.spokenNpcIds.includes('npc_b');
      return { ok, detail: s.spokenNpcIds.join(',') };
    },
  },
];

let failed = 0;
for (const c of cases) {
  try {
    const r = c.run();
    console.log(`${r.ok ? '[PASS]' : '[FAIL]'} ${c.name} — ${r.detail}`);
    if (!r.ok) failed += 1;
  } catch (err) {
    failed += 1;
    console.log(
      `[FAIL] ${c.name} — ${err instanceof Error ? err.message : err}`,
    );
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed > 0 ? 1 : 0);
