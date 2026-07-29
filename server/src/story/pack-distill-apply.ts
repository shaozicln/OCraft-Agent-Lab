import {
  distillCardSchema,
  type DistillCard,
  type PackMemory,
  type PackNpc,
  type StoryPack,
} from '@ocraft/shared';

const MUSTACHE_RE = /\{\{[^{}]+\}\}/g;
const DISTILL_BLOCK_START = '【人设·蒸馏】';
const DISTILL_BLOCK_END = '【/人设·蒸馏】';
const STYLE_BLOCK_PREFIX = '【蒸馏话风·';

/** 抽出模板中的 {{…}} 插值，apply 后必须仍在 system_prompt_template 里。 */
export function extractMustacheTokens(template: string): string[] {
  return template.match(MUSTACHE_RE) ?? [];
}

/** 校验：旧模板里的插值是否都还在新模板中。 */
export function preservesMustache(
  before: string,
  after: string,
): { ok: boolean; missing: string[] } {
  const beforeTokens = [...new Set(extractMustacheTokens(before))];
  const missing = beforeTokens.filter((t) => !after.includes(t));
  return { ok: missing.length === 0, missing };
}

/** 把蒸馏卡编成可写入 system_prompt_template 的人设段（中文）。 */
export function buildPersonaBlock(card: DistillCard): string {
  const lines: string[] = [];
  lines.push(`你是${card.name}。`);
  if (card.core_traits.length) {
    lines.push(`核心特质：${card.core_traits.join('、')}。`);
  }
  if (card.speech_patterns.length) {
    lines.push(`话风：${card.speech_patterns.join('；')}。`);
  }
  if (card.trigger_reactions.length) {
    lines.push('情境反应：');
    for (const r of card.trigger_reactions) {
      lines.push(`- 当「${r.situation}」→ ${r.reaction}`);
    }
  }
  if (card.forbidden_behaviors.length) {
    lines.push(`严禁：${card.forbidden_behaviors.join('；')}。`);
  }
  if (card.source_note?.trim()) {
    lines.push(`（溯源：${card.source_note.trim()}）`);
  }
  return `${DISTILL_BLOCK_START}\n${lines.join('\n')}\n${DISTILL_BLOCK_END}`;
}

/**
 * 合并人设段：替换旧蒸馏块；保留块外原文与全部 {{…}}。
 * 空模板则直接用人设段。
 */
