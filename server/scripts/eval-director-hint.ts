/**
 * MA-H 离线 Eval：available_events 仅 id；prompt 不泄露触发/台词。
 *
 * 用法：npm run director:eval
 */
import { DirectorService } from '../src/agent/director.service';
import { listAvailableExchangeEventIds } from '../src/agent/npc-exchange';
import { loadStoryPackFromDir } from '../src/story/pack-loader';
import { resolveVersionPath } from '../src/story/pack-ops';
import type { DirectorInput } from '../src/agent/director.types';

type Case = {
  name: string;
  run: () => { ok: boolean; detail: string };
};

const packPath = resolveVersionPath(
  'awaken',
  'awaken-0717feel__20260717T1450',
);
const pack = loadStoryPackFromDir(packPath);

const director = new DirectorService(
  null as never,
  null as never,
  null as never,
  null as never,
);

function sampleInput(
  partial: Partial<DirectorInput> & Pick<DirectorInput, 'availableEvents'>,
): DirectorInput {
  return {
    playerId: 'p',
    chatNpcId: 'npc_suolunsen',
    playerMessage: '你好',
    cast: [
      {
        npc_id: 'npc_suolunsen',
        display_name: '索伦森',
        blurb: '教师',
      },
      { npc_id: 'npc_hilvi', display_name: '希尔薇', blurb: '转校生' },
    ],
    chapterId: 'ch2_unease',
    chapterLabel: '裂痕',
    flagNames: ['met_hook'],
    recentLines: [],
    ...partial,
  };
}

const cases: Case[] = [
  {
    name: '正例：章+flag 命中 → 含 ex_ch2_first_meet',
    run: () => {
      const ids = listAvailableExchangeEventIds(
        'ch2_unease',
        { met_hook: 'true' },
        pack.triggers,
      );
      const ok = ids.includes('ex_ch2_first_meet');
      return { ok, detail: ids.join(',') || '（空）' };
    },
  },
  {
    name: '正例：path_trust 时含 ex_ch2_after_trust',
    run: () => {
      const ids = listAvailableExchangeEventIds(
        'ch2_unease',
        { path_trust: 'true' },
        pack.triggers,
      );
      const ok = ids.includes('ex_ch2_after_trust');
      return { ok, detail: ids.join(',') || '（空）' };
    },
  },
  {
    name: '负例：错章 → 空列表',
    run: () => {
      const ids = listAvailableExchangeEventIds(
        'ch1_daily',
        { met_hook: 'true' },
        pack.triggers,
      );
      return { ok: ids.length === 0, detail: ids.join(',') || '（空）' };
    },
  },
  {
    name: '负例：once 已置位 → 该戏码不再可用',
    run: () => {
      const ids = listAvailableExchangeEventIds(
        'ch2_unease',
        { met_hook: 'true', ex_ch2_meet_done: 'true' },
        pack.triggers,
      );
      const ok = !ids.includes('ex_ch2_first_meet');
      return { ok, detail: ids.join(',') || '（空）' };
    },
  },
  {
    name: 'prompt 含戏码 id',
    run: () => {
      const msgs = director.buildPrompt(
        sampleInput({ availableEvents: ['ex_ch2_first_meet'] }),
      );
      const text = msgs.map((m) => m.content).join('\n');
      const ok =
        text.includes('ex_ch2_first_meet') &&
        text.includes('【可尝试戏码 id】');
      return { ok, detail: ok ? 'ok' : 'missing id block' };
    },
  },
  {
    name: 'prompt 不泄露 beat_hints / require_flags / fallback_lines',
    run: () => {
      const ev = pack.triggers.exchange_events.find(
        (e) => e.id === 'ex_ch2_first_meet',
      )!;
      const msgs = director.buildPrompt(
        sampleInput({ availableEvents: [ev.id] }),
      );
      const text = msgs.map((m) => m.content).join('\n');
      const leaks: string[] = [];
      for (const hint of ev.beat_hints) {
        if (hint && text.includes(hint)) leaks.push('beat_hint');
      }
      for (const line of ev.fallback_lines) {
        if (line && text.includes(line)) leaks.push('fallback_line');
      }
      if (text.includes('require_flags')) leaks.push('require_flags');
      if (text.includes('set_flags')) leaks.push('set_flags');
      if (text.includes('"chapter"')) leaks.push('raw chapter json');
      return {
        ok: leaks.length === 0,
        detail: leaks.length ? leaks.join(',') : 'no leak',
      };
    },
  },
  {
    name: 'MOCK：有戏码且多人 → reply_then_exchange',
    run: () => {
      const d = director.mockDecide(
        sampleInput({ availableEvents: ['ex_ch2_first_meet'] }),
      );
      const ok = d.mode === 'reply_then_exchange';
      return { ok, detail: `${d.mode} ${d.reason}` };
    },
  },
  {
    name: 'MOCK：无戏码且单人倾向 → 仍可 reply_player',
    run: () => {
      const d = director.mockDecide(
        sampleInput({
          availableEvents: [],
          cast: [
            {
              npc_id: 'npc_suolunsen',
              display_name: '索伦森',
              blurb: '教师',
            },
          ],
        }),
      );
      const ok = d.mode === 'reply_player';
      return { ok, detail: `${d.mode} ${d.reason}` };
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
