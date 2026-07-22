import { randomUUID } from 'crypto';
import type {
  AgentTraceRecord,
  ChapterState,
  NpcRuntimeState,
  StoryFlagsSnapshot,
  StoryPack,
} from '@ocraft/shared';
import {
  evaluateChapterTransition,
  evaluateNpcReplyFlags,
} from './chapter-transition';
import { evaluateExchangeEvents } from './npc-exchange';
import { looksLikeAiSlop } from './reply-guard';
import type { EvalCase, EvalExpect, EvalSuite } from './pack-eval.schema';

export type EvalAssertionFailure = {
  field: string;
  expected: unknown;
  actual: unknown;
};

export type EvalTurnTrace = {
  turn_index: number;
  player_message: string;
  mock_npc_reply?: string;
  chapter_before: ChapterState;
  chapter_after: ChapterState;
  flags_before: StoryFlagsSnapshot;
  flags_after: StoryFlagsSnapshot;
  matched_rule_ids: string[];
  flags_set: Array<{ name: string; value: string }>;
  reply_flags_set: Array<{ name: string; value: string }>;
  exchange_event_id: string | null;
  mock_reply_slop: boolean | null;
  /** 对齐 AgentTraceRecord 的精简回放 */
  agent_trace: AgentTraceRecord;
};

export type EvalCaseResult = {
  case_id: string;
  ok: boolean;
  failures: EvalAssertionFailure[];
  turns: EvalTurnTrace[];
  final_chapter: ChapterState;
  final_flags: StoryFlagsSnapshot;
};

export type EvalSuiteResult = {
  suite_id: string;
  world_id: string;
  pack_version_id: string;
  passed: number;
  failed: number;
  results: EvalCaseResult[];
};

function applyFlags(
  flags: StoryFlagsSnapshot,
  entries: Array<{ name: string; value: string }>,
): StoryFlagsSnapshot {
  if (entries.length === 0) return flags;
  const next = { ...flags };
  for (const f of entries) {
    if (!next[f.name]) next[f.name] = f.value;
  }
  return next;
}

function assertExpect(
  expect: EvalExpect,
  opts: {
    chapter: ChapterState;
    flags: StoryFlagsSnapshot;
    last: EvalTurnTrace | undefined;
  },
): EvalAssertionFailure[] {
  const failures: EvalAssertionFailure[] = [];
  const { chapter, flags, last } = opts;

  if (expect.chapter !== undefined && expect.chapter !== chapter) {
    failures.push({
      field: 'chapter',
      expected: expect.chapter,
      actual: chapter,
    });
  }

  if (expect.flags_include) {
    for (const [name, value] of Object.entries(expect.flags_include)) {
      if (flags[name] !== value) {
        failures.push({
          field: `flags_include.${name}`,
          expected: value,
          actual: flags[name] ?? null,
        });
      }
    }
  }

  if (expect.flags_exclude) {
    for (const name of expect.flags_exclude) {
      if (flags[name]) {
        failures.push({
          field: `flags_exclude.${name}`,
          expected: null,
          actual: flags[name],
        });
      }
    }
  }

  if (expect.matched_rule_ids_include?.length) {
    const got = last?.matched_rule_ids ?? [];
    for (const id of expect.matched_rule_ids_include) {
      if (!got.includes(id)) {
        failures.push({
          field: 'matched_rule_ids_include',
          expected: id,
          actual: got,
        });
      }
    }
  }

  if (expect.exchange_event_id !== undefined) {
    const got = last?.exchange_event_id ?? null;
    if (got !== expect.exchange_event_id) {
      failures.push({
        field: 'exchange_event_id',
        expected: expect.exchange_event_id,
        actual: got,
      });
    }
  }

  if (expect.exchange_null === true) {
    const got = last?.exchange_event_id ?? null;
    if (got !== null) {
      failures.push({
        field: 'exchange_null',
        expected: null,
        actual: got,
      });
    }
  }

  if (expect.reply_flags_include) {
    const replyMap = Object.fromEntries(
      (last?.reply_flags_set ?? []).map((f) => [f.name, f.value]),
    );
    for (const [name, value] of Object.entries(expect.reply_flags_include)) {
      if (replyMap[name] !== value && flags[name] !== value) {
        failures.push({
          field: `reply_flags_include.${name}`,
          expected: value,
          actual: replyMap[name] ?? flags[name] ?? null,
        });
      }
    }
  }

  if (expect.mock_reply_is_slop === true) {
    if (last?.mock_reply_slop !== true) {
      failures.push({
        field: 'mock_reply_is_slop',
        expected: true,
        actual: last?.mock_reply_slop,
      });
    }
  }

  if (expect.mock_reply_not_slop === true) {
    if (last?.mock_reply_slop !== false) {
      failures.push({
        field: 'mock_reply_not_slop',
        expected: false,
        actual: last?.mock_reply_slop,
      });
    }
  }

  if (expect.forbidden_substrings_in_reply?.length) {
    const reply = last?.mock_npc_reply ?? '';
    for (const s of expect.forbidden_substrings_in_reply) {
      if (reply.includes(s)) {
        failures.push({
          field: 'forbidden_substrings_in_reply',
          expected: `not containing "${s}"`,
          actual: reply.slice(0, 120),
        });
      }
    }
  }

  return failures;
}

