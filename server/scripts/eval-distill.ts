/**
 * CD 人设蒸馏离线 Eval：normalize / apply / 插值保留 / MOCK brief。
 *
 * 用法：npm run distill:eval
 */
import {
  distillCardSchema,
  storyPackSchema,
  type DistillCard,
} from '@ocraft/shared';
import { LlmService } from '../src/agent/core/llm.service';
import {
  applyDistillCardToPack,
  mergePersonaIntoTemplate,
  preservesMustache,
} from '../src/story/pack-distill-apply';
import { normalizeDistillInput } from '../src/story/pack-distill-normalize';
import { PackDistillService } from '../src/story/pack-distill.service';
import { scanNpcReplySafety } from '../src/agent/safety/reply-safety';
import { loadStoryPackFromDir } from '../src/story/pack-loader';
import { resolveVersionPath } from '../src/story/pack-ops';

type Case = {
  name: string;
  run: () => Promise<{ ok: boolean; detail: string }> | { ok: boolean; detail: string };
};

const packPath = resolveVersionPath(
  'awaken',
  'awaken-0717feel__20260717T1450',
);
const pack = loadStoryPackFromDir(packPath);
const distill = new PackDistillService(new LlmService());

const sampleCard: DistillCard = distillCardSchema.parse({
  name: '阿黎',
  npc_id: 'npc_ali_cd',
  core_traits: ['冷淡', '短句'],
  speech_patterns: ['少感叹'],
  typical_phrases: ['先这样吧。'],
  trigger_reactions: [
    { situation: '被追问过去', reaction: '含糊带过' },
  ],
  forbidden_behaviors: ['自称AI', '宣布升章或结局'],
  source_note: 'eval',
});

