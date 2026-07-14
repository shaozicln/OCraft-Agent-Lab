import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  assertPackReferences,
  DEFAULT_PACK_GENERATE_SECTIONS,
  PACK_GENERATE_OUTLINE_MAX,
  PACK_GENERATE_PROMPT_MAX,
  PACK_GENERATE_SECTION_LABELS,
  packGenerateSectionKeys,
  storyPackSchema,
  type PackGenerateSectionKey,
  type PackGenerateSections,
  type PackGenerateStreamEvent,
  type PlayerProfileField,
  type StoryPack,
} from '@ocraft/shared';
import { LlmService } from '../agent/llm.service';

const SYSTEM_BASE = `你是 Story Pack 局部配置生成器。根据用户提示词与「当前包摘要」，只输出指定片段的 JSON 对象，不要 markdown。
创作原则：规模与内容严格跟用户提示词；id/name/npc_id 仅字母数字下划线连字符；交叉引用须指向摘要里已有或本片段新建的 id。
animation 只能是 idle/sleeping/talk/excited_talk。`;

const SECTION_INSTRUCTIONS: Record<PackGenerateSectionKey, string> = {
  chapters: `只输出：{ "chapters": [...], "default_chapter": "某章id" }
chapters 项含 id, display_name, hud_label?, rank（从 0 递增）。按提示词决定章数。`,
  flags: `只输出：{ "flags": [...] }
项含 name, type("bool"|"enum"), description?, enum_values?, irreversible?。按提示词决定数量。`,
  numeric_tools: `只输出：{ "numeric_tools": { "fatigue_increase": { triggers, delta, reason }, "interest_hit": { affinity_delta, affinity_reason, fatigue_delta, fatigue_reason } } }`,
  animation_rules: `只输出：{ "animation_rules": [ { id, enabled, when, animation } ] }
when 可含 message_triggers / interest_hit / fatigue_delta_gt 等。`,
  endings: `只输出：{ "endings": [ { id, display_name, notes?, performance_hint? } ] }；可不需要时给 []。`,
  chapter_triggers: `只输出：{ "rules": [ { id, enabled, from_chapter, to_chapter, min_affinity, require_flags, player_triggers, set_flags, notes? } ] }
必须引用摘要中的章节/flag；至少覆盖提示词中的升章路径。
set_flags 必须是对象数组，例如 [{"name":"flag_id","value":"true"}]，禁止写成字符串数组如 ["flag_id"]。
require_flags 才是字符串 id 数组。无置位时 set_flags 用 []。`,
  npc_reply_flags: `只输出：{ "npc_reply_flag_rules": [ { id, enabled, when_chapter_in, set_flag, value, triggers } ] }；可不需要时给 []。
value 必须是字符串（如 "true" / "false" / 枚举字面量），禁止用布尔 true/false。`,
  prompt_common: `只输出：{ "reply_instruction": "..." }`,
  affinity_tiers: `只输出：{ "affinity_tiers": [ { max_exclusive, text } ] }；最后一档 max_exclusive 用大数如 999。`,
  fatigue_hints: `只输出：{ "fatigue_hints": [ { min, text } ] }`,
  chapter_constraints: `只输出：{ "chapter_constraints": { "章id": "约束正文" } }；须覆盖摘要中每一章。`,
  flag_constraints: `只输出：{ "flag_constraints": [ { id, when: { flag, set, chapter? }, text } ] }；可不需要时给 []。`,
  npcs: `只输出：{ "npcs": [...], "default_npc": "某npc_id" }
每个 NPC：npc_id, name, meta{avatar:"",model_path:"",scale:[1,1,1],spawn_position}, attributes{fatigue,max_fatigue,affinity,current_status,favorite_things}, system_prompt_template, memories[{id,tags,keywords,content,min_chapter}]
按提示词决定 NPC 数量；多 NPC 时 spawn_position.x 错开约 1.5。`,
  pack_profile: `只输出：{ "profile_fields": [ { id, label, value } ] }；2～6 个本世界玩家人设项。`,
};