export function mergePersonaIntoTemplate(
  existing: string,
  card: DistillCard,
): string {
  const block = buildPersonaBlock(card);
  const trimmed = existing.trim();
  if (!trimmed) return block;

  const re = new RegExp(
    `${escapeRegExp(DISTILL_BLOCK_START)}[\\s\\S]*?${escapeRegExp(DISTILL_BLOCK_END)}`,
    'g',
  );
  if (re.test(existing)) {
    return existing.replace(re, block);
  }
  return `${block}\n\n${existing}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * CD-B：正面话风写入 pack.prompts.reply_instruction（按 npc_id 可替换块）。
 * 无 speech_patterns 时移除该 NPC 旧块。
 */
export function mergeDistillStyleIntoReplyInstruction(
  existing: string,
  npcId: string,
  card: DistillCard,
): { text: string; changed: boolean } {
  const start = `${STYLE_BLOCK_PREFIX}${npcId}】`;
  const end = `【/蒸馏话风·${npcId}】`;
  const re = new RegExp(
    `${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`,
    'g',
  );
  const stripped = existing.replace(re, '').trimEnd();

  if (!card.speech_patterns.length) {
    const changed = stripped !== existing.trimEnd();
    return { text: stripped, changed };
  }

  const styleLine = [
    `${card.name}（${npcId}）正面话风：${card.speech_patterns.join('；')}。`,
    '仅在扮演该角色时参考；勿宣布升章/结局。',
  ].join('');
  const block = `${start}\n${styleLine}\n${end}`;
  const text = stripped ? `${stripped}\n\n${block}` : block;
  return { text, changed: text !== existing };
}

/** 典型句 → memories；默认挂开场章。 */
export function typicalPhrasesToMemories(
  card: DistillCard,
  minChapter: string | undefined,
): PackMemory[] {
  return card.typical_phrases.map((content, i) => ({
    id: `mem_distill_${slugId(card.npc_id || card.name)}_${i + 1}`,
    tags: ['distill', 'typical_phrase'],
    keywords: content
      .slice(0, 24)
      .split(/[\s，。；、]+/)
      .filter(Boolean)
      .slice(0, 4),
    content,
    min_chapter: minChapter,
  }));
}

export function slugId(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || 'npc';
}

export function suggestNpcId(card: DistillCard, used: Set<string>): string {
  const base = card.npc_id?.trim() || `npc_${slugId(card.name)}`;
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

function blankNpcShell(npcId: string, name: string): PackNpc {
  return {
    npc_id: npcId,
    name,
    meta: {
      avatar: '',
      model_path: '',
      scale: [1, 1, 1],
      spawn_position: [0, 0, 0],
    },
    attributes: {
      fatigue: 0,
      max_fatigue: 100,
      affinity: 0,
      current_status: 'idle',
      favorite_things: [],
    },
    system_prompt_template: '',
    memories: [],
    forbidden_behaviors: [],
    appear_require_flags: [],
  };
}

export type ApplyDistillOpts = {
  mode: 'create' | 'update';
  target_npc_id?: string;
  /** create 时 id 冲突：覆盖已有 NPC */
  overwrite?: boolean;
};

export type ApplyDistillResult = {
  pack: StoryPack;
  patch_notes: string[];
  applied_npc_id: string;
};

/**
 * 将已确认的蒸馏卡写入 Pack.npcs[]（纯函数）。
 * 不写硬 triggers；不剥 {{…}}。
 */
export function applyDistillCardToPack(
  pack: StoryPack,
  rawCard: DistillCard,
  opts: ApplyDistillOpts,
): ApplyDistillResult {
  const card = distillCardSchema.parse(rawCard);
  const openingChapter = pack.world.chapters
    .slice()
    .sort((a, b) => a.rank - b.rank)[0]?.id;

  const used = new Set(pack.npcs.map((n) => n.npc_id));
  const notes: string[] = [];

  if (opts.mode === 'update') {
    const targetId = opts.target_npc_id?.trim();
    if (!targetId) {
      throw new Error('update 模式需要 target_npc_id');
    }
    const idx = pack.npcs.findIndex((n) => n.npc_id === targetId);
    if (idx < 0) {
      throw new Error(`找不到 NPC：${targetId}`);
    }
    const prev = pack.npcs[idx]!;
    const nextTemplate = mergePersonaIntoTemplate(
      prev.system_prompt_template,
      card,
    );
    const preserve = preservesMustache(prev.system_prompt_template, nextTemplate);
    if (!preserve.ok) {
      throw new Error(`apply 会丢失插值：${preserve.missing.join(', ')}`);
    }

    const phraseMems = typicalPhrasesToMemories(card, openingChapter);
    // 去掉旧 distill 典型句，再追加新的
    const withoutOldDistill = prev.memories.filter(
      (m) =>
        !(
          Array.isArray(m.tags) &&
          m.tags.includes('distill') &&
          m.tags.includes('typical_phrase')
        ),
    );

    const nextNpc: PackNpc = {
      ...prev,
      name: card.name || prev.name,
      system_prompt_template: nextTemplate,
      memories: [...withoutOldDistill, ...phraseMems],
      forbidden_behaviors: [...card.forbidden_behaviors],
    };

    const npcs = [...pack.npcs];
    npcs[idx] = nextNpc;
    notes.push(`更新 NPC ${targetId}（${card.name}）人设蒸馏块 + ${phraseMems.length} 条典型句记忆`);
    if (card.forbidden_behaviors.length) {
      notes.push(`CD-B：写入 ${card.forbidden_behaviors.length} 条 forbidden→safety`);
    }

    let nextPack: StoryPack = { ...pack, npcs };
    const style = mergeDistillStyleIntoReplyInstruction(
      pack.prompts.reply_instruction,
      targetId,
      card,
    );
    if (style.changed) {
      nextPack = {
        ...nextPack,
        prompts: {
          ...nextPack.prompts,
          reply_instruction: style.text,
        },
      };
      notes.push(
        card.speech_patterns.length
          ? 'CD-B：reply_instruction 写入正面话风'
          : 'CD-B：清除旧蒸馏话风块',
      );
    }

    return {
      pack: nextPack,
      patch_notes: notes,
      applied_npc_id: targetId,
    };
  }
  // create
  let npcId = card.npc_id?.trim() || suggestNpcId(card, used);
  if (used.has(npcId)) {
    if (opts.overwrite) {
      return applyDistillCardToPack(pack, { ...card, npc_id: npcId }, {
        mode: 'update',
        target_npc_id: npcId,
      });
    }
    throw new Error(
      `npc_id「${npcId}」已存在。请换 id，或设 overwrite=true 覆盖。`,
    );
  }

  const shell = blankNpcShell(npcId, card.name);
  const template = mergePersonaIntoTemplate('', card);
  const phraseMems = typicalPhrasesToMemories(card, openingChapter);
  const nextNpc: PackNpc = {
    ...shell,
    system_prompt_template: template,
    memories: phraseMems,
    forbidden_behaviors: [...card.forbidden_behaviors],
  };

  notes.push(
    `新建 NPC ${npcId}（${card.name}）；典型句记忆 ${phraseMems.length} 条`,
  );
  if (card.forbidden_behaviors.length) {
    notes.push(`CD-B：写入 ${card.forbidden_behaviors.length} 条 forbidden→safety`);
  }

  let nextPack: StoryPack = {
    ...pack,
    npcs: [...pack.npcs, nextNpc],
  };

  const style = mergeDistillStyleIntoReplyInstruction(
    pack.prompts.reply_instruction,
    npcId,
    card,
  );
  if (style.changed) {
    nextPack = {
      ...nextPack,
      prompts: {
        ...nextPack.prompts,
        reply_instruction: style.text,
      },
    };
    notes.push('CD-B：reply_instruction 写入正面话风');
  }

  if (card.source_note?.trim()) {
    const stamp = `[蒸馏] ${card.name}/${npcId}：${card.source_note.trim()}`;
    const prevNotes = pack.header.notes?.trim() ?? '';
    nextPack = {
      ...nextPack,
      header: {
        ...nextPack.header,
        notes: prevNotes ? `${prevNotes}\n${stamp}` : stamp,
      },
    };
    notes.push('header.notes 追加溯源');
  }

  return {
    pack: nextPack,
    patch_notes: notes,
    applied_npc_id: npcId,
  };
}
