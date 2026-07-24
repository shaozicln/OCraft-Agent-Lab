/**
 * 自动演 MA-A-B Eval：目标 schema、会话 FSM、MOCK 下一拍、目标达成判定。
 *
 * 用法：npm run autoplay:eval
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  AutoPlaySession,
  FEEL_DEMO_AUTO_GOAL,
  autoPlayGoalSchema,
  isAutoPlayGoalReached,
  mockProposeAutoPlayNext,
  parseAutoPlayNextJson,
} from '@ocraft/shared';

type Case = {
  name: string;
  run: () => { ok: boolean; detail: string };
};

const goalJsonPath = path.join(
  __dirname,
  '../eval/scripts/feel-demo-auto-goal.json',
);

const cases: Case[] = [
  {
    name: '目标 JSON 通过 schema',
    run: () => {
      const raw = JSON.parse(fs.readFileSync(goalJsonPath, 'utf8'));
      const parsed = autoPlayGoalSchema.parse(raw);
      return {
        ok:
          parsed.id === 'feel-demo-auto-goal' &&
          parsed.target_chapter === 'ch2_unease' &&
          !('beats' in raw) &&
          !('say' in (raw as object)),
        detail: `${parsed.id} max=${parsed.max_turns}`,
      };
    },
  },
  {
    name: '常量目标与 JSON 文件一致',
    run: () => {
      const raw = autoPlayGoalSchema.parse(
        JSON.parse(fs.readFileSync(goalJsonPath, 'utf8')),
      );
      const ok =
        raw.id === FEEL_DEMO_AUTO_GOAL.id &&
        raw.npc_id === FEEL_DEMO_AUTO_GOAL.npc_id &&
        raw.target_chapter === FEEL_DEMO_AUTO_GOAL.target_chapter &&
        raw.target_exchange === FEEL_DEMO_AUTO_GOAL.target_exchange &&
        raw.max_turns === FEEL_DEMO_AUTO_GOAL.max_turns;
      return { ok, detail: ok ? 'match' : 'mismatch' };
    },
  },
  {
    name: '目标达成判定：章+互聊',
    run: () => {
      const ok = isAutoPlayGoalReached(FEEL_DEMO_AUTO_GOAL, {
        chapter: 'ch2_unease',
        sawTargetExchange: true,
      });
      const no =
        !isAutoPlayGoalReached(FEEL_DEMO_AUTO_GOAL, {
          chapter: 'ch2_unease',
          sawTargetExchange: false,
        }) &&
        !isAutoPlayGoalReached(FEEL_DEMO_AUTO_GOAL, {
          chapter: 'ch1_daily',
          sawTargetExchange: true,
        });
      return { ok: ok && no, detail: ok && no ? 'ok' : '判定偏差' };
    },
  },
  {
    name: 'MOCK：ch1 开场闲聊',
    run: () => {
      const p = mockProposeAutoPlayNext({
        goal: FEEL_DEMO_AUTO_GOAL,
        turnIndex: 0,
        chapterId: 'ch1_daily',
        chapterLabel: '日常',
        flagNames: [],
        availableEvents: [],
        recentLines: [],
        priorSays: [],
        focusNpcName: '索伦森',
        sawTargetExchange: false,
      });
      return {
        ok: !p.done && Boolean(p.say?.includes('球场')),
        detail: `${p.source}:${p.say}`,
      };
    },
  },
  {
    name: 'MOCK：ch1 第二拍点希尔薇',
    run: () => {
      const p = mockProposeAutoPlayNext({
        goal: FEEL_DEMO_AUTO_GOAL,
        turnIndex: 1,
        chapterId: 'ch1_daily',
        chapterLabel: '日常',
        flagNames: [],
        availableEvents: [],
        recentLines: [],
        priorSays: ['放学一起去球场吗'],
        focusNpcName: '索伦森',
        sawTargetExchange: false,
      });
      return {
        ok: !p.done && Boolean(p.say?.includes('希尔薇')),
        detail: `${p.say}`,
      };
    },
  },
  {
    name: 'parseAutoPlayNextJson 正例/负例',
    run: () => {
      const ok = parseAutoPlayNextJson(
        JSON.stringify({ say: '你好', done: false, reason: '试探' }),
      );
      const bad = parseAutoPlayNextJson('{not json');
      const emptySay = parseAutoPlayNextJson(
        JSON.stringify({ done: false, reason: '缺句' }),
      );
      return {
        ok: Boolean(ok?.say) && bad === null && emptySay === null,
        detail: ok?.say ?? 'fail',
      };
    },
  },
  {
    name: 'FSM：start → advance → done（达上限）',
    run: () => {
      const goal = autoPlayGoalSchema.parse({
        ...FEEL_DEMO_AUTO_GOAL,
        max_turns: 2,
      });
      const s = new AutoPlaySession(goal);
      if (!s.start()) return { ok: false, detail: 'start failed' };
      s.advance();
      if (String(s.status) !== 'running' || Number(s.turnIndex) !== 1) {
        return { ok: false, detail: `after1 ${s.status}@${s.turnIndex}` };
      }
      s.advance();
      return {
        ok: String(s.status) === 'done' && Number(s.turnIndex) === 2,
        detail: `${s.status}@${s.turnIndex}`,
      };
    },
  },
  {
    name: 'FSM：pause / resume / stop(接管)',
    run: () => {
      const s = new AutoPlaySession(FEEL_DEMO_AUTO_GOAL);
      s.start();
      if (!s.pause() || String(s.status) !== 'paused') {
        return { ok: false, detail: `pause→${s.status}` };
      }
      if (!s.resume() || String(s.status) !== 'running') {
        return { ok: false, detail: `resume→${s.status}` };
      }
      s.stop('接管');
      const ok =
        String(s.status) === 'abort' && s.failReason === '接管';
      return { ok, detail: `${s.status}:${s.failReason}` };
    },
  },
  {
    name: '会话 markExchange → goalReached',
    run: () => {
      const s = new AutoPlaySession(FEEL_DEMO_AUTO_GOAL);
      s.start();
      s.markExchange('ex_ch2_first_meet');
      const ok = s.goalReached('ch2_unease');
      return { ok, detail: ok ? 'reached' : 'miss' };
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
