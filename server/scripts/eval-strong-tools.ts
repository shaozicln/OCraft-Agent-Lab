/**
 * 强业务指令（N）+ Mem-T 离线 Eval：白名单 / query_runtime / request_hint / recall_memory。
 *
 * 用法：npm run tools:eval
 */
import { loadStoryPackFromDir } from '../src/story/pack-loader';
import { resolveVersionPath } from '../src/story/pack-ops';
import {
  getChapterRankMap,
  getDefaultChapterId,
  recallMemorySchema,
  type NpcMemory,
} from '@ocraft/shared';
import {
  formatRecallMemoryResult,
  isAllowedNpcTool,
  rejectUnknownTool,
  runQueryRuntime,
  runRequestHint,
  tryExecuteStrongTool,
} from '../src/agent/tools/npc-strong-tools';
import {
  filterUnlockedMemories,
  retrieveByKeyword,
} from '../src/agent/memory/rag-retrieve';

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
const memories = pack.npcs.find((n) => n.npc_id === 'npc_suolunsen')!
  .memories as NpcMemory[];

const baseCtx = {
  pack,
  chapterState: 'ch2_unease',
  flags: { met_hook: 'true' },
  runtime: {
    affinity: 40,
    fatigue: 25,
    current_status: 'idle',
  },
};

const cases: Case[] = [
  {
    name: '白名单含 query_runtime / request_hint / recall_memory',
    run: () => {
      const ok =
        isAllowedNpcTool('query_runtime') &&
        isAllowedNpcTool('request_hint') &&
        isAllowedNpcTool('recall_memory') &&
        isAllowedNpcTool('updateAffinity') &&
        !isAllowedNpcTool('open_inventory') &&
        !isAllowedNpcTool('write_memory');
      return { ok, detail: 'whitelist check' };
    },
  },
  {
    name: '未知 tool → 拒绝 observation',
    run: () => {
      const r = rejectUnknownTool('open_inventory', {});
      const ok =
        r.observation.includes('拒绝') && r.tool === 'open_inventory';
      return { ok, detail: r.observation };
    },
  },
  {
    name: 'query_runtime 正例：含章与数值',
    run: () => {
      const r = runQueryRuntime(baseCtx, { reason: '核对' });
      const ok =
        r.tool === 'query_runtime' &&
        r.observation.includes('ch2_unease') &&
        r.observation.includes('好感 40') &&
        r.observation.includes('疲惫 25') &&
        r.observation.includes('met_hook=true');
      return { ok, detail: r.observation };
    },
  },
  {
    name: 'query_runtime 正例：空 args 可解析',
    run: () => {
      const r = tryExecuteStrongTool('query_runtime', {}, baseCtx);
      return {
        ok: !!r && r.tool === 'query_runtime',
        detail: r?.observation ?? 'null',
      };
    },
  },
  {
    name: 'request_hint 正例：仅本章、含勿剧透提醒',
    run: () => {
      const r = runRequestHint(baseCtx, { topic: '希尔薇' });
      const otherChapterIds = pack.world.chapters
        .map((c) => c.id)
        .filter((id) => id !== 'ch2_unease');
      const leaked = otherChapterIds.some((id) =>
        r.observation.includes(`（${id}）`),
      );
      const ok =
        r.tool === 'request_hint' &&
        r.observation.includes('希尔薇') &&
        r.observation.includes('勿剧透') &&
        !leaked;
      return { ok, detail: r.observation.slice(0, 200) };
    },
  },
  {
    name: 'request_hint 正例：无 topic 也可',
    run: () => {
      const r = tryExecuteStrongTool('request_hint', {}, baseCtx);
      return {
        ok: !!r && r.observation.length > 10,
        detail: r?.observation.slice(0, 160) ?? 'null',
      };
    },
  },
  {
    name: '负例：updateAffinity 不是强指令分支',
    run: () => {
      const r = tryExecuteStrongTool(
        'updateAffinity',
        { delta: 1 },
        baseCtx,
      );
      return { ok: r === null, detail: String(r) };
    },
  },
  {
    name: '负例：非法 request_hint topic 类型 → 抛错',
    run: () => {
      try {
        tryExecuteStrongTool(
          'request_hint',
          { topic: 123 },
          baseCtx,
        );
        return { ok: false, detail: 'should throw' };
      } catch {
        return { ok: true, detail: 'zod reject' };
      }
    },
  },
  {
    name: 'Mem-T：recall_memory schema 拒空 query',
    run: () => {
      try {
        recallMemorySchema.parse({ query: '  ' });
        return { ok: false, detail: 'should reject blank' };
      } catch {
        return { ok: true, detail: 'zod reject blank' };
      }
    },
  },
  {
    name: 'Mem-T：ch1 门控不得召回 ch2 记忆',
    run: () => {
      const unlocked = filterUnlockedMemories(
        memories,
        'ch1_daily',
        defaultChapter,
        rankMap,
      );
      const hits = retrieveByKeyword(unlocked, '钟表 走廊尽头 重影', 3);
      const leaked = hits.some(
        (h) => h.memory.id === 'mem_suolunsen_suspicion_start',
      );
      const r = formatRecallMemoryResult(
        { query: '钟表 走廊尽头 重影' },
        hits.map((h) => ({
          id: h.memory.id,
          content: h.memory.content,
          score: h.score,
          source: h.source,
        })),
        { path: 'keyword_fallback' },
      );
      return {
        ok: !leaked && r.tool === 'recall_memory',
        detail: `${r.observation.slice(0, 120)} | ids=${hits.map((h) => h.memory.id).join(',')}`,
      };
    },
  },
  {
    name: 'Mem-T：ch2 可召回并格式化 observation',
    run: () => {
      const unlocked = filterUnlockedMemories(
        memories,
        'ch2_unease',
        defaultChapter,
        rankMap,
      );
      const hits = retrieveByKeyword(unlocked, '钟表 走廊尽头 重影', 2);
      const r = formatRecallMemoryResult(
        { query: '钟表 走廊尽头 重影', reason: '核对' },
        hits.map((h) => ({
          id: h.memory.id,
          content: h.memory.content,
          score: h.score,
          source: h.source,
        })),
        { path: 'keyword_fallback' },
      );
      const ok =
        hits.some((h) => h.memory.id === 'mem_suolunsen_suspicion_start') &&
        r.observation.includes('记忆召回') &&
        r.observation.includes('path=keyword_fallback') &&
        !r.observation.includes('写回');
      return { ok, detail: r.observation.slice(0, 180) };
    },
  },
  {
    name: 'Mem-T：tryExecuteStrongTool(recall) 仅先验 schema',
    run: () => {
      const r = tryExecuteStrongTool(
        'recall_memory',
        { query: '球场' },
        baseCtx,
      );
      return { ok: r === null, detail: 'harness 异步检索' };
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
