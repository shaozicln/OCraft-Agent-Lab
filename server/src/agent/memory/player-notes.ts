import { randomUUID } from 'crypto';
import {
  MAX_PLAYER_NOTES_INJECT,
  MAX_PLAYER_NOTES_PER_RUN,
  MAX_PLAYER_NOTES_PER_TURN,
  type PlayerNote,
  type PlayerNoteVisibility,
} from '@ocraft/shared';

const STOP = new Set([
  '的',
  '了',
  '吗',
  '呢',
  '吧',
  '啊',
  '呀',
  '哦',
  '嗯',
  '哈',
  '我',
  '你',
  '他',
  '她',
  '它',
  '我们',
  '你们',
  '他们',
  '这个',
  '那个',
  '什么',
  '怎么',
  '如何',
  '可以',
  '不是',
  '就是',
  '还是',
  '因为',
  '所以',
  '但是',
  '然后',
  '如果',
  '已经',
  '没有',
  '有点',
  '一下',
  '真的',
  '觉得',
  '知道',
  '告诉',
  '说话',
  '聊聊',
  '你好',
  '谢谢',
  '没事',
  '好的',
  '行吧',
]);

const GREETING =
  /^(你好|您好|嗨|哈喽|在吗|早上好|晚上好|嘿|hi|hello)[!！.。~～\s]*$/i;

/** 高信号句式：承诺 / 自称 / 保密 / 线索口吻 */
const SIGNAL_PATTERNS: Array<{ re: RegExp; label: string; conf: number }> = [
  { re: /我(叫|是)(.{1,12})/, label: '自称', conf: 0.85 },
  { re: /我承诺|我保证|我答应|一言为定/, label: '承诺', conf: 0.9 },
  { re: /别告诉|不要告诉|保密|只有你(能)?知|私下/, label: '保密', conf: 0.85 },
  { re: /其实|真相是|线索|证据|我发现|我听说/, label: '线索', conf: 0.8 },
  { re: /记住|别忘了|千万(要|别)/, label: '叮嘱', conf: 0.75 },
  { re: /我(会|要|打算|决定)/, label: '意向', conf: 0.7 },
];

const META_BAN =
  /作为\s*AI|我是\s*(一个)?(语言)?模型|系统提示|JSON\s*格式|function call/i;

export type ExtractPlayerNotesInput = {
  message: string;
  chapterId: string;
  sourceNpcId: string;
  whisper?: boolean;
  at?: string;
};

/**
 * Mem-P-A：规则抽取 0～3 条要点（无 LLM 也可跑；MOCK/评测同源）。
 */
export function extractPlayerNotes(
  input: ExtractPlayerNotesInput,
): PlayerNote[] {
  const raw = input.message.replace(/\s+/g, ' ').trim();
  if (raw.length < 2 || GREETING.test(raw) || META_BAN.test(raw)) {
    return [];
  }

  const visibility: PlayerNoteVisibility = input.whisper
    ? 'whisper'
    : 'public';
  const at = input.at ?? new Date().toISOString();
  const out: PlayerNote[] = [];

  for (const sig of SIGNAL_PATTERNS) {
    if (out.length >= MAX_PLAYER_NOTES_PER_TURN) break;
    const m = raw.match(sig.re);
    if (!m) continue;
    const snippet = (m[0] ?? '').slice(0, 80);
    const kws = uniqueKeywords([
      sig.label,
      ...tokenizeKeywords(snippet),
      ...tokenizeKeywords(raw),
    ]).slice(0, 8);
    out.push({
      id: randomUUID(),
      text: `玩家提到（${sig.label}）：${snippet}`.slice(0, 200),
      keywords: kws,
      source_npc_id: input.sourceNpcId,
      chapter_id: input.chapterId,
      visibility,
      at,
      conf: sig.conf,
    });
  }

  if (out.length === 0 && raw.length >= 8) {
    const kws = tokenizeKeywords(raw).slice(0, 6);
    if (kws.length > 0) {
      out.push({
        id: randomUUID(),
        text: `玩家说过：${raw.slice(0, 80)}`,
        keywords: kws,
        source_npc_id: input.sourceNpcId,
        chapter_id: input.chapterId,
        visibility,
        at,
        conf: 0.55,
      });
    }
  }

  return out.slice(0, MAX_PLAYER_NOTES_PER_TURN);
}

