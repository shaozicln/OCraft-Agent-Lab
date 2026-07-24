/**
 * PC Pack 澄清离线 Eval：MOCK 会话 / 合并补丁 / schema。
 *
 * 用法：npm run clarify:eval
 */
import { normalizeClarifyLlmOutput } from '../src/story/pack-clarify-normalize';
import {
  buildPackIdGlossary,
  humanizeOptionLabel,
  humanizeClarifySession,
} from '../src/story/pack-clarify-humanize';
import { loadStoryPackFromDir } from '../src/story/pack-loader';
import { resolveVersionPath } from '../src/story/pack-ops';
import { packClarifySessionSchema, storyPackSchema } from '@ocraft/shared';
import { LlmService } from '../src/agent/llm.service';
import { PackClarifyService } from '../src/story/pack-clarify.service';

type Case = {
  name: string;
  run: () => Promise<{ ok: boolean; detail: string }> | { ok: boolean; detail: string };
};

const packPath = resolveVersionPath(
  'awaken',
  'awaken-0717feel__20260717T1450',
);
const pack = loadStoryPackFromDir(packPath);
const clarify = new PackClarifyService(new LlmService());

const cases: Case[] = [
  {
    name: 'MOCK 会话：1～2 题且含 ABC',
    run: () => {
      const session = clarify.buildMockSession(pack, '校园双人');
      const ok =
        session.source === 'mock' &&
        session.questions.length >= 1 &&
        session.questions.length <= 2 &&
        session.questions.every((q) => q.options.some((o) => o.key === 'C'));
      return {
        ok,
        detail: `n=${session.questions.length} topics=${session.questions.map((q) => q.topic).join(',')}`,
      };
    },
  },
  {
    name: 'apply：选择 B 写回并仍通过 schema',
    run: () => {
      const session = clarify.buildMockSession(pack, 'seed');
      const q1 = session.questions[0]!;
      const { next, patch_notes } = clarify.mergeAnswers(
        pack,
        new Map(session.questions.map((q) => [q.id, q])),
        [
          {
            question_id: q1.id,
            choice: 'B',
            free_text: '被安排转学，隐瞒动机',
          },
        ],
      );
      const parsed = storyPackSchema.safeParse(next);
      const ok =
        parsed.success &&
        patch_notes.length === 1 &&
        JSON.stringify(next).includes('澄清');
      return {
        ok,
        detail: parsed.success
          ? `patches=${patch_notes.length}`
          : parsed.error.message,
      };
    },
  },
  {
    name: 'apply：全选 C 且无自由文本 → 无补丁',
    run: () => {
      const session = clarify.buildMockSession(pack, 'seed');
      const answers = session.questions.map((q) => ({
        question_id: q.id,
        choice: 'C' as const,
      }));
      const { patch_notes } = clarify.mergeAnswers(
        pack,
        new Map(session.questions.map((q) => [q.id, q])),
        answers,
      );
      return {
        ok: patch_notes.length === 0,
        detail: `patches=${patch_notes.length}`,
      };
    },
  },
  {
    name: 'normalize：summary 字符串 + options 字符串数组可收成合法会话',
    run: () => {
      const normalized = normalizeClarifyLlmOutput({
        summary: '校园双人悬疑',
        questions: [
          {
            ask: '转学动机？',
            options: ['自愿', '被安排', '不确定'],
          },
        ],
        done: false,
      });
      const session = packClarifySessionSchema.safeParse({
        ...(normalized as object),
        source: 'llm',
      });
      return {
        ok:
          session.success &&
          session.data.questions[0]?.options[0]?.key === 'A' &&
          typeof session.data.summary.world_one_liner === 'string',
        detail: session.success
          ? session.data.summary.world_one_liner
          : session.error.message,
      };
    },
  },
  {
    name: 'humanize：公式选项改成 id（释义）',
    run: () => {
      const g = buildPackIdGlossary(pack);
      const label = humanizeOptionLabel(
        'jia=ending_jia+path_trust',
        g,
      );
      const ok =
        label.includes('（') &&
        !/jia=ending_jia\+path_trust/.test(label) &&
        label.includes('ending_jia');
      return { ok, detail: label };
    },
  },
  {
    name: 'humanize：silvie_dead 注上 Pack description',
    run: () => {
      const session = humanizeClarifySession(
        {
          summary: {
            world_one_liner: '测试',
            chapters: [],
            npcs: [],
            risks: ['涉及 silvie_dead'],
          },
          questions: [
            {
              id: 'q1',
              topic: 'silvie_dead',
              ask: '是否触发 silvie_dead？',
              options: [
                { key: 'A', label: '触发 silvie_dead' },
                { key: 'B', label: '不触发' },
                { key: 'C', label: '暂不确定，保持现状' },
              ],
              allow_free_text: true,
              allow_polish: true,
            },
          ],
          done: false,
          source: 'mock',
        },
        pack,
      );
      const ask = session.questions[0]?.ask ?? '';
      const ok = ask.includes('希尔薇') || ask.includes('死亡');
      return { ok, detail: ask };
    },
  },
  {
    name: 'polish MOCK：带【润色】前缀',
    run: async () => {
      const r = await clarify.polish({
        question_id: 'q1',
        draft_text: '她是被安排来的',
        topic: '动机',
      });
      const ok = r.polished_text.includes('润色') && r.type === 'polish';
      return { ok, detail: r.polished_text.slice(0, 40) };
    },
  },
];

let failed = 0;
async function main() {
  for (const c of cases) {
    try {
      const r = await c.run();
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
}

void main();
