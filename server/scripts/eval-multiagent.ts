/**
 * MA-S / MA-W 离线 Eval：aside speakers 偏向 + 悄悄话措辞辨明。
 *
 * 用法：npm run multiagent:eval
 */
import { pickAsideSpeaker } from '../src/agent/aside-pick';
import { detectWhisperIntent } from '../src/agent/whisper-detect';

type Case = {
  name: string;
  run: () => { ok: boolean; detail: string };
};

const cases: Case[] = [
  {
    name: 'MA-S：preferred 在场 → 只从 preferred 抽',
    run: () => {
      const picks = new Set<string>();
      for (let i = 0; i < 40; i++) {
        const id = pickAsideSpeaker(
          ['npc_a', 'npc_b', 'npc_c'],
          'npc_focus',
          ['npc_focus', 'npc_b'],
          () => i / 40,
        );
        if (id) picks.add(id);
      }
      const ok = picks.size === 1 && picks.has('npc_b');
      return { ok, detail: [...picks].join(',') };
    },
  },
  {
    name: 'MA-S：preferred 均不在候选 → 回退全候选',
    run: () => {
      const id = pickAsideSpeaker(
        ['npc_a', 'npc_b'],
        'npc_focus',
        ['npc_focus', 'npc_z'],
        () => 0,
      );
      const ok = id === 'npc_a';
      return { ok, detail: String(id) };
    },
  },
  {
    name: 'MA-S：空候选 → null',
    run: () => {
      const id = pickAsideSpeaker([], 'npc_focus', ['npc_a']);
      return { ok: id === null, detail: String(id) };
    },
  },
  {
    name: 'MA-W：正例悄悄话措辞',
    run: () => {
      const samples = [
        '这事你先别告诉别人，我有点慌。',
        '悄悄跟你说，走廊钟不对劲。',
        '小声告诉你一件事。',
        '只有你能听：我觉得不对。',
        '跟你说个秘密。',
      ];
      const miss = samples.filter((s) => !detectWhisperIntent(s));
      return {
        ok: miss.length === 0,
        detail: miss.length ? miss.join(' | ') : 'all hit',
      };
    },
  },
  {
    name: 'MA-W：负例普通闲聊',
    run: () => {
      const samples = [
        '放学一起去球场喝汽水吧。',
        '希尔薇今天来报到了吗？',
        '钟表好像有点不准。',
      ];
      const hit = samples.filter((s) => detectWhisperIntent(s));
      return {
        ok: hit.length === 0,
        detail: hit.length ? hit.join(' | ') : 'none',
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
