import type {
  PackClarifyQuestion,
  PackClarifySession,
  StoryPack,
} from '@ocraft/shared';

const HEAD_CN: Record<string, string> = {
  jia: '甲',
  yi: '乙',
  bing: '丙',
  ding: '丁',
  a: 'A',
  b: 'B',
  c: 'C',
};

/** 从 Pack 建 id → 中文释义表（优先 description / display_name） */
export function buildPackIdGlossary(pack: StoryPack): Map<string, string> {
  const map = new Map<string, string>();

  for (const f of pack.world.flags) {
    map.set(
      f.name,
      (f.description?.trim() || guessIdMeaning(f.name)).slice(0, 80),
    );
  }
  for (const c of pack.world.chapters) {
    map.set(
      c.id,
      (c.display_name || c.hud_label || guessIdMeaning(c.id)).slice(0, 80),
    );
  }
  for (const n of pack.npcs) {
    map.set(n.npc_id, n.name.slice(0, 80));
  }
  for (const e of pack.world.endings ?? []) {
    // flag 同名时优先用 flag.description（更白话）
    if (map.has(e.id)) continue;
    map.set(
      e.id,
      (e.display_name || e.notes || guessIdMeaning(e.id)).slice(0, 80),
    );
  }
  for (const ev of pack.triggers.exchange_events ?? []) {
    if (ev.notes?.trim()) map.set(ev.id, ev.notes.trim().slice(0, 80));
    else map.set(ev.id, guessIdMeaning(ev.id));
  }
  return map;
}

export function guessIdMeaning(id: string): string {
  if (id.startsWith('ending_')) return '结局相关标志';
  if (id.startsWith('path_')) return '剧情路径标志';
  if (id.startsWith('ex_')) return '互聊事件';
  if (id.startsWith('ch') && /_/.test(id)) return '章节';
  if (id.startsWith('npc_')) return '角色';
  if (/_dead$/.test(id)) return '死亡相关标志';
  if (/meta/.test(id)) return '元叙事/破第四墙相关标志';
  if (/trust/.test(id)) return '信任路径相关';
  if (/dismiss/.test(id)) return '忽视/不信路径相关';
  return '剧情标志';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 把裸 id 注成 id（释义）；已有括号的不重复注 */
export function annotateIdsInText(
  text: string,
  glossary: Map<string, string>,
): string {
  if (!text) return text;
  const ids = [...glossary.keys()].sort((a, b) => b.length - a.length);
  let out = text;
  for (const id of ids) {
    const desc = glossary.get(id)!;
    const re = new RegExp(`(?<![\\w])${escapeRegExp(id)}(?!（)(?![\\w])`, 'g');
    out = out.replace(re, `${id}（${desc}）`);
  }
  return out;
}

/**
 * 选项里禁止出现的公式腔：jia=ending_jia+path_trust
 * → 甲：ending_jia（…）；path_trust（…）
 */
export function humanizeOptionLabel(
  label: string,
  glossary: Map<string, string>,
): string {
  const raw = label.trim();
  if (!raw) return raw;

  const eq = /^([A-Za-z0-9_]+)\s*=\s*(.+)$/.exec(raw);
  if (
    eq &&
    (/[+]/.test(eq[2]!) || /ending_|path_|flag_/.test(eq[2]!))
  ) {
    const head = eq[1]!.toLowerCase();
    const headCn = HEAD_CN[head] ?? eq[1]!;
    const parts = eq[2]!
      .split(/[+,，、|/]+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((id) => {
        const d = glossary.get(id) ?? guessIdMeaning(id);
        return `${id}（${d}）`;
      });
    return `${headCn}路径：${parts.join('；')}`.slice(0, 120);
  }

  // 整段几乎全是英文公式
  if (/[=+]/.test(raw) && /[a-zA-Z_]{3,}/.test(raw) && !/[\u4e00-\u9fff]/.test(raw)) {
    return annotateIdsInText(raw.replace(/=/g, '：').replace(/\+/g, '；'), glossary).slice(
      0,
      120,
    );
  }

  return annotateIdsInText(raw, glossary).slice(0, 120);
}

export function humanizeClarifyQuestion(
  q: PackClarifyQuestion,
  glossary: Map<string, string>,
): PackClarifyQuestion {
  return {
    ...q,
    topic: annotateIdsInText(q.topic, glossary).slice(0, 80),
    ask: annotateIdsInText(q.ask, glossary).slice(0, 400),
    options: q.options.map((o) => ({
      ...o,
      label: humanizeOptionLabel(o.label, glossary),
    })),
    // 不对玩家展示技术路径；保留内部字段供写回，前端勿渲染
    target_hint: q.target_hint,
  };
}

export function humanizeClarifySession(
  session: PackClarifySession,
  pack: StoryPack,
): PackClarifySession {
  const glossary = buildPackIdGlossary(pack);
  return {
    ...session,
    summary: {
      ...session.summary,
      world_one_liner: annotateIdsInText(
        session.summary.world_one_liner,
        glossary,
      ).slice(0, 200),
      chapters: session.summary.chapters.map((c) =>
        annotateIdsInText(c, glossary).slice(0, 120),
      ),
      npcs: session.summary.npcs.map((n) =>
        annotateIdsInText(n, glossary).slice(0, 120),
      ),
      risks: session.summary.risks.map((r) =>
        annotateIdsInText(r, glossary).slice(0, 200),
      ),
    },
    questions: session.questions.map((q) =>
      humanizeClarifyQuestion(q, glossary),
    ),
  };
}

/** 给模型的可读词表（减少公式腔） */
export function formatGlossaryForPrompt(pack: StoryPack): string {
  const g = buildPackIdGlossary(pack);
  const lines: string[] = [];
  for (const [id, desc] of g) {
    lines.push(`- ${id}（${desc}）`);
  }
  return lines.slice(0, 80).join('\n');
}
