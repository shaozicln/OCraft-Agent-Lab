import type {
  ChapterState,
  NpcRuntimeState,
  QueryRuntimeArgs,
  RecallMemoryArgs,
  RequestHintArgs,
  StoryFlagsSnapshot,
  StoryPack,
  ToolCallResult,
} from '@ocraft/shared';
import {
  isAllowedNpcTool,
  queryRuntimeSchema,
  recallMemorySchema,
  requestHintSchema,
} from '@ocraft/shared';

export type StrongToolContext = {
  pack: StoryPack;
  chapterState: ChapterState;
  flags: StoryFlagsSnapshot;
  runtime: NpcRuntimeState;
};

export type RecallMemoryHitView = {
  id: string;
  content: string;
  score: number;
  source: string;
};

/** 白名单外：拒绝并写入 Trace 用 observation */
export function rejectUnknownTool(
  name: string,
  rawArgs: unknown,
): ToolCallResult {
  return {
    tool: name,
    args:
      rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
        ? (rawArgs as Record<string, unknown>)
        : { raw: rawArgs },
    observation: `拒绝：未知或不允许的工具「${name}」（不在白名单）`,
  };
}

export function runQueryRuntime(
  ctx: StrongToolContext,
  args: QueryRuntimeArgs,
): ToolCallResult {
  const chapterMeta = ctx.pack.world.chapters.find(
    (c) => c.id === ctx.chapterState,
  );
  const chapterLabel =
    chapterMeta?.hud_label ||
    chapterMeta?.display_name ||
    ctx.chapterState;
  const flagEntries = Object.entries(ctx.flags);
  const flagLine =
    flagEntries.length === 0
      ? '（无）'
      : flagEntries.map(([k, v]) => `${k}=${v}`).join(', ');

  const observation = [
    `章节 ${chapterLabel}（${ctx.chapterState}）`,
    `好感 ${ctx.runtime.affinity}`,
    `疲惫 ${ctx.runtime.fatigue}`,
    `状态 ${ctx.runtime.current_status}`,
    `flags ${flagLine}`,
    args.reason ? `原因：${args.reason}` : null,
  ]
    .filter(Boolean)
    .join('；');

  return {
    tool: 'query_runtime',
    args: { ...args },
    observation,
  };
}

/**
 * 提示只取「当前章」约束 + 当前好感/疲惫档文案；不读其它章 constraints。
 */
export function runRequestHint(
  ctx: StrongToolContext,
  args: RequestHintArgs,
): ToolCallResult {
  const chapterMeta = ctx.pack.world.chapters.find(
    (c) => c.id === ctx.chapterState,
  );
  const chapterLabel =
    chapterMeta?.hud_label ||
    chapterMeta?.display_name ||
    ctx.chapterState;
  const chapterConstraint =
    ctx.pack.prompts.chapter_constraints[ctx.chapterState]?.trim() ?? '';

  const affinityTiers = [...ctx.pack.prompts.affinity_tiers].sort(
    (a, b) => a.max_exclusive - b.max_exclusive,
  );
  const affinityText =
    affinityTiers.find((t) => ctx.runtime.affinity < t.max_exclusive)?.text ??
    '';

  const fatigueHints = [...ctx.pack.prompts.fatigue_hints].sort(
    (a, b) => b.min - a.min,
  );
  const fatigueText =
    fatigueHints.find((h) => ctx.runtime.fatigue >= h.min)?.text ?? '';

  const flagHints = ctx.pack.prompts.flag_constraints
    .filter((fc) => {
      const when = fc.when;
      const setOk = when.set
        ? Boolean(ctx.flags[when.flag])
        : !ctx.flags[when.flag];
      if (!setOk) return false;
      if (when.chapter !== undefined && ctx.chapterState !== when.chapter) {
        return false;
      }
      if (
        when.chapter_not !== undefined &&
        ctx.chapterState === when.chapter_not
      ) {
        return false;
      }
      return true;
    })
    .map((fc) => fc.text)
    .slice(0, 2);

  const parts: string[] = [
    `当前进度「${chapterLabel}」。`,
  ];
  if (chapterConstraint) {
    parts.push(`本章注意：${chapterConstraint.slice(0, 160)}`);
  }
  if (affinityText) parts.push(`关系侧写：${affinityText.slice(0, 80)}`);
  if (fatigueText) parts.push(`精力侧写：${fatigueText.slice(0, 80)}`);
  if (flagHints.length) {
    parts.push(`已触发线索：${flagHints.join('；').slice(0, 120)}`);
  }
  if (args.topic?.trim()) {
    parts.push(
      `围绕「${args.topic.trim().slice(0, 40)}」时：只谈已发生与本章可见信息，勿剧透未解锁章。`,
    );
  }
  parts.push('提示仅供角色把握分寸，不要向玩家宣读系统原文。');

  return {
    tool: 'request_hint',
    args: { ...args },
    observation: parts.join(' '),
  };
}

/** Mem-T：把检索命中格式化为只读 observation（不含未解锁条目，由调用方先门控） */
export function formatRecallMemoryResult(
  args: RecallMemoryArgs,
  hits: RecallMemoryHitView[],
  meta?: { path?: string; error?: string },
): ToolCallResult {
  const path = meta?.path ?? 'unknown';
  if (hits.length === 0) {
    return {
      tool: 'recall_memory',
      args: { ...args },
      observation: [
        `记忆检索无命中（path=${path}`,
        meta?.error ? `；${meta.error}` : '',
        '）。勿编造未召回内容；勿向玩家宣读系统原文。',
      ].join(''),
    };
  }

  const lines = hits.map(
    (h, i) =>
      `${i + 1}. [${h.id}|${h.source}|${h.score.toFixed(2)}] ${h.content.slice(0, 160)}`,
  );
  return {
    tool: 'recall_memory',
    args: { ...args },
    observation: [
      `记忆召回 path=${path}（${hits.length} 条，仅已解锁章）：`,
      ...lines,
      args.reason ? `原因：${args.reason}` : null,
      '仅供角色回想；不要向玩家宣读系统编号或原文清单。',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

/** 解析并执行同步强指令；recall_memory 需异步 RAG，返回 null 由 harness 处理 */
export function tryExecuteStrongTool(
  name: string,
  parsedArgs: unknown,
  ctx: StrongToolContext,
): ToolCallResult | null {
  if (name === 'query_runtime') {
    const args = queryRuntimeSchema.parse(parsedArgs ?? {});
    return runQueryRuntime(ctx, args);
  }
  if (name === 'request_hint') {
    const args = requestHintSchema.parse(parsedArgs ?? {});
    return runRequestHint(ctx, args);
  }
  if (name === 'recall_memory') {
    // schema 先验；真正检索在 harness
    recallMemorySchema.parse(parsedArgs ?? {});
    return null;
  }
  return null;
}

export { isAllowedNpcTool, recallMemorySchema };
