import { distillCardSchema, type DistillCard } from '@ocraft/shared';

/**
 * 宽松 normalize：JSON 对象 / JSON 文本 / 简易 YAML → DistillCard。
 * 缺字段补默认；非法字段丢弃并记 warning。
 */
export function normalizeDistillInput(raw: unknown): {
  card: DistillCard;
  warnings: string[];
} {
  const warnings: string[] = [];
  let obj: Record<string, unknown>;

  if (typeof raw === 'string') {
    obj = parseDistillText(raw, warnings);
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else {
    throw new Error('蒸馏卡必须是对象或 JSON/YAML 文本');
  }

  const aliased = aliasKeys(obj, warnings);
  const parsed = distillCardSchema.safeParse(aliased);
  if (!parsed.success) {
    throw new Error(`蒸馏卡不符合 Schema：${parsed.error.message}`);
  }
  return { card: parsed.data, warnings };
}

function aliasKeys(
  obj: Record<string, unknown>,
  warnings: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  const map: Record<string, string> = {
    姓名: 'name',
    名字: 'name',
    display_name: 'name',
    traits: 'core_traits',
    特质: 'core_traits',
    speech: 'speech_patterns',
    话风: 'speech_patterns',
    phrases: 'typical_phrases',
    典型句: 'typical_phrases',
    reactions: 'trigger_reactions',
    反应: 'trigger_reactions',
    forbidden: 'forbidden_behaviors',
    禁忌: 'forbidden_behaviors',
    source: 'source_note',
    溯源: 'source_note',
  };
  for (const [from, to] of Object.entries(map)) {
    if (out[to] == null && out[from] != null) {
      out[to] = out[from];
      delete out[from];
      warnings.push(`字段别名 ${from} → ${to}`);
    }
  }
  if (typeof out.trigger_reactions === 'string') {
    warnings.push('trigger_reactions 为字符串，已忽略（需 situation/reaction 对象数组）');
    out.trigger_reactions = [];
  }
  return out;
}

function parseDistillText(
  text: string,
  warnings: string[],
): Record<string, unknown> {
  const t = text.trim();
  if (!t) throw new Error('内容为空');

  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const v = JSON.parse(t) as unknown;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return v as Record<string, unknown>;
      }
      throw new Error('JSON 根节点必须是对象');
    } catch (err) {
      throw new Error(
        `JSON 解析失败：${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 简易 YAML：支持 name: x、列表 - item、以及 situation/reaction 嵌套两行
  warnings.push('按简易 YAML 解析（非完整 YAML 规范）');
  return parseSimpleYamlObject(t);
}

function parseSimpleYamlObject(text: string): Record<string, unknown> {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const root: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentList: unknown[] | null = null;
  let pendingReaction: { situation?: string; reaction?: string } | null = null;

  const flushReaction = () => {
    if (
      pendingReaction &&
      pendingReaction.situation &&
      pendingReaction.reaction &&
      currentList
    ) {
      currentList.push({
        situation: pendingReaction.situation,
        reaction: pendingReaction.reaction,
      });
    }
    pendingReaction = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '  ');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const kv = line.match(/^([A-Za-z0-9_\u4e00-\u9fff]+)\s*:\s*(.*)$/);
    if (kv && !line.startsWith(' ') && !line.startsWith('-')) {
      flushReaction();
      currentKey = kv[1]!;
      const rest = kv[2]!.trim();
      currentList = null;
      if (!rest) {
        currentList = [];
        root[currentKey] = currentList;
      } else {
        root[currentKey] = stripQuotes(rest);
        currentKey = null;
      }
      continue;
    }

    const indentItem = line.match(/^\s+-\s+(.*)$/);
    if (indentItem && currentList) {
      const item = indentItem[1]!.trim();
      const nested = item.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
      if (nested && (nested[1] === 'situation' || nested[1] === 'reaction')) {
        flushReaction();
        pendingReaction = { [nested[1]]: stripQuotes(nested[2]!) };
        continue;
      }
      if (pendingReaction) flushReaction();
      currentList.push(stripQuotes(item));
      continue;
    }

    const nestedField = line.match(/^\s+([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (nestedField && pendingReaction) {
      const k = nestedField[1]!;
      const v = stripQuotes(nestedField[2]!.trim());
      if (k === 'situation' || k === 'reaction') {
        pendingReaction[k as 'situation' | 'reaction'] = v;
      }
    }
  }
  flushReaction();
  return root;
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}
