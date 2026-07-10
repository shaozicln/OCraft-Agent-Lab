import type {
  ChapterState,
  PackPromptsFile,
  StoryFlagsSnapshot,
} from '@ocraft/shared';
import { isFlagSet } from '@ocraft/shared';

export interface SystemPromptContext {
  chapterState: ChapterState;
  affinity: number;
  fatigue: number;
  currentStatus: string;
  storyFlags?: StoryFlagsSnapshot;
  prompts: PackPromptsFile;
}

function matchesFlagConstraint(
  when: PackPromptsFile['flag_constraints'][number]['when'],
  chapterState: ChapterState,
  flags: StoryFlagsSnapshot,
): boolean {
  const flagOk = when.set
    ? isFlagSet(flags, when.flag)
    : !isFlagSet(flags, when.flag);
  if (!flagOk) return false;
  if (when.chapter !== undefined && chapterState !== when.chapter) {
    return false;
  }
  if (when.chapter_not !== undefined && chapterState === when.chapter_not) {
    return false;
  }
  return true;
}

export function buildAffinityTier(
  affinity: number,
  prompts: PackPromptsFile,
): string {
  const sorted = [...prompts.affinity_tiers].sort(
    (a, b) => a.max_exclusive - b.max_exclusive,
  );
  for (const tier of sorted) {
    if (affinity < tier.max_exclusive) return tier.text;
  }
  return sorted[sorted.length - 1]?.text ?? '';
}

export function buildFatigueHint(
  fatigue: number,
  prompts: PackPromptsFile,
): string {
  const sorted = [...prompts.fatigue_hints].sort((a, b) => b.min - a.min);
  for (const hint of sorted) {
    if (fatigue >= hint.min) return hint.text;
  }
  return sorted[sorted.length - 1]?.text ?? '';
}

export function buildChapterConstraints(
  chapterState: ChapterState,
  prompts: PackPromptsFile,
): string {
  return (
    prompts.chapter_constraints[chapterState] ??
    `当前章节：${chapterState}。（包内未配置该章约束）`
  );
}

/** 按已置 flags 追加本回合必须/禁止说（骨架约束，LLM 只表演） */
export function buildFlagConstraints(
  chapterState: ChapterState,
  flags: StoryFlagsSnapshot = {},
  prompts: PackPromptsFile,
): string {
  const lines: string[] = [];

  for (const rule of prompts.flag_constraints) {
    if (matchesFlagConstraint(rule.when, chapterState, flags)) {
      lines.push(rule.text);
    }
  }

  if (lines.length === 0) return '';
  return ['【本回合 Flag 约束】', ...lines].join('\n');
}

export function assembleSystemPrompt(
  template: string,
  ctx: SystemPromptContext,
): string {
  const base = template
    .replace('{affinity}', String(ctx.affinity))
    .replace('{fatigue}', String(ctx.fatigue))
    .replace('{chapter_state}', ctx.chapterState)
    .replace('{current_status}', ctx.currentStatus);

  const flagBlock = buildFlagConstraints(
    ctx.chapterState,
    ctx.storyFlags ?? {},
    ctx.prompts,
  );

  return [
    base,
    '',
    '【当前关系阶段】',
    buildAffinityTier(ctx.affinity, ctx.prompts),
    '',
    '【当前精神状态】',
    buildFatigueHint(ctx.fatigue, ctx.prompts),
    '',
    '【剧情章节约束（必须严格遵守）】',
    buildChapterConstraints(ctx.chapterState, ctx.prompts),
    flagBlock ? `\n${flagBlock}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
