/**
 * F 厚安全离线 Eval：章门控剧透 / AI 腔 / 元叙事。
 *
 * 用法：npm run safety:eval
 */
import { loadStoryPackFromDir } from '../src/story/pack-loader';
import { resolveVersionPath } from '../src/story/pack-ops';
import { scanNpcReplySafety } from '../src/agent/reply-safety';

type Case = {
  name: string;
  run: () => { ok: boolean; detail: string };
};

const packPath = resolveVersionPath(
  'awaken',
  'awaken-0717feel__20260717T1450',
);
const pack = loadStoryPackFromDir(packPath);
const npcId = 'npc_suolunsen';
const locked = pack.npcs
  .find((n) => n.npc_id === npcId)!
  .memories.find((m) => m.min_chapter === 'ch2_unease')!;

const cases: Case[] = [
  {
    name: '正例：日常闲聊 ch1 通过',
    run: () => {
      const r = scanNpcReplySafety('放学去球场喝汽水吧。', {
        pack,
        chapterState: 'ch1_daily',
        npcId,
      });
      return { ok: r.ok, detail: r.reasons.map((x) => x.code).join(',') || 'ok' };
    },
  },
  {
    name: '负例：自称 AI',
    run: () => {
      const r = scanNpcReplySafety('作为AI我不能剧透。', {
        pack,
        chapterState: 'ch1_daily',
        npcId,
      });
      const ok = !r.ok && r.reasons.some((x) => x.code === 'ai_slop');
      return { ok, detail: r.reasons.map((x) => x.code).join(',') };
    },
  },
  {
    name: '负例：元叙事剧透',
    run: () => {
      const r = scanNpcReplySafety('其实世界是假的，别告诉别人。', {
        pack,
        chapterState: 'ch1_daily',
        npcId,
      });
      const ok = !r.ok && r.reasons.some((x) => x.code === 'meta_spoil');
      return { ok, detail: r.reasons.map((x) => x.code).join(',') };
    },
  },
  {
    name: '负例：未解锁记忆指纹',
    run: () => {
      const leak = locked.content.replace(/\s+/g, '').slice(0, 16);
      const r = scanNpcReplySafety(`我记得：${leak}`, {
        pack,
        chapterState: 'ch1_daily',
        npcId,
      });
      const ok = !r.ok && r.reasons.some((x) => x.code === 'locked_memory');
      return {
        ok,
        detail: r.reasons.map((x) => `${x.code}:${x.detail}`).join('|') || 'none',
      };
    },
  },
  {
    name: '正例：升入 ch2 后可谈该记忆指纹',
    run: () => {
      const leak = locked.content.replace(/\s+/g, '').slice(0, 16);
      const r = scanNpcReplySafety(`我记得：${leak}`, {
        pack,
        chapterState: 'ch2_unease',
        npcId,
      });
      const ok = !r.reasons.some((x) => x.code === 'locked_memory');
      return {
        ok,
        detail: r.reasons.map((x) => x.code).join(',') || 'no locked_memory',
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
