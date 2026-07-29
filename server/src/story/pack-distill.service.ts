import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  assertPackReferences,
  distillApplyPayloadSchema,
  distillBriefPayloadSchema,
  distillBriefResultSchema,
  distillCardSchema,
  distillNormalizePayloadSchema,
  storyPackSchema,
  type DistillCard,
  type StoryPack,
} from '@ocraft/shared';
import { LlmService } from '../agent/core/llm.service';
import { applyDistillCardToPack } from './pack-distill-apply';
import { normalizeDistillInput } from './pack-distill-normalize';

const DISTILL_JSON_EXAMPLE = `{
  "name": "希尔薇",
  "npc_id": "npc_hilvi",
  "core_traits": ["安静", "礼貌", "短句"],
  "speech_patterns": ["少用感叹", "偶尔停顿"],
  "typical_phrases": ["也许吧", "档案上是这么写的"],
  "trigger_reactions": [
    { "situation": "被问转学原因", "reaction": "模糊带过，轻触书签" }
  ],
  "forbidden_behaviors": ["自称AI", "宣布升章或结局", "长篇设定讲解"],
  "source_note": "蒸馏自短描述"
}`;

@Injectable()
export class PackDistillService {
  private readonly logger = new Logger(PackDistillService.name);

  constructor(private readonly llm: LlmService) {}

  /** 短描述 → 蒸馏卡草稿（未写入 Pack） */
  async brief(raw: unknown) {
    const parsed = distillBriefPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message);
    }
    const brief = parsed.data.brief;
    const targetId = parsed.data.target_npc_id;

    let pack: StoryPack | null = null;
    if (parsed.data.pack != null) {
      pack = storyPackSchema.parse(parsed.data.pack);
    }

    if (this.llm.isMockMode()) {
      return distillBriefResultSchema.parse({
        card: this.buildMockCard(brief, targetId),
        source: 'mock',
      });
    }

    try {
      const packHint = pack
        ? `开场章=${pack.world.chapters.slice().sort((a, b) => a.rank - b.rank)[0]?.id ?? ''}；已有NPC=${pack.npcs.map((n) => n.npc_id).join(',')}`
        : '（无 Pack 上下文）';
      const rawJson = await this.llm.complete(
        [
          {
            role: 'system',
            content: [
              '你是角色人设蒸馏助手。把稀疏短描述扩成可枚举规则草稿。',
              '只输出一个 JSON 对象，字段严格符合示例（不要 markdown）。',
              '不要写升章/结局/硬触发器；trigger_reactions 只是软情境反应。',
              '文案用中文白话。npc_id 仅字母数字_-。',
              '示例：',
              DISTILL_JSON_EXAMPLE,
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `【短描述】${brief}`,
              targetId ? `【建议 npc_id】${targetId}` : '',
              `【Pack 提示】${packHint}`,
              '请输出蒸馏卡 JSON。',
            ]
              .filter(Boolean)
              .join('\n\n'),
          },
        ],
        { json: true, temperature: 0.4, maxTokens: 1200 },
      );
      const obj = JSON.parse(rawJson) as unknown;
      const { card } = normalizeDistillInput(obj);
      const withNote: DistillCard = {
        ...card,
        source_note: card.source_note?.trim() || '蒸馏自短描述',
        npc_id: card.npc_id || targetId,
      };
      return distillBriefResultSchema.parse({
        card: distillCardSchema.parse(withNote),
        source: 'llm',
      });
    } catch (err) {
      this.logger.warn(
        `distill brief LLM failed → mock: ${err instanceof Error ? err.message : err}`,
      );
      return distillBriefResultSchema.parse({
        card: this.buildMockCard(brief, targetId),
        source: 'mock',
      });
    }
  }

  /** 粘贴 YAML/JSON → 规范化蒸馏卡 */
  normalize(raw: unknown) {
    const parsed = distillNormalizePayloadSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message);
    }
    try {
      const { card, warnings } = normalizeDistillInput(parsed.data.raw);
      const withNote: DistillCard = {
        ...card,
        source_note: card.source_note?.trim() || '导入已蒸馏卡',
      };
      return {
        card: distillCardSchema.parse(withNote),
        warnings,
      };
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  /** 用户确认后的写入（仍只改草稿 Pack，由客户端再 PUT 落盘） */
  apply(raw: unknown) {
    const parsed = distillApplyPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message);
    }
    const pack = storyPackSchema.parse(parsed.data.pack);
    try {
      const { pack: next, patch_notes, applied_npc_id } = applyDistillCardToPack(
        pack,
        parsed.data.card,
        {
          mode: parsed.data.mode,
          target_npc_id: parsed.data.target_npc_id,
          overwrite: parsed.data.overwrite,
        },
      );
      const validated = storyPackSchema.parse(next);
      assertPackReferences(validated);
      this.logger.log(
        `distill apply npc=${applied_npc_id} patches=${patch_notes.length}`,
      );
      return {
        pack: validated,
        patch_notes,
        applied_npc_id,
        applied: patch_notes.length > 0,
        applied_summary:
          patch_notes.length > 0
            ? `已写入草稿：\n${patch_notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}`
            : '没有写入改动。',
      };
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  buildMockCard(brief: string, targetId?: string): DistillCard {
    const nameGuess =
      brief.match(/叫[「"']?([\u4e00-\u9fffA-Za-z0-9_]{1,12})/)?.[1] ||
      brief.match(/^([\u4e00-\u9fff]{1,8})/)?.[1] ||
      '新角色';
    return distillCardSchema.parse({
      name: nameGuess,
      npc_id: targetId || undefined,
      core_traits: ['沉稳', '观察力强', '话少'],
      speech_patterns: ['短句', '少感叹', '偶尔反问'],
      typical_phrases: [
        brief.slice(0, 40) || '……是吗。',
        '先这样吧。',
      ],
      trigger_reactions: [
        {
          situation: '被追问隐私',
          reaction: '含糊带过，把话题转回眼前事',
        },
      ],
      forbidden_behaviors: [
        '自称AI',
        '宣布升章或结局',
        '长篇设定讲解',
      ],
      source_note: `蒸馏自短描述：${brief.slice(0, 60)}`,
    });
  }
}
