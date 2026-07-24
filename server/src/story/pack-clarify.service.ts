import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  assertPackReferences,
  packClarifyApplyPayloadSchema,
  packClarifyPolishPayloadSchema,
  packClarifyPolishResultSchema,
  packClarifySessionSchema,
  packClarifyStartPayloadSchema,
  storyPackSchema,
  type PackClarifyAnswer,
  type PackClarifyQuestion,
  type PackClarifySession,
  type StoryPack,
} from '@ocraft/shared';
import { LlmService } from '../agent/llm.service';
import { normalizeClarifyLlmOutput } from './pack-clarify-normalize';
import {
  formatGlossaryForPrompt,
  humanizeClarifySession,
} from './pack-clarify-humanize';

const CLARIFY_JSON_EXAMPLE = `{
  "summary": {
    "world_one_liner": "一句话世界",
    "chapters": ["日常", "裂痕"],
    "npcs": ["索伦森（同班好友）", "希尔薇（转校生）"],
    "risks": ["可能歧义：转学动机未钉死"]
  },
  "questions": [
    {
      "id": "q1",
      "topic": "希尔薇出场动机",
      "ask": "她转学是自愿还是被安排？",
      "options": [
        { "key": "A", "label": "自愿转学" },
        { "key": "B", "label": "被安排/隐瞒" },
        { "key": "C", "label": "暂不确定，保持现状" }
      ],
      "allow_free_text": true,
      "allow_polish": true
    }
  ],
  "done": false
}`;

@Injectable()
export class PackClarifyService {
  private readonly logger = new Logger(PackClarifyService.name);

  constructor(private readonly llm: LlmService) {}