/** 合并新笔记并截断；近义 keyword 重叠过高则跳过新条 */
export function mergePlayerNotes(
  existing: PlayerNote[],
  added: PlayerNote[],
  cap = MAX_PLAYER_NOTES_PER_RUN,
): PlayerNote[] {
  const list = [...existing];
  for (const n of added) {
    if (isNearDuplicate(list, n)) continue;
    list.push(n);
  }
  if (list.length <= cap) return list;
  return list.slice(list.length - cap);
}

export type NotesForInjectOpts = {
  chatNpcId: string;
  chapterId?: string;
  limit?: number;
};

/** 按可见性过滤：whisper 仅焦点 NPC；公开对所有人 */
export function selectNotesForInject(
  notes: PlayerNote[],
  opts: NotesForInjectOpts,
): PlayerNote[] {
  const limit = opts.limit ?? MAX_PLAYER_NOTES_INJECT;
  const visible = notes.filter((n) => {
    if (n.visibility === 'public') return true;
    return n.source_npc_id === opts.chatNpcId;
  });

  const chapter = opts.chapterId;
  const ranked = [...visible].sort((a, b) => {
    const aSame = chapter && a.chapter_id === chapter ? 1 : 0;
    const bSame = chapter && b.chapter_id === chapter ? 1 : 0;
    if (aSame !== bSame) return bSame - aSame;
    return a.at.localeCompare(b.at);
  });

  return ranked.slice(-limit);
}

export function buildPlayerNotesPromptBlock(notes: PlayerNote[]): {
  ids: string[];
  block: string;
} {
  if (notes.length === 0) {
    return {
      ids: [],
      block: [
        '【本局已知的玩家要点】',
        '（暂无。要点仅作对话参照；剧情以本章 Pack 设定为准，勿把要点写成世界真相。）',
      ].join('\n'),
    };
  }
  const lines = notes.map((n, i) => {
    const kws =
      n.keywords.length > 0 ? `〔${n.keywords.slice(0, 5).join('、')}〕` : '';
    const vis = n.visibility === 'whisper' ? '（私语）' : '';
    return `${i + 1}. ${n.text}${kws}${vis}`;
  });
  return {
    ids: notes.map((n) => n.id),
    block: [
      '【本局已知的玩家要点】',
      '（出窗后仍可自然提及；勿复述本标签；与 Pack 冲突时以本章设定为准。）',
      ...lines,
    ].join('\n'),
  };
}

function tokenizeKeywords(text: string): string[] {
  const parts = text.match(/[\u4e00-\u9fff]{2,4}|[A-Za-z][A-Za-z0-9_-]{1,20}/g);
  if (!parts) return [];
  return uniqueKeywords(
    parts.filter((p) => !STOP.has(p) && !/^[的了吗呢吧啊呀]$/.test(p)),
  );
}

function uniqueKeywords(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const t = x.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function isNearDuplicate(existing: PlayerNote[], next: PlayerNote): boolean {
  const nk = new Set(next.keywords.map((k) => k.toLowerCase()));
  if (nk.size === 0) {
    return existing.some(
      (e) => e.text === next.text || e.text.includes(next.text.slice(0, 24)),
    );
  }
  for (const e of existing) {
    if (e.keywords.length === 0) continue;
    let hit = 0;
    for (const k of e.keywords) {
      if (nk.has(k.toLowerCase())) hit += 1;
    }
    const ratio = hit / Math.max(e.keywords.length, nk.size);
    if (ratio >= 0.6) return true;
  }
  return false;
}