/** 跑单条用例：纯规则管线 + 可选 MOCK 回复（不启 Nest/DB/真 LLM） */
export function runEvalCase(
  pack: StoryPack,
  evalCase: EvalCase,
  opts?: { playerId?: string },
): EvalCaseResult {
  const playerId = opts?.playerId ?? 'eval';
  let chapter: ChapterState = evalCase.setup.chapter;
  let flags: StoryFlagsSnapshot = { ...evalCase.setup.flags };
  const runtime: NpcRuntimeState = {
    affinity: evalCase.setup.affinity,
    fatigue: evalCase.setup.fatigue,
    current_status: evalCase.setup.current_status,
  };

  const turns: EvalTurnTrace[] = [];

  for (let i = 0; i < evalCase.turns.length; i++) {
    const turn = evalCase.turns[i]!;
    const flagsBefore = { ...flags };
    const chapterBefore = chapter;

    const transition = evaluateChapterTransition({
      chapterState: chapter,
      playerMessage: turn.player_message,
      runtimeState: runtime,
      flags,
      triggers: pack.triggers,
    });

    chapter = transition.chapterState;
    flags = applyFlags(flags, transition.flagsToSet);

    let replyFlags: Array<{ name: string; value: string }> = [];
    let mockSlop: boolean | null = null;
    if (turn.mock_npc_reply !== undefined) {
      mockSlop = looksLikeAiSlop(turn.mock_npc_reply);
      replyFlags = evaluateNpcReplyFlags(
        chapter,
        turn.mock_npc_reply,
        flags,
        pack.triggers,
      );
      flags = applyFlags(flags, replyFlags);
    }

    const exchange = evaluateExchangeEvents(chapter, flags, pack.triggers);
    let exchangeId: string | null = null;
    if (exchange) {
      exchangeId = exchange.id;
      flags = applyFlags(flags, exchange.set_flags ?? []);
    }

    const traceId = randomUUID();
    const agentTrace: AgentTraceRecord = {
      id: traceId,
      at: new Date().toISOString(),
      player_id: playerId,
      npc_id: evalCase.setup.npc_id,
      world_id: pack.header.world_id,
      pack_version_id: pack.version_dir,
      player_message: turn.player_message,
      mock: true,
      runtime_before: { ...runtime },
      runtime_after: { ...runtime },
      tools: [],
      transition: {
        chapter_before: chapterBefore,
        chapter_after: chapter,
        flags_set: transition.flagsToSet,
        matched_rule_ids: transition.matchedRuleIds,
      },
      rag_hits: [],
      reply_flags_set: replyFlags.length ? replyFlags : undefined,
      exchange: exchange
        ? {
            event_id: exchange.id,
            lines: (exchange.fallback_lines ?? []).map((text, idx) => ({
              npc_id: exchange.speakers[idx] ?? exchange.speakers[0]!,
              name: exchange.speakers[idx] ?? exchange.speakers[0]!,
              text,
            })),
          }
        : undefined,
    };

    turns.push({
      turn_index: i,
      player_message: turn.player_message,
      mock_npc_reply: turn.mock_npc_reply,
      chapter_before: chapterBefore,
      chapter_after: chapter,
      flags_before: flagsBefore,
      flags_after: { ...flags },
      matched_rule_ids: transition.matchedRuleIds,
      flags_set: transition.flagsToSet,
      reply_flags_set: replyFlags,
      exchange_event_id: exchangeId,
      mock_reply_slop: mockSlop,
      agent_trace: agentTrace,
    });
  }

  const failures = assertExpect(evalCase.expect, {
    chapter,
    flags,
    last: turns[turns.length - 1],
  });

  return {
    case_id: evalCase.id,
    ok: failures.length === 0,
    failures,
    turns,
    final_chapter: chapter,
    final_flags: flags,
  };
}

export function runEvalSuite(
  pack: StoryPack,
  suite: EvalSuite,
): EvalSuiteResult {
  if (
    suite.world_id !== pack.header.world_id ||
    suite.pack_version_id !== pack.version_dir
  ) {
    throw new Error(
      `suite 指向 ${suite.world_id}/${suite.pack_version_id}，但加载的是 ${pack.header.world_id}/${pack.version_dir}`,
    );
  }

  const results = suite.cases.map((c) => runEvalCase(pack, c));
  const passed = results.filter((r) => r.ok).length;
  return {
    suite_id: suite.id,
    world_id: suite.world_id,
    pack_version_id: suite.pack_version_id,
    passed,
    failed: results.length - passed,
    results,
  };
}
