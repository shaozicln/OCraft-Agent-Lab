/**
 * Mem-V 离线 Eval：向量路径 / 章门控 / 关键词回退。
 *
 * 用法：npm run rag:eval
 */
import { loadStoryPackFromDir } from '../src/story/pack-loader';
import { resolveVersionPath } from '../src/story/pack-ops';
import {
  getChapterRankMap,
  getDefaultChapterId,
  type NpcMemory,
} from '@ocraft/shared';
import { localEmbed, memoryEmbedText } from '../src/agent/local-embedding';
import {
  buildLocalMemoryVectors,
  filterUnlockedMemories,
  retrieveByKeyword,
  retrieveByVector,
} from '../src/agent/rag-retrieve';

type Case = {
  name: string;
  run: () => { ok: boolean; detail: string };
};

const packPath = resolveVersionPath(
  'awaken',
  'awaken-0717feel__20260717T1450',
);
const pack = loadStoryPackFromDir(packPath);
const rankMap = getChapterRankMap(pack);
const defaultChapter = getDefaultChapterId(pack);
const npc = pack.npcs.find((n) => n.npc_id === 'npc_suolunsen')!;
const memories = npc.memories as NpcMemory[];

const cases: Case[] = [
  {
    name: '章门控：ch1 不得召回 ch2 记忆',
    run: () => {
      const unlocked = filterUnlockedMemories(
        memories,
        'ch1_daily',
        defaultChapter,
        rankMap,
      );
      const ids = unlocked.map((m) => m.id);
      const ok =
        ids.includes('mem_suolunsen_ch1_routine') &&
        !ids.includes('mem_suolunsen_suspicion_start');
      return { ok, detail: ids.join(',') };
    },
  },
  {
    name: '章门控：ch2 可召回 ch2 记忆',
    run: () => {
      const unlocked = filterUnlockedMemories(
        memories,
        'ch2_unease',
        defaultChapter,
        rankMap,
      );
      const ok = unlocked.some((m) => m.id === 'mem_suolunsen_suspicion_start');
      return { ok, detail: unlocked.map((m) => m.id).join(',') };
    },
  },
  {
    name: '向量路径：语义近义可命中 ch1 日常',
    run: () => {
      const unlocked = filterUnlockedMemories(
        memories,
        'ch1_daily',
        defaultChapter,
        rankMap,
      );
      const vecs = buildLocalMemoryVectors(unlocked);
      const q = localEmbed('放学后一起去篮球场喝汽水');
      const hits = retrieveByVector(unlocked, q, vecs, 2, 0.08);
      const ok = hits.some(
        (h) => h.memory.id === 'mem_suolunsen_ch1_routine' && h.source === 'vector',
      );
      return {
        ok,
        detail: hits.map((h) => `${h.memory.id}:${h.score.toFixed(3)}`).join(',') || '（空）',
      };
    },
  },
  {
    name: '向量空命中 → 关键词回退仍能找到',
    run: () => {
      const unlocked = filterUnlockedMemories(
        memories,
        'ch1_daily',
        defaultChapter,
        rankMap,
      );
      const vecs = buildLocalMemoryVectors(unlocked);
      const q = localEmbed('放学后一起去篮球场喝汽水');
      const vectorHits = retrieveByVector(unlocked, q, vecs, 2, 0.99);
      const kw = retrieveByKeyword(unlocked, '放学去喝汽水', 2);
      const ok =
        vectorHits.length === 0 &&
        kw.some((h) => h.memory.id === 'mem_suolunsen_ch1_routine');
      return {
        ok,
        detail: `vec=${vectorHits.length} kw=${kw.map((h) => h.memory.id).join(',')}`,
      };
    },
  },
  {
    name: '未解锁章：向量也召不回 ch2',
    run: () => {
      const unlocked = filterUnlockedMemories(
        memories,
        'ch1_daily',
        defaultChapter,
        rankMap,
      );
      const vecs = buildLocalMemoryVectors(unlocked);
      const q = localEmbed(memoryEmbedText(memories.find((m) => m.id === 'mem_suolunsen_suspicion_start')!));
      const hits = retrieveByVector(unlocked, q, vecs, 5, 0.01);
      const ok = !hits.some((h) => h.memory.id === 'mem_suolunsen_suspicion_start');
      return {
        ok,
        detail: hits.map((h) => h.memory.id).join(',') || '（空）',
      };
    },
  },
  {
    name: '关键词路径：显式关键词命中',
    run: () => {
      const unlocked = filterUnlockedMemories(
        memories,
        'ch2_unease',
        defaultChapter,
        rankMap,
      );
      const hits = retrieveByKeyword(unlocked, '挂钟倒走重影', 2);
      const ok = hits.some((h) => h.memory.id === 'mem_suolunsen_suspicion_start');
      return {
        ok,
        detail: hits.map((h) => h.memory.id).join(',') || '（空）',
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