const cases: Case[] = [
  {
    name: 'MOCK brief：产出合法 DistillCard',
    run: async () => {
      const res = await distill.brief({
        brief: '叫阿黎，冷淡短句，讨厌被追问',
        pack,
      });
      const ok =
        res.source === 'mock' &&
        res.card.name.length > 0 &&
        res.card.core_traits.length > 0;
      return { ok, detail: `name=${res.card.name} source=${res.source}` };
    },
  },
  {
    name: 'normalize JSON：别名与缺省',
    run: () => {
      const { card, warnings } = normalizeDistillInput({
        名字: '测试员',
        traits: ['稳'],
      });
      const ok = card.name === '测试员' && card.core_traits.includes('稳');
      return {
        ok,
        detail: `warnings=${warnings.length} traits=${card.core_traits.join(',')}`,
      };
    },
  },
  {
    name: 'normalize 简易 YAML',
    run: () => {
      const yaml = [
        'name: 雨桐',
        'core_traits:',
        '  - 温和',
        'forbidden_behaviors:',
        '  - 自称AI',
      ].join('\n');
      const { card } = normalizeDistillInput(yaml);
      const ok =
        card.name === '雨桐' &&
        card.core_traits.includes('温和') &&
        card.forbidden_behaviors.includes('自称AI');
      return { ok, detail: `name=${card.name}` };
    },
  },
  {
    name: 'apply create：新建 NPC 且 schema+refs 通过',
    run: () => {
      const { pack: next, applied_npc_id, patch_notes } = applyDistillCardToPack(
        pack,
        sampleCard,
        { mode: 'create' },
      );
      const parsed = storyPackSchema.safeParse(next);
      const found = next.npcs.find((n) => n.npc_id === applied_npc_id);
      const ok =
        parsed.success &&
        Boolean(found) &&
        (found?.system_prompt_template.includes('【人设·蒸馏】') ?? false) &&
        patch_notes.length > 0;
      return {
        ok,
        detail: parsed.success
          ? `npc=${applied_npc_id} mems=${found?.memories.length}`
          : parsed.error.message,
      };
    },
  },
  {
    name: 'apply update：保留 {{affinity}} 插值',
    run: () => {
      const baseNpc = pack.npcs[0]!;
      const withMustache = {
        ...pack,
        npcs: pack.npcs.map((n, i) =>
          i === 0
            ? {
                ...n,
                system_prompt_template: `${n.system_prompt_template}\n好感提示：{{affinity}}`,
              }
            : n,
        ),
      };
      const { pack: next } = applyDistillCardToPack(
        withMustache,
        {
          ...sampleCard,
          name: baseNpc.name,
          npc_id: baseNpc.npc_id,
        },
        { mode: 'update', target_npc_id: baseNpc.npc_id },
      );
      const updated = next.npcs.find((n) => n.npc_id === baseNpc.npc_id)!;
      const before = withMustache.npcs[0]!.system_prompt_template;
      const preserve = preservesMustache(before, updated.system_prompt_template);
      const ok =
        preserve.ok &&
        updated.system_prompt_template.includes('{{affinity}}') &&
        updated.system_prompt_template.includes('【人设·蒸馏】');
      return {
        ok,
        detail: `missing=${preserve.missing.join(',') || 'none'}`,
      };
    },
  },
  {
    name: 'apply create 冲突无 overwrite → 抛错',
    run: () => {
      const existing = pack.npcs[0]!.npc_id;
      try {
        applyDistillCardToPack(
          pack,
          { ...sampleCard, npc_id: existing },
          { mode: 'create', overwrite: false },
        );
        return { ok: false, detail: '应抛错却成功' };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: msg.includes('已存在'), detail: msg.slice(0, 80) };
      }
    },
  },
  {
    name: 'service.apply 经 validate',
    run: () => {
      const res = distill.apply({
        pack,
        card: sampleCard,
        mode: 'create',
      });
      const parsed = storyPackSchema.safeParse(res.pack);
      return {
        ok: res.applied && parsed.success,
        detail: `npc=${res.applied_npc_id}`,
      };
    },
  },
  {
    name: 'mergePersona：二次蒸馏替换旧块不叠两层',
    run: () => {
      const once = mergePersonaIntoTemplate('', sampleCard);
      const twice = mergePersonaIntoTemplate(once, {
        ...sampleCard,
        name: '阿黎改',
      });
      const count = (twice.match(/【人设·蒸馏】/g) ?? []).length;
      return {
        ok: count === 1 && twice.includes('阿黎改'),
        detail: `blocks=${count}`,
      };
    },
  },
  {
    name: 'CD-B：apply 写入 forbidden + reply_instruction 话风',
    run: () => {
      const { pack: next, patch_notes } = applyDistillCardToPack(
        pack,
        sampleCard,
        { mode: 'create' },
      );
      const npc = next.npcs.find((n) => n.npc_id === 'npc_ali_cd');
      const ok =
        Boolean(npc?.forbidden_behaviors?.includes('自称AI')) &&
        next.prompts.reply_instruction.includes('【蒸馏话风·npc_ali_cd】') &&
        next.prompts.reply_instruction.includes('少感叹') &&
        patch_notes.some((n) => n.includes('CD-B'));
      return {
        ok,
        detail: `forbid=${npc?.forbidden_behaviors?.join(',') ?? '-'} style=${next.prompts.reply_instruction.includes('蒸馏话风')}`,
      };
    },
  },
  {
    name: 'CD-B：safety 命中 forbidden_behavior',
    run: () => {
      const { pack: next } = applyDistillCardToPack(pack, sampleCard, {
        mode: 'create',
      });
      const r = scanNpcReplySafety('现在升章进入下一章吧。', {
        pack: next,
        chapterState: pack.world.chapters[0]!.id,
        npcId: 'npc_ali_cd',
      });
      const ok =
        !r.ok && r.reasons.some((x) => x.code === 'forbidden_behavior');
      return {
        ok,
        detail: r.reasons.map((x) => x.code).join(',') || 'ok',
      };
    },
  },
];

async function main() {
  let failed = 0;
  for (const c of cases) {
    try {
      const r = await c.run();
      const mark = r.ok ? 'PASS' : 'FAIL';
      if (!r.ok) failed += 1;
      console.log(`[${mark}] ${c.name} — ${r.detail}`);
    } catch (err) {
      failed += 1;
      console.log(
        `[FAIL] ${c.name} — ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  console.log(
    failed === 0
      ? `\nOK distill:eval ${cases.length}/${cases.length}`
      : `\nFAIL distill:eval ${cases.length - failed}/${cases.length}`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

void main();
