/**
 * 强业务指令（N）离线 Eval：白名单 / query_runtime / request_hint。
 *
 * 用法：npm run tools:eval
 */
import { loadStoryPackFromDir } from '../src/story/pack-loader';
import { resolveVersionPath } from '../src/story/pack-ops';
import {
  isAllowedNpcTool,
  rejectUnknownTool,
  runQueryRuntime,
  runRequestHint,
  tryExecuteStrongTool,
} from '../src/agent/npc-strong-tools';

type Case = {
  name: string;
  run: () => { ok: boolean; detail: string };
};

const packPath = resolveVersionPath(
  'awaken',
  'awaken-0717feel__20260717T1450',
);
const pack = loadStoryPackFromDir(packPath);

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
    name: '白名单含 query_runtime / request_hint',
    run: () => {
      const ok =
        isAllowedNpcTool('query_runtime') &&
        isAllowedNpcTool('request_hint') &&
        isAllowedNpcTool('updateAffinity') &&
        !isAllowedNpcTool('open_inventory');
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
