import {
  getChapterRankMap,
  getDefaultChapterId,
  isChapterAtLeast,
  type ChapterState,
  type StoryPack,
} from '@ocraft/shared';
import { looksLikeMainReplySlop, META_SPOIL_SOURCE } from './reply-guard';

export type SafetyReasonCode =
  | 'ai_slop'
  | 'meta_spoil'
  | 'locked_memory'
  | 'future_chapter_constraint'
  | 'forbidden_behavior';

export type ReplySafetyResult = {
  ok: boolean;
  reasons: Array<{ code: SafetyReasonCode; detail: string }>;
};

export type ReplySafetyContext = {
  pack: StoryPack;
  chapterState: ChapterState;
  npcId: string;
  /**
   * AP-1：自动演推进向放宽一层——忽略软性 AI 腔，以及「宣布升章/结局」类禁忌指纹；
   * 仍硬拦剧透（meta / 未解锁记忆 / 后章约束）与其它人设禁忌。
   */
  autoPlay?: boolean;
};

/** 自动演推进口吻常撞上的「勿宣布升章/结局」扩写指纹 */
const AUTOPLAY_PROGRESS_FORBIDDEN_FPS = [
  '升章',
  '进入下一章',
  '结局是',
  '本章结束',
  '触发结局',
] as const;

/** 该 reason 在自动演下可放行（空回复不放行） */
export function isAutoPlayRelaxedSafetyReason(reason: {
  code: SafetyReasonCode;
  detail: string;
}): boolean {
  if (reason.code === 'ai_slop') {
    return reason.detail !== 'empty';
  }
  if (reason.code === 'forbidden_behavior') {
    return AUTOPLAY_PROGRESS_FORBIDDEN_FPS.some((fp) =>
      reason.detail.includes(fp),
    );
  }
  return false;
}

/** 主回复安全扫描：薄 AI 腔 + 元叙事 + 未解锁记忆/后章约束 + CD-B 人设禁忌指纹 */
export function scanNpcReplySafety(
  text: string,
  ctx: ReplySafetyContext,
): ReplySafetyResult {
  const t = text.trim();
  const reasons: ReplySafetyResult['reasons'] = [];
  if (!t) {
    return { ok: false, reasons: [{ code: 'ai_slop', detail: 'empty' }] };
  }

  if (looksLikeMainReplySlop(t)) {
    reasons.push({ code: 'ai_slop', detail: 'main_reply_slop' });
  }
  if (META_SPOIL_SOURCE.test(t)) {
    reasons.push({ code: 'meta_spoil', detail: 'meta_phrase' });
  }

  const rankMap = getChapterRankMap(ctx.pack);
  const defaultChapter = getDefaultChapterId(ctx.pack);
  const npc = ctx.pack.npcs.find((n) => n.npc_id === ctx.npcId);
  const compact = t.replace(/\s+/g, '');

  if (npc) {
    for (const mem of npc.memories) {
      const minCh = mem.min_chapter ?? defaultChapter;
      if (isChapterAtLeast(ctx.chapterState, minCh, rankMap)) continue;
      const hit = fingerprintHit(compact, mem.content);
      if (hit) {
        reasons.push({
          code: 'locked_memory',
          detail: `${mem.id}:${hit}`,
        });
      }
    }
  }

  for (const ch of ctx.pack.world.chapters) {
    if (isChapterAtLeast(ctx.chapterState, ch.id, rankMap)) continue;
    const constraint = ctx.pack.prompts.chapter_constraints[ch.id];
    if (!constraint) continue;
    const hit = fingerprintHit(compact, constraint);
    if (hit) {
      reasons.push({
        code: 'future_chapter_constraint',
        detail: `${ch.id}:${hit}`,
      });
    }
  }

  // CD-B：NPC 人设禁忌 → 回复指纹
  if (npc?.forbidden_behaviors?.length) {
    for (const item of npc.forbidden_behaviors) {
      const hit = forbiddenBehaviorHit(compact, item);
      if (hit) {
        reasons.push({
          code: 'forbidden_behavior',
          detail: `${item.slice(0, 40)}:${hit}`,
        });
      }
    }
  }

  if (ctx.autoPlay) {
    const hard = reasons.filter((r) => !isAutoPlayRelaxedSafetyReason(r));
    return { ok: hard.length === 0, reasons: hard };
  }

  return { ok: reasons.length === 0, reasons };
}

/** 禁忌短句扩成可扫描指纹（含常见同义说法） */
export function expandForbiddenFingerprints(item: string): string[] {
  const raw = item.trim();
  if (!raw) return [];
  const compact = raw.replace(/\s+/g, '');
  const out = new Set<string>();
  if (compact.length >= 2) out.add(compact);

  if (/自称?\s*AI|人工智能|语言模型|助手/i.test(raw) || /自称AI/.test(compact)) {
    for (const s of [
      '作为AI',
      '我是AI',
      '人工智能',
      '语言模型',
      '作为助手',
      '我是助手',
    ]) {
      out.add(s);
    }
  }
  if (/升章|结局|跳章/.test(raw)) {
    for (const s of ['升章', '进入下一章', '结局是', '本章结束', '触发结局']) {
      out.add(s);
    }
  }
  if (/长篇|设定讲解|世界观讲解/.test(raw)) {
    for (const s of ['根据设定', '世界观是', '剧情背景如下']) {
      out.add(s);
    }
  }
  return [...out];
}

function forbiddenBehaviorHit(
  replyCompact: string,
  forbiddenItem: string,
): string | null {
  for (const fp of expandForbiddenFingerprints(forbiddenItem)) {
    if (fp.length >= 8) {
      const hit = fingerprintHit(replyCompact, fp);
      if (hit) return hit;
    } else if (fp.length >= 2 && replyCompact.includes(fp)) {
      return fp;
    }
  }
  return null;
}

/** 从源文抽 8 字指纹，命中回复则剧透 */
function fingerprintHit(replyCompact: string, source: string): string | null {
  const src = source.replace(/\s+/g, '');
  if (src.length < 8) return null;
  for (let i = 0; i <= src.length - 8; i += 3) {
    const slice = src.slice(i, i + 8);
    if (slice.length >= 8 && replyCompact.includes(slice)) {
      return slice;
    }
  }
  return null;
}

export const SAFETY_FALLBACK_REPLIES = [
  '……刚才那句当我没说。我们换个话题？',
  '嗯……我有点乱，先不说这个。',
  '抱歉，我刚才说岔了。你刚才问的是？',
];

export function pickSafetyFallback(
  rng: () => number = Math.random,
): string {
  const i = Math.floor(rng() * SAFETY_FALLBACK_REPLIES.length);
  return SAFETY_FALLBACK_REPLIES[Math.min(i, SAFETY_FALLBACK_REPLIES.length - 1)]!;
}
