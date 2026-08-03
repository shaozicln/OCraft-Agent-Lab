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
  buildAutoPlayGoal,
  DEFAULT_AUTO_PLAY_STYLE_ID,
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
    name: 'FSM：advance 顶章发言软顶（不硬停）',
    run: () => {
      const goal = autoPlayGoalSchema.parse({
        ...FEEL_DEMO_AUTO_GOAL,
        chapter_speak_cap: 2,
        max_turns: 2,
      });
      const s = new AutoPlaySession(goal);
      if (!s.start()) return { ok: false, detail: 'start failed' };
      s.advance('ch1_daily');
      if (s.needsAcceleratePrompt || String(s.status) !== 'running') {
        return {
          ok: false,
          detail: `after1 prompt=${s.needsAcceleratePrompt} ${s.status}`,
        };
      }
      s.advance('ch1_daily');
      return {
        ok:
          String(s.status) === 'running' &&
          Boolean(s.needsAcceleratePrompt) &&
          Number(s.chapterSpeakCount) === 2,
        detail: `${s.status} count=${s.chapterSpeakCount} prompt=${s.needsAcceleratePrompt}`,
      };
    },
  },
  {
    name: 'FSM：pause / resume / stop',
    run: () => {
      const s = new AutoPlaySession(FEEL_DEMO_AUTO_GOAL);
      s.start();
      if (!s.pause() || String(s.status) !== 'paused') {
        return { ok: false, detail: `pause→${s.status}` };
      }
      if (!s.resume() || String(s.status) !== 'running') {
        return { ok: false, detail: `resume→${s.status}` };
      }
      s.stop('停止');
      const ok =
        String(s.status) === 'abort' && s.failReason === '停止';
      return { ok, detail: `${s.status}:${s.failReason}` };
    },
  },
  {
    name: 'FSM：接管 / 交回',
    run: () => {
      const s = new AutoPlaySession(FEEL_DEMO_AUTO_GOAL);
      s.start();
      if (
        !s.enterIntervene() ||
        !s.intervening ||
        String(s.status) !== 'paused'
      ) {
        return { ok: false, detail: `intervene→${s.status}` };
      }
      if (
        !s.handBack() ||
        s.intervening ||
        String(s.status) !== 'running'
      ) {
        return { ok: false, detail: `handBack→${s.status}` };
      }
      return { ok: true, detail: 'ok' };
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
  {
    name: 'AP-0b：buildAutoPlayGoal 必结局、无时长',
    run: () => {
      const g = buildAutoPlayGoal({
        npcId: 'npc_any',
        prefs: {
          style_id: DEFAULT_AUTO_PLAY_STYLE_ID,
          ending_mode: 'random',
          takeover_mode: 'watch_only',
          wait_ms: 800,
          chapter_speak_cap: 100,
          enter_epilogue: true,
        },
        pack: {
          world_id: 'demo',
          display_name: '测试包',
          endings: [
            { id: 'ending_a', display_name: '甲' },
            { id: 'ending_b', display_name: '乙' },
          ],
        },
      });
      const ok =
        g.npc_id === 'npc_any' &&
        g.chapter_speak_cap === 100 &&
        g.style_id === 'direct' &&
        g.takeover_mode === 'watch_only' &&
        g.enter_epilogue === true &&
        (g.target_ending === 'ending_a' || g.target_ending === 'ending_b') &&
        g.id !== FEEL_DEMO_AUTO_GOAL.id;
      return {
        ok,
        detail: `style=${g.style_id} ending=${g.target_ending ?? '-'} epi=${g.enter_epilogue}`,
      };
    },
  },
  {
    name: 'AP-0b：无结局 → final_chapter',
    run: () => {
      const g = buildAutoPlayGoal({
        npcId: 'npc_x',
        prefs: {
          style_id: 'direct',
          ending_mode: 'random',
          takeover_mode: 'allow',
          wait_ms: 800,
          chapter_speak_cap: 50,
          enter_epilogue: false,
        },
        pack: {
          chapters: [{ id: 'ch1' }, { id: 'ch_last' }],
          endings: [],
        },
      });
      const ok =
        g.stop_at_final_chapter === true &&
        g.target_chapter === 'ch_last' &&
        g.enter_epilogue === false &&
        !g.target_ending;
      return {
        ok,
        detail: `ch=${g.target_chapter} stopFinal=${g.stop_at_final_chapter}`,
      };
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