  async start(raw: unknown): Promise<PackClarifySession> {
    const parsed = packClarifyStartPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message);
    }
    const pack = storyPackSchema.parse(parsed.data.pack);
    const prompt = parsed.data.prompt?.trim() ?? '';
    const outline = parsed.data.outline?.trim() ?? '';

    if (this.llm.isMockMode()) {
      return humanizeClarifySession(
        this.buildMockSession(pack, prompt || outline),
        pack,
      );
    }

    try {
      const packBrief = this.briefPack(pack);
      const glossary = formatGlossaryForPrompt(pack);
      const rawJson = await this.llm.complete(
        [
          {
            role: 'system',
            content: [
              '你是 Story Pack 澄清助手，不是重写编剧。',
              '只输出一个 JSON 对象，字段必须严格符合示例形状（不要 markdown）。',
              'summary 必须是对象；questions[].options 必须是 [{key,label}]，key 只能 A/B/C。',
              '【文案铁律】',
              '1) 选项 label、topic、ask 必须是中文白话，玩家能直接读懂。',
              '2) 严禁公式腔，例如禁止：jia=ending_jia+path_trust、yi=ending_yi+path_dismiss。',
              '3) 若必须提到 flag/章/结局 id，只能写成「id（中文含义）」，含义优先用词表。',
              '4) 不要输出 flags[xxx].trigger_condition 这类技术写回路径；不要 target_hint 技术字符串。',
              '5) 最多 5 题；C = 暂不确定，保持现状。',
              '示例：',
              CLARIFY_JSON_EXAMPLE,
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `【用户梗概】${prompt || '（无）'}`,
              `【大纲摘录】${(outline || '（无）').slice(0, 2000)}`,
              `【当前 Pack 摘要】\n${packBrief}`,
              `【id 词表（必须按此加括号释义）】\n${glossary || '（无）'}`,
              '请按示例形状输出澄清 JSON（全白话）。',
            ].join('\n\n'),
          },
        ],
        { json: true, temperature: 0.35, maxTokens: 1200 },
      );
      const normalized = normalizeClarifyLlmOutput(JSON.parse(rawJson));
      let session = packClarifySessionSchema.parse({
        ...(normalized as object),
        source: 'llm',
      });
      if (session.questions.length === 0) {
        throw new Error('clarify LLM returned zero questions after normalize');
      }
      if (session.questions.length > 5) {
        session.questions = session.questions.slice(0, 5);
      }
      return humanizeClarifySession(session, pack);
    } catch (err) {
      this.logger.warn(
        `clarify LLM failed → mock: ${err instanceof Error ? err.message : err}`,
      );
      return humanizeClarifySession(
        this.buildMockSession(pack, prompt || outline),
        pack,
      );
    }
  }

  async apply(raw: unknown): Promise<{
    pack: StoryPack;
    patch_notes: string[];
    applied: boolean;
    applied_summary: string;
  }> {
    const parsed = packClarifyApplyPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message);
    }
    const pack = storyPackSchema.parse(parsed.data.pack);
    const questions = parsed.data.questions;
    const answers = parsed.data.answers;
    const qMap = new Map(questions.map((q) => [q.id, q]));

    const { next, patch_notes } = this.mergeAnswers(pack, qMap, answers);
    const validated = storyPackSchema.parse(next);
    assertPackReferences(validated);
    this.logger.log(
      `clarify apply patches=${patch_notes.length} skip=${Boolean(parsed.data.skip_remaining)}`,
    );
    return {
      pack: validated,
      patch_notes,
      applied: patch_notes.length > 0,
      applied_summary:
        patch_notes.length > 0
          ? `已写入草稿 ${patch_notes.length} 处：\n${patch_notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}`
          : '没有写入改动（多半选了「保持现状」且未填补充）。草稿未变。',
    };
  }

  async polish(raw: unknown) {
    const parsed = packClarifyPolishPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.message);
    }
    const { question_id, draft_text, topic, ask, target_hint } = parsed.data;

    if (this.llm.isMockMode()) {
      return packClarifyPolishResultSchema.parse({
        type: 'polish',
        question_id,
        polished_text: `【润色】${draft_text.replace(/\s+/g, ' ').trim()}`.slice(
          0,
          800,
        ),
        target_hint: target_hint ?? 'header.notes',
      });
    }

    try {
      const rawJson = await this.llm.complete(
        [
          {
            role: 'system',
            content:
              '你润色玩家补充的短设定。只输出 JSON：{"type":"polish","question_id":"...","polished_text":"...","target_hint":"..."}。勿编造整包。',
          },
          {
            role: 'user',
            content: [
              `question_id=${question_id}`,
              `topic=${topic ?? ''}`,
              `ask=${ask ?? ''}`,
              `target_hint=${target_hint ?? 'header.notes'}`,
              `draft_text=${draft_text}`,
            ].join('\n'),
          },
        ],
        { json: true, temperature: 0.4, maxTokens: 400 },
      );
      return packClarifyPolishResultSchema.parse({
        ...JSON.parse(rawJson),
        type: 'polish',
        question_id,
      });
    } catch (err) {
      this.logger.warn(
        `clarify polish failed: ${err instanceof Error ? err.message : err}`,
      );
      return packClarifyPolishResultSchema.parse({
        type: 'polish',
        question_id,
        polished_text: draft_text,
        target_hint: target_hint ?? 'header.notes',
      });
    }
  }

  /** Eval / MOCK：固定 1～2 题 */
  buildMockSession(pack: StoryPack, seed: string): PackClarifySession {
    const npc = pack.npcs[0];
    const ch = pack.world.chapters[0];
    const questions: PackClarifyQuestion[] = [
      {
        id: 'q1',
        topic: npc ? `${npc.name}动机` : '主角动机',
        ask: npc
          ? `${npc.name} 的核心动机更偏哪边？（生成种子：${seed.slice(0, 24) || '默认'}）`
          : '主角核心动机更偏哪边？',
        options: [
          { key: 'A', label: '主动探寻真相' },
          { key: 'B', label: '被迫卷入、想抽身' },
          { key: 'C', label: '暂不确定，保持现状' },
        ],
        allow_free_text: true,
        allow_polish: true,
        target_hint: npc
          ? `npcs[${npc.npc_id}].system_prompt_template`
          : 'header.notes',
      },
    ];
    if (ch) {
      questions.push({
        id: 'q2',
        topic: `${ch.display_name}节奏`,
        ask: `开场章「${ch.display_name}」更希望怎样开？`,
        options: [
          { key: 'A', label: '日常铺垫后再异常' },
          { key: 'B', label: '尽快出现裂痕/异常' },
          { key: 'C', label: '暂不确定，保持现状' },
        ],
        allow_free_text: true,
        allow_polish: true,
        target_hint: `prompts.chapter_constraints[${ch.id}]`,
      });
    }
    return packClarifySessionSchema.parse({
      summary: {
        world_one_liner: (
          pack.header.notes?.trim() ||
          `${pack.header.display_name}：待澄清的设定包`
        ).slice(0, 200),
        chapters: pack.world.chapters.map(
          (c) => `${c.id}:${c.display_name}`.slice(0, 120),
        ),
        npcs: pack.npcs.map((n) => `${n.name}（${n.npc_id}）`.slice(0, 120)),
        risks: ['可能歧义：动机/开场节奏未钉死（MOCK 澄清）'],
      },
      questions,
      done: false,
      source: 'mock',
    });
  }

  mergeAnswers(
    pack: StoryPack,
    qMap: Map<string, PackClarifyQuestion>,
    answers: PackClarifyAnswer[],
  ): { next: StoryPack; patch_notes: string[] } {
    const next: StoryPack = structuredClone(pack);
    const patch_notes: string[] = [];

    for (const a of answers) {
      const q = qMap.get(a.question_id);
      if (!q) continue;
      const choice = a.choice;
      const free = a.free_text?.trim() ?? '';
      if ((!choice || choice === 'C') && !free) continue;

      const optLabel =
        q.options.find((o) => o.key === choice)?.label ?? '';
      const line = `[澄清·${q.topic}] ${[optLabel, free].filter(Boolean).join('；')}`;
      const where = this.describeWriteback(q.target_hint);
      patch_notes.push(`${line} → 已写入「${where}」`);
      this.applyLine(next, q.target_hint, line);
    }

    return { next, patch_notes };
  }

  private describeWriteback(targetHint: string | undefined): string {
    const hint = targetHint?.trim() || 'header.notes';
    const npcMatch = /^npcs\[([^\]]+)\]\.system_prompt_template$/.exec(hint);
    if (npcMatch) return `角色 ${npcMatch[1]} 的人设旁注`;
    const chMatch = /^prompts\.chapter_constraints\[([^\]]+)\]$/.exec(hint);
    if (chMatch) return `章节「${chMatch[1]}」的扮演旁注`;
    return '本包备注（可在编辑器「包头备注」里看到）';
  }

  private applyLine(
    pack: StoryPack,
    targetHint: string | undefined,
    line: string,
  ) {
    const hint = targetHint?.trim() || 'header.notes';

    const npcMatch = /^npcs\[([^\]]+)\]\.system_prompt_template$/.exec(hint);
    if (npcMatch) {
      const npc = pack.npcs.find((n) => n.npc_id === npcMatch[1]);
      if (npc) {
        npc.system_prompt_template = `${npc.system_prompt_template.trim()}\n${line}`;
        return;
      }
    }

    const chMatch = /^prompts\.chapter_constraints\[([^\]]+)\]$/.exec(hint);
    if (chMatch) {
      const id = chMatch[1]!;
      const prev = pack.prompts.chapter_constraints[id] ?? '';
      pack.prompts.chapter_constraints[id] = prev
        ? `${prev.trim()}\n${line}`
        : line;
      return;
    }

    pack.header.notes = pack.header.notes
      ? `${pack.header.notes.trim()}\n${line}`
      : line;
  }

  private briefPack(pack: StoryPack): string {
    return [
      `display=${pack.header.display_name}`,
      `chapters=${pack.world.chapters.map((c) => `${c.id}（${c.display_name}）`).join(',')}`,
      `flags=${
        pack.world.flags
          .map((f) => `${f.name}（${f.description || '剧情标志'}）`)
          .join('; ') || '-'
      }`,
      `npcs=${pack.npcs.map((n) => `${n.npc_id}（${n.name}）`).join(';')}`,
      `endings=${
        (pack.world.endings ?? [])
          .map((e) => `${e.id}（${e.display_name}）`)
          .join('; ') || '-'
      }`,
    ].join('\n');
  }
}
