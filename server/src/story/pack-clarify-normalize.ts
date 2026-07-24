/**
 * 把模型常见「近似 JSON」收成 PackClarifySession 可解析形状。
 * 解决：summary 成字符串、options 成字符串数组、缺 id/topic/ask 等。
 */
export function normalizeClarifyLlmOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }
  const obj = raw as Record<string, unknown>;

  const summary = normalizeSummary(obj.summary);
  const questionsRaw = Array.isArray(obj.questions) ? obj.questions : [];
  const questions = questionsRaw
    .map((q, i) => normalizeQuestion(q, i))
    .filter(Boolean);

  return {
    summary,
    questions,
    done: Boolean(obj.done),
    source: obj.source === 'llm' || obj.source === 'mock' ? obj.source : 'llm',
  };
}

function normalizeSummary(summary: unknown): Record<string, unknown> {
  if (typeof summary === 'string') {
    return {
      world_one_liner: summary.slice(0, 200) || '待澄清的世界',
      chapters: [],
      npcs: [],
      risks: [],
    };
  }
  if (summary && typeof summary === 'object' && !Array.isArray(summary)) {
    const s = summary as Record<string, unknown>;
    return {
      world_one_liner:
        typeof s.world_one_liner === 'string'
          ? s.world_one_liner
          : typeof s.one_liner === 'string'
            ? s.one_liner
            : typeof s.summary === 'string'
              ? s.summary
              : '待澄清的世界',
      chapters: asStringArray(s.chapters),
      npcs: asStringArray(s.npcs),
      risks: asStringArray(s.risks),
    };
  }
  return {
    world_one_liner: '待澄清的世界',
    chapters: [],
    npcs: [],
    risks: [],
  };
}

function normalizeQuestion(
  q: unknown,
  index: number,
): Record<string, unknown> | null {
  if (!q || typeof q !== 'object' || Array.isArray(q)) return null;
  const row = q as Record<string, unknown>;
  const id =
    typeof row.id === 'string' && row.id.trim()
      ? row.id.trim()
      : `q${index + 1}`;
  const topic =
    typeof row.topic === 'string' && row.topic.trim()
      ? row.topic.trim()
      : typeof row.title === 'string'
        ? row.title
        : `问题 ${index + 1}`;
  const ask =
    typeof row.ask === 'string' && row.ask.trim()
      ? row.ask.trim()
      : typeof row.question === 'string'
        ? row.question
        : typeof row.prompt === 'string'
          ? row.prompt
          : typeof row.text === 'string'
            ? row.text
            : '';
  if (!ask) return null;

  const options = normalizeOptions(row.options);
  if (options.length < 2) return null;

  return {
    id: id.slice(0, 64),
    topic: topic.slice(0, 80),
    ask: ask.slice(0, 400),
    options,
    allow_free_text:
      typeof row.allow_free_text === 'boolean' ? row.allow_free_text : true,
    allow_polish:
      typeof row.allow_polish === 'boolean' ? row.allow_polish : true,
    target_hint:
      typeof row.target_hint === 'string'
        ? row.target_hint.slice(0, 200)
        : undefined,
  };
}

function normalizeOptions(options: unknown): Array<{
  key: 'A' | 'B' | 'C';
  label: string;
}> {
  const keys: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
  if (!Array.isArray(options)) {
    return [
      { key: 'A', label: '方案一' },
      { key: 'B', label: '方案二' },
      { key: 'C', label: '暂不确定，保持现状' },
    ];
  }

  const out: Array<{ key: 'A' | 'B' | 'C'; label: string }> = [];
  for (let i = 0; i < Math.min(options.length, 3); i++) {
    const key = keys[i]!;
    const item = options[i];
    if (typeof item === 'string') {
      const label = item.replace(/^[ABC][.、:：\s]+/, '').trim() || item;
      out.push({ key, label: label.slice(0, 120) });
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const k =
        o.key === 'A' || o.key === 'B' || o.key === 'C' ? o.key : key;
      const label =
        typeof o.label === 'string'
          ? o.label
          : typeof o.text === 'string'
            ? o.text
            : typeof o.value === 'string'
              ? o.value
              : `选项 ${k}`;
      out.push({ key: k, label: label.slice(0, 120) });
    }
  }

  if (!out.some((o) => o.key === 'C')) {
    if (out.length >= 3) {
      out[2] = { key: 'C', label: '暂不确定，保持现状' };
    } else {
      out.push({ key: 'C', label: '暂不确定，保持现状' });
    }
  }

  // 去重 key，按 A/B/C 排序
  const byKey = new Map(out.map((o) => [o.key, o]));
  return keys
    .map((k) => byKey.get(k))
    .filter(Boolean) as Array<{ key: 'A' | 'B' | 'C'; label: string }>;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.slice(0, 200))
    .slice(0, 12);
}