@Injectable()
export class PackGenerateService {
  private readonly logger = new Logger(PackGenerateService.name);

  constructor(private readonly llm: LlmService) {}

  /** 非流式：收集流式结果（兼容旧接口） */
  async generateDraft(opts: {
    prompt: string;
    outline?: string;
    basePack: StoryPack;
    sections?: PackGenerateSections;
  }): Promise<{
    pack: StoryPack;
    source: 'llm' | 'mock';
    profileFields?: PlayerProfileField[];
  }> {
    let pack = opts.basePack;
    let source: 'llm' | 'mock' = 'llm';
    let profileFields: PlayerProfileField[] | undefined;
    let lastError = '';

    for await (const ev of this.generateDraftStream(opts)) {
      if (ev.type === 'section_done' && ev.pack) {
        pack = ev.pack as StoryPack;
      }
      if (ev.type === 'error') {
        lastError = ev.message;
      }
      if (ev.type === 'done') {
        pack = ev.pack as StoryPack;
        source = ev.source;
        profileFields = ev.profileFields as PlayerProfileField[] | undefined;
        return { pack, source, profileFields };
      }
    }
    throw new BadRequestException(
      lastError || '生成草稿失败：未收到完成事件',
    );
  }

  /**
   * 按勾选 section 串行生成；每步 yield SSE 事件。不落盘。
   */
  async *generateDraftStream(opts: {
    prompt: string;
    outline?: string;
    basePack: StoryPack;
    sections?: PackGenerateSections;
  }): AsyncGenerator<PackGenerateStreamEvent, void, unknown> {
    const brief = this.buildAuthorBrief(opts.prompt, opts.outline);
    if (brief.length < 4) {
      yield {
        type: 'error',
        message: '请填写至少 4 字的梗概/摘要，或导入大纲全文',
      };
      return;
    }
    if ((opts.prompt ?? '').trim().length > PACK_GENERATE_PROMPT_MAX) {
      yield {
        type: 'error',
        message: `梗概/摘要过长（最多 ${PACK_GENERATE_PROMPT_MAX} 字）`,
      };
      return;
    }
    if ((opts.outline ?? '').trim().length > PACK_GENERATE_OUTLINE_MAX) {
      yield {
        type: 'error',
        message: `导入大纲过长（最多 ${PACK_GENERATE_OUTLINE_MAX} 字）`,
      };
      return;
    }

    const sections = opts.sections ?? DEFAULT_PACK_GENERATE_SECTIONS;
    const queue = packGenerateSectionKeys.filter((k) => sections[k]);
    if (queue.length === 0) {
      yield { type: 'error', message: '请至少勾选一个生成项目' };
      return;
    }

    const source: 'llm' | 'mock' = this.llm.isMockMode() ? 'mock' : 'llm';
    let current: StoryPack = {
      ...opts.basePack,
      header: {
        ...opts.basePack.header,
        notes: opts.basePack.header.notes
          ? `AI 草稿｜${opts.basePack.header.notes}`.slice(0, 500)
          : 'AI 生成草稿',
      },
    };
    let profileFields: PlayerProfileField[] | undefined;
    const mockSeed =
      (opts.prompt ?? '').trim() ||
      (opts.outline ?? '').trim().slice(0, 200) ||
      'story';
    const mockFull =
      source === 'mock' ? this.buildMockDraft(mockSeed, opts.basePack) : null;

    const failed = new Map<PackGenerateSectionKey, string>();

    const runOne = async (
      section: PackGenerateSectionKey,
    ): Promise<{ ok: true } | { ok: false; message: string }> => {
      try {
        if (mockFull) {
          await this.delay(280);
          const applied = this.applyFromFullPack(
            current,
            mockFull.pack,
            section,
          );
          current = applied.pack;
          if (section === 'pack_profile') {
            profileFields = mockFull.profileFields;
          }
        } else {
          const fragment = await this.generateOneSection({
            brief,
            section,
            current,
          });
          if (section === 'pack_profile') {
            profileFields = this.normalizeProfileFields(
              fragment.profile_fields,
              mockSeed,
            );
          } else {
            current = this.applyFragment(current, section, fragment);
          }
        }
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, message };
      }
    };

