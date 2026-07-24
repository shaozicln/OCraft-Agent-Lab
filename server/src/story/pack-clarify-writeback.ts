import type { StoryPack } from '@ocraft/shared';

/**
 * PC-S：澄清写回安全解析。
 * - 只允许追加 notes，或追加叶子文案（chapter_constraints[id]）
 * - 禁止改 chapters/npcs 等结构化数组
 * - 禁止写入 system_prompt_template（避免破坏插值变量）
 */
export type ClarifyWritebackTarget =
  | { kind: 'header_notes' }
  | { kind: 'chapter_constraint'; chapterId: string };

export function resolveClarifyWriteback(
  targetHint: string | undefined,
): ClarifyWritebackTarget {
  const hint = targetHint?.trim() || 'header.notes';

  if (
    /^npcs\[[^\]]+\]\.system_prompt_template$/.test(hint) ||
    hint.includes('system_prompt_template')
  ) {
    return { kind: 'header_notes' };
  }

  const chMatch = /^prompts\.chapter_constraints\[([^\]]+)\]$/.exec(hint);
  if (chMatch?.[1]) {
    return { kind: 'chapter_constraint', chapterId: chMatch[1] };
  }

  // 未知路径一律落备注，避免乱写
  return { kind: 'header_notes' };
}

export function describeClarifyWriteback(
  targetHint: string | undefined,
): string {
  const t = resolveClarifyWriteback(targetHint);
  if (t.kind === 'chapter_constraint') {
    return `章节「${t.chapterId}」的扮演旁注`;
  }
  const raw = targetHint?.trim() || '';
  if (raw.includes('system_prompt_template')) {
    return '本包备注（人设模板禁止直写，已改写入备注）';
  }
  return '本包备注（可在编辑器「包头备注」里看到）';
}

/** 从润色/答案正文里去掉疑似模板插值，降低破坏 prompt 变量的风险 */
export function sanitizeClarifyWriteLine(line: string): string {
  return line
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function applyClarifyWriteLine(
  pack: StoryPack,
  targetHint: string | undefined,
  line: string,
): void {
  const cleaned = sanitizeClarifyWriteLine(line);
  if (!cleaned) return;

  const target = resolveClarifyWriteback(targetHint);

  if (target.kind === 'chapter_constraint') {
    const id = target.chapterId;
    if (!(id in pack.prompts.chapter_constraints)) {
      // 未知章 id：不新建约束键，退回备注
      pack.header.notes = pack.header.notes
        ? `${pack.header.notes.trim()}\n${cleaned}`
        : cleaned;
      return;
    }
    const prev = pack.prompts.chapter_constraints[id] ?? '';
    pack.prompts.chapter_constraints[id] = prev
      ? `${prev.trim()}\n${cleaned}`
      : cleaned;
    return;
  }

  pack.header.notes = pack.header.notes
    ? `${pack.header.notes.trim()}\n${cleaned}`
    : cleaned;
}
