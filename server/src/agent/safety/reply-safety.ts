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
  | 'future_chapter_constraint';

export type ReplySafetyResult = {
  ok: boolean;
  reasons: Array<{ code: SafetyReasonCode; detail: string }>;
};

export type ReplySafetyContext = {
  pack: StoryPack;
  chapterState: ChapterState;
  npcId: string;
};

/** 主回复安全扫描：薄 AI 腔 + 元叙事 + 未解锁记忆/后章约束指纹 */
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

  return { ok: reasons.length === 0, reasons };
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