    for (const section of queue) {
      const label = PACK_GENERATE_SECTION_LABELS[section];
      yield { type: 'section_start', section, label };

      const result = await runOne(section);
      if (result.ok) {
        failed.delete(section);
        yield {
          type: 'section_done',
          section,
          label,
          pack: current,
        };
      } else {
        this.logger.warn(`section ${section} failed: ${result.message}`);
        failed.set(section, result.message);
        yield {
          type: 'error',
          section,
          message: `${label} 生成失败：${result.message}`,
        };
      }
    }

    const retryQueue = [...failed.keys()];
    if (retryQueue.length > 0) {
      for (const section of retryQueue) {
        const label = PACK_GENERATE_SECTION_LABELS[section];
        yield {
          type: 'section_start',
          section,
          label: `${label}（重试）`,
        };
        const result = await runOne(section);
        if (result.ok) {
          failed.delete(section);
          yield {
            type: 'section_done',
            section,
            label: `${label}（重试成功）`,
            pack: current,
          };
        } else {
          this.logger.warn(`section ${section} retry failed: ${result.message}`);
          failed.set(section, result.message);
          yield {
            type: 'error',
            section,
            message: `${label} 重试仍失败：${result.message}`,
          };
        }
      }
    }

    let mergeWarning = '';
    try {
      current = storyPackSchema.parse(current);
      assertPackReferences(current);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      mergeWarning = `合并后校验有问题：${message}`;
      yield {
        type: 'error',
        message: `${mergeWarning}。已保留已生成部分，请检查交叉引用后手动改。`,
      };
    }

    const failedList = [...failed.entries()].map(([section, message]) => ({
      section,
      message,
    }));
    const okCount = queue.length - failedList.length;
    const failLabels = failedList
      .map((f) => PACK_GENERATE_SECTION_LABELS[f.section])
      .join('、');
    let summary =
      failedList.length === 0
        ? `全部 ${queue.length} 项生成成功`
        : `成功 ${okCount}/${queue.length}；仍失败：${failLabels || '无'}`;
    if (mergeWarning) {
      summary += `。${mergeWarning}`;
    }

