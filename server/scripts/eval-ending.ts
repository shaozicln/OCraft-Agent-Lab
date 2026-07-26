/**
 * G 结局结算 Eval：条件匹配 / 优先级 / 已结算不再触发。
 *
 * 用法：npm run ending:eval
 */
import { loadStoryPackFromDir } from '../src/story/pack-loader';
import { resolveVersionPath } from '../src/story/pack-ops';
import {
  evaluateEndingSettlement,
  hasSettledEnding,
} from '../src/agent/ending-settle';

type Case = {
  name: string;
  run: () => { ok: boolean; detail: string };
};

const packPath = resolveVersionPath(
  'awaken',
  'awaken-0717feel__20260717T1450',
);
const pack = loadStoryPackFromDir(packPath);

const cases: Case[] = [
  {
    name: 'Pack endings 含甲乙丙条件',
    run: () => {
      const ids = (pack.world.endings ?? []).map((e) => e.id);
      const ok =
        ids.includes('ending_jia') &&
        ids.includes('ending_yi') &&
        ids.includes('ending_bing') &&
        (pack.world.endings ?? []).every(
          (e) => (e.set_flags?.length ?? 0) > 0,
        );
      return { ok, detail: ids.join(',') };
    },
  },
  {
    name: '甲：ch4 + silvie_dead + 元叙事词 → ending_jia 且清 silvie_dead',
    run: () => {
      const hit = evaluateEndingSettlement({
        pack,
        chapterState: 'ch4_quake',
        flags: {
          silvie_dead: 'true',
          path_trust: 'true',
        },
        playerMessage: '这不是现实，我要改结局',
      });
      const ok =
        hit?.endingId === 'ending_jia' &&
        hit.clearFlags.includes('silvie_dead') &&
        hit.setFlags.some((f) => f.name === 'ending_jia');
      return { ok, detail: hit?.endingId ?? 'null' };
    },
  },
  {
    name: '乙：路径 A + silvie_dead、无坦白 → ending_yi',
    run: () => {
      const hit = evaluateEndingSettlement({
        pack,
        chapterState: 'ch4_quake',
        flags: {
          silvie_dead: 'true',
          path_trust: 'true',
        },
        playerMessage: '……你还好吗',
      });
      return {
        ok: hit?.endingId === 'ending_yi',
        detail: hit?.endingId ?? 'null',
      };
    },
  },
  {
    name: '丙：path_dismiss 未合流 → ending_bing',
    run: () => {
      const hit = evaluateEndingSettlement({
        pack,
        chapterState: 'ch4_quake',
        flags: {
          silvie_dead: 'true',
          path_dismiss: 'true',
        },
        playerMessage: '……',
      });
      return {
        ok: hit?.endingId === 'ending_bing',
        detail: hit?.endingId ?? 'null',
      };
    },
  },
  {
    name: '甲优先于乙（同轮有元叙事词）',
    run: () => {
      const hit = evaluateEndingSettlement({
        pack,
        chapterState: 'ch4_quake',
        flags: {
          silvie_dead: 'true',
          path_trust: 'true',
        },
        playerMessage: '世界是模拟的，我改写',
      });
      return {
        ok: hit?.endingId === 'ending_jia',
        detail: hit?.endingId ?? 'null',
      };
    },
  },
  {
    name: '已结算结局不再触发',
    run: () => {
      const hit = evaluateEndingSettlement({
        pack,
        chapterState: 'ch4_quake',
        flags: {
          silvie_dead: 'true',
          path_trust: 'true',
          ending_yi: 'true',
        },
        playerMessage: '这不是现实，我要改结局',
      });
      const settled = hasSettledEnding(
        { ending_yi: 'true' },
        pack.world.endings ?? [],
      );
      return {
        ok: hit === null && settled,
        detail: hit ? hit.endingId : 'null+settled',
      };
    },
  },
  {
    name: '非 ch4 不结算',
    run: () => {
      const hit = evaluateEndingSettlement({
        pack,
        chapterState: 'ch2_unease',
        flags: { silvie_dead: 'true', path_trust: 'true' },
        playerMessage: '我要改结局',
      });
      return { ok: hit === null, detail: hit?.endingId ?? 'null' };
    },
  },
];

let failed = 0;
for (const c of cases) {
  const { ok, detail } = c.run();
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${c.name}`);
  if (!ok) {
    failed += 1;
    console.log(`       ${detail}`);
  }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed === 0 ? 0 : 1);