    yield {
      type: 'done',
      source,
      pack: current,
      profileFields: sections.pack_profile ? profileFields : undefined,
      failedSections: failedList.length > 0 ? failedList : undefined,
      summary,
    };
  }

  private buildAuthorBrief(prompt?: string, outline?: string): string {
    const p = (prompt ?? '').trim();
    const o = (outline ?? '').trim();
    const parts: string[] = [];
    if (p) parts.push(`【梗概或大纲摘要】\n${p}`);
    if (o) parts.push(`【导入大纲全文】\n${o}`);
    return parts.join('\n\n');
  }

  private async generateOneSection(opts: {
    brief: string;
    section: PackGenerateSectionKey;
    current: StoryPack;
  }): Promise<Record<string, unknown>> {
    const summary = this.packSummary(opts.current);
    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const content = await this.llm.complete(
          [
            {
              role: 'system',
              content: `${SYSTEM_BASE}\n\n本步任务：${SECTION_INSTRUCTIONS[opts.section]}`,
            },
            {
              role: 'user',
              content:
                attempt === 0
                  ? `${opts.brief}\n\n当前包摘要：\n${summary}\n\n请严格依据上述梗概/大纲输出本步 JSON。`
                  : `${opts.brief}\n\n当前包摘要：\n${summary}\n\n上次失败：${lastError}\n请修复并只输出本步 JSON。`,
            },
          ],
          { json: true, temperature: 0.35 },
        );
        return this.parseJsonObject(content);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    throw new Error(lastError || '模型未返回可用片段');
  }

  private applyFromFullPack(
    current: StoryPack,
    full: StoryPack,
    section: PackGenerateSectionKey,
  ): { pack: StoryPack } {
    if (section === 'pack_profile') {
      return { pack: current };
    }
    const one = Object.fromEntries(
      packGenerateSectionKeys.map((k) => [k, k === section]),
    ) as PackGenerateSections;
    return { pack: this.mergeSections(current, full, one) };
  }

  private applyFragment(
    current: StoryPack,
    section: PackGenerateSectionKey,
    fragment: Record<string, unknown>,
  ): StoryPack {
    const next = structuredClone(current) as StoryPack;

    switch (section) {
      case 'chapters': {
        if (!Array.isArray(fragment.chapters)) {
          throw new Error('缺少 chapters 数组');
        }
        next.world.chapters = fragment.chapters as StoryPack['world']['chapters'];
        if (typeof fragment.default_chapter === 'string') {
          next.world.default_chapter = fragment.default_chapter;
        } else if (next.world.chapters[0]) {
          next.world.default_chapter = next.world.chapters[0].id;
        }
        break;
      }
      case 'flags': {
        if (!Array.isArray(fragment.flags)) throw new Error('缺少 flags 数组');
        next.world.flags = fragment.flags as StoryPack['world']['flags'];
        break;
      }
      case 'numeric_tools': {
        if (!fragment.numeric_tools || typeof fragment.numeric_tools !== 'object') {
          throw new Error('缺少 numeric_tools');
        }
        next.world.numeric_tools =
          fragment.numeric_tools as StoryPack['world']['numeric_tools'];
        break;
      }
      case 'animation_rules': {
        if (!Array.isArray(fragment.animation_rules)) {
          throw new Error('缺少 animation_rules 数组');
        }
        next.world.animation_rules =
          fragment.animation_rules as StoryPack['world']['animation_rules'];
        break;
      }
      case 'endings': {
        if (!Array.isArray(fragment.endings)) {
          throw new Error('缺少 endings 数组');
        }
        next.world.endings = fragment.endings as StoryPack['world']['endings'];
        break;
      }
      case 'chapter_triggers': {
        if (!Array.isArray(fragment.rules)) throw new Error('缺少 rules 数组');
        next.triggers = {
          ...next.triggers,
          version: next.triggers.version ?? 1,
          rules: this.normalizeTriggerRules(
            fragment.rules,
          ) as StoryPack['triggers']['rules'],
        };
        break;
      }
      case 'npc_reply_flags': {
        if (!Array.isArray(fragment.npc_reply_flag_rules)) {
          throw new Error('缺少 npc_reply_flag_rules 数组');
        }
        next.triggers = {
          ...next.triggers,
          npc_reply_flag_rules: this.normalizeNpcReplyFlagRules(
            fragment.npc_reply_flag_rules,
          ) as StoryPack['triggers']['npc_reply_flag_rules'],
        };
        break;
      }
      case 'prompt_common': {
        if (typeof fragment.reply_instruction !== 'string') {
          throw new Error('缺少 reply_instruction');
        }
        next.prompts.reply_instruction = fragment.reply_instruction;
        break;
      }
      case 'affinity_tiers': {
        if (!Array.isArray(fragment.affinity_tiers)) {
          throw new Error('缺少 affinity_tiers');
        }
        next.prompts.affinity_tiers =
          fragment.affinity_tiers as StoryPack['prompts']['affinity_tiers'];
        break;
      }
      case 'fatigue_hints': {
        if (!Array.isArray(fragment.fatigue_hints)) {
          throw new Error('缺少 fatigue_hints');
        }
        next.prompts.fatigue_hints =
          fragment.fatigue_hints as StoryPack['prompts']['fatigue_hints'];
        break;
      }
      case 'chapter_constraints': {
        if (
          !fragment.chapter_constraints ||
          typeof fragment.chapter_constraints !== 'object'
        ) {
          throw new Error('缺少 chapter_constraints');
        }
        next.prompts.chapter_constraints =
          fragment.chapter_constraints as StoryPack['prompts']['chapter_constraints'];
        break;
      }
      case 'flag_constraints': {
        if (!Array.isArray(fragment.flag_constraints)) {
          throw new Error('缺少 flag_constraints');
        }
        next.prompts.flag_constraints =
          fragment.flag_constraints as StoryPack['prompts']['flag_constraints'];
        break;
      }
      case 'npcs': {
        if (!Array.isArray(fragment.npcs)) throw new Error('缺少 npcs 数组');
        next.npcs = fragment.npcs as StoryPack['npcs'];
        if (typeof fragment.default_npc === 'string') {
          next.world.default_npc = fragment.default_npc;
        } else if (next.npcs[0]) {
          next.world.default_npc = next.npcs[0].npc_id;
        }
        break;
      }
      case 'pack_profile':
        break;
    }

    return storyPackSchema.parse(next);
  }

  private packSummary(pack: StoryPack): string {
    return [
      `chapters: ${pack.world.chapters.map((c) => `${c.id}(rank${c.rank})`).join(', ') || '(无)'}`,
      `flags: ${pack.world.flags.map((f) => f.name).join(', ') || '(无)'}`,
      `default_chapter: ${pack.world.default_chapter ?? ''}`,
      `default_npc: ${pack.world.default_npc ?? ''}`,
      `npcs: ${pack.npcs.map((n) => `${n.npc_id}:${n.name || '?'}`).join(', ') || '(无)'}`,
      `trigger_rules: ${pack.triggers.rules.length}`,
    ].join('\n');
  }

  private parseJsonObject(raw: string): Record<string, unknown> {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('模型返回的不是合法 JSON');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('JSON 根节点必须是对象');
    }
    return parsed as Record<string, unknown>;
  }

  /**
   * Pack 里 flag value 一律是字符串；模型常给 boolean / number。
   */
  private coerceFlagValue(raw: unknown, fallback = 'true'): string {
    if (typeof raw === 'string' && raw.length > 0) return raw;
    if (typeof raw === 'boolean') return raw ? 'true' : 'false';
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
    return fallback;
  }

  /**
   * 模型常把 set_flags 写成字符串数组；规范成 { name, value }。
   */
  private normalizeTriggerRules(rules: unknown[]): unknown[] {
    return rules.map((rule) => {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return rule;
      const r = { ...(rule as Record<string, unknown>) };
      if (Array.isArray(r.set_flags)) {
        r.set_flags = r.set_flags.map((f) => {
          if (typeof f === 'string') {
            return { name: f, value: 'true' };
          }
          if (f && typeof f === 'object' && !Array.isArray(f)) {
            const entry = f as Record<string, unknown>;
            const name =
              typeof entry.name === 'string'
                ? entry.name
                : typeof entry.flag === 'string'
                  ? entry.flag
                  : undefined;
            if (!name) return f;
            return {
              name,
              value: this.coerceFlagValue(entry.value, 'true'),
            };
          }
          return f;
        });
      }
      return r;
    });
  }

  private normalizeNpcReplyFlagRules(rules: unknown[]): unknown[] {
    return rules.map((rule) => {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return rule;
      const r = { ...(rule as Record<string, unknown>) };
      r.value = this.coerceFlagValue(r.value, 'true');
      return r;
    });
  }

  private delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  private mergeSections(
    base: StoryPack,
    generated: StoryPack,
    sections: PackGenerateSections,
  ): StoryPack {
    const world = {
      ...base.world,
      chapters: sections.chapters
        ? generated.world.chapters
        : base.world.chapters,
      flags: sections.flags ? generated.world.flags : base.world.flags,
      numeric_tools: sections.numeric_tools
        ? generated.world.numeric_tools
        : base.world.numeric_tools,
      animation_rules: sections.animation_rules
        ? generated.world.animation_rules
        : base.world.animation_rules,
      endings: sections.endings
        ? generated.world.endings
        : base.world.endings,
      default_chapter: sections.chapters
        ? generated.world.default_chapter
        : base.world.default_chapter,
      default_npc: sections.npcs
        ? generated.world.default_npc
        : base.world.default_npc,
    };

    const triggers = {
      version: base.triggers.version ?? 1,
      rules: sections.chapter_triggers
        ? generated.triggers.rules
        : base.triggers.rules,
      npc_reply_flag_rules: sections.npc_reply_flags
        ? generated.triggers.npc_reply_flag_rules
        : base.triggers.npc_reply_flag_rules,
    };

    const prompts = {
      reply_instruction: sections.prompt_common
        ? generated.prompts.reply_instruction
        : base.prompts.reply_instruction,
      affinity_tiers: sections.affinity_tiers
        ? generated.prompts.affinity_tiers
        : base.prompts.affinity_tiers,
      fatigue_hints: sections.fatigue_hints
        ? generated.prompts.fatigue_hints
        : base.prompts.fatigue_hints,
      chapter_constraints: sections.chapter_constraints
        ? generated.prompts.chapter_constraints
        : base.prompts.chapter_constraints,
      flag_constraints: sections.flag_constraints
        ? generated.prompts.flag_constraints
        : base.prompts.flag_constraints,
    };

    const npcs = sections.npcs ? generated.npcs : base.npcs;

    return storyPackSchema.parse({
      header: base.header,
      world,
      triggers,
      prompts,
      npcs,
      version_dir: base.version_dir,
    });
  }

  private normalizeProfileFields(
    raw: unknown,
    promptFallback: string,
  ): PlayerProfileField[] {
    if (!Array.isArray(raw) || raw.length === 0) {
      return this.defaultProfileFields(promptFallback);
    }
    const out: PlayerProfileField[] = [];
    for (let i = 0; i < raw.length && out.length < 8; i++) {
      const item = raw[i];
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const label =
        typeof rec.label === 'string' && rec.label.trim()
          ? rec.label.trim().slice(0, 64)
          : `字段${i + 1}`;
      const id =
        typeof rec.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(rec.id)
          ? rec.id.slice(0, 64)
          : `field_${i + 1}`;
      const value =
        typeof rec.value === 'string' ? rec.value.slice(0, 500) : '';
      out.push({ id, label, value });
    }
    return out.length > 0 ? out : this.defaultProfileFields(promptFallback);
  }

  private defaultProfileFields(prompt: string): PlayerProfileField[] {
    return [
      { id: 'jobTitle', label: '岗位', value: '' },
      {
        id: 'notes',
        label: '个人设定',
        value: prompt ? `与故事相关：${prompt.slice(0, 120)}` : '',
      },
      { id: 'onlineName', label: '网名', value: '' },
    ];
  }

  private buildMockDraft(
    prompt: string,
    base: StoryPack,
  ): { pack: StoryPack; profileFields: PlayerProfileField[] } {
    const slug =
      prompt.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '').slice(0, 8) || 'story';
    const npcId = 'npc_hero';
    const ch0 = 'meet';
    const ch1 = 'reveal';
    const flagAsked = 'asked_secret';
    const flagReveal = 'truth_spoken';

    const pack = storyPackSchema.parse({
      header: {
        ...base.header,
        notes: `MOCK 草稿自：${prompt.slice(0, 80)}`,
      },
      version_dir: base.version_dir,
      world: {
        chapters: [
          {
            id: ch0,
            display_name: `${slug}·相遇`,
            hud_label: '相遇',
            rank: 0,
          },
          {
            id: ch1,
            display_name: `${slug}·揭晓`,
            hud_label: '揭晓',
            rank: 1,
          },
        ],
        flags: [
          {
            name: flagAsked,
            type: 'bool',
            description: '玩家问起秘密',
            irreversible: true,
          },
          {
            name: flagReveal,
            type: 'bool',
            description: '真相被说出',
            irreversible: true,
          },
        ],
        default_chapter: ch0,
        default_npc: npcId,
        numeric_tools: {
          fatigue_increase: {
            triggers: ['加班', '压力', '焦虑'],
            delta: 12,
            reason: '压力话题加重疲惫',
          },
          interest_hit: {
            affinity_delta: 8,
            affinity_reason: '共同话题',
            fatigue_delta: -10,
            fatigue_reason: '聊到兴趣放松了',
          },
        },
        animation_rules: [
          {
            id: 'talk_default',
            enabled: true,
            when: { interest_hit: true },
            animation: 'talk',
          },
        ],
        endings: [],
      },
      triggers: {
        version: 1,
        rules: [
          {
            id: 'ask_secret',
            enabled: true,
            from_chapter: ch0,
            to_chapter: null,
            min_affinity: 0,
            require_flags: [],
            player_triggers: ['秘密', '到底怎么了', '你在瞒'],
            set_flags: [{ name: flagAsked, value: 'true' }],
            notes: '问起秘密',
          },
          {
            id: 'to_reveal',
            enabled: true,
            from_chapter: ch0,
            to_chapter: ch1,
            min_affinity: 20,
            require_flags: [flagAsked],
            player_triggers: ['告诉我', '说实话', '真相'],
            set_flags: [{ name: flagReveal, value: 'true' }],
            notes: '升章揭晓',
          },
        ],
        npc_reply_flag_rules: [],
      },
      prompts: {
        reply_instruction:
          '用口语短句回复；不要一次性说完所有真相；贴合当前章节约束。',
        affinity_tiers: [
          { max_exclusive: 40, text: '关系尚浅，说话客气、保留。' },
          { max_exclusive: 999, text: '关系较近，可以流露更多情绪。' },
        ],
        fatigue_hints: [
          { min: 60, text: '你很疲惫，语气短、想结束对话。' },
        ],
        chapter_constraints: {
          [ch0]: `故事背景：${prompt}。本章只铺垫，不彻底揭穿。`,
          [ch1]: `故事背景：${prompt}。本章可以揭示核心，但仍克制。`,
        },
        flag_constraints: [
          {
            id: 'fc_asked',
            when: { flag: flagAsked, set: true },
            text: '玩家已经起疑，不要装作什么都没发生。',
          },
        ],
      },
      npcs: [
        {
          npc_id: npcId,
          name: '阿叙',
          meta: {
            avatar: '',
            model_path: '',
            scale: [1, 1, 1],
            spawn_position: [3.2, 0, -2.2],
          },
          attributes: {
            fatigue: 25,
            max_fatigue: 100,
            affinity: 25,
            current_status: 'idle',
            favorite_things: ['安静', '夜里'],
          },
          system_prompt_template: `你是剧情 NPC「阿叙」。世界设定：${prompt}。按章节约束表演，不要跳出设定。`,
          memories: [
            {
              id: 'mem_hook',
              tags: ['设定'],
              keywords: ['秘密', '真相'],
              content: `与故事相关的隐瞒：${prompt.slice(0, 120)}`,
              min_chapter: ch0,
            },
          ],
        },
      ],
    });
    assertPackReferences(pack);
    return {
      pack,
      profileFields: [
        { id: 'jobTitle', label: '岗位', value: '访客' },
        {
          id: 'notes',
          label: '个人设定',
          value: `卷入故事：${prompt.slice(0, 100)}`,
        },
        { id: 'onlineName', label: '网名', value: '旅人' },
      ],
    };
  }
}
