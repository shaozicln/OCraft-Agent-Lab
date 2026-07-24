import {
  isChapterAtLeast,
  type ChapterState,
  type NpcMemory,
} from '@ocraft/shared';
import {
  cosineSimilarity,
  localEmbed,
  memoryEmbedText,
} from './local-embedding';

export type RagHitSource = 'vector' | 'keyword';
export type RagPath = 'vector' | 'keyword_fallback';

export interface RagHit {
  memory: NpcMemory;
  score: number;
  source: RagHitSource;
}

export interface RagRetrieveResult {
  hits: RagHit[];
  path: RagPath;
  /** api | local；向量路径用到的后端 */
  embed_backend?: 'api' | 'local';
  error?: string;
}

export function filterUnlockedMemories(
  memories: NpcMemory[],
  chapterState: ChapterState,
  defaultChapter: string,
  rankMap: Record<string, number>,
): NpcMemory[] {
  return memories.filter((memory) =>
    isChapterAtLeast(
      chapterState,
      memory.min_chapter ?? defaultChapter,
      rankMap,
    ),
  );
}

export function retrieveByKeyword(
  unlocked: NpcMemory[],
  query: string,
  topK: number,
): RagHit[] {
  const normalizedQuery = query.toLowerCase();
  return unlocked
    .map((memory) => {
      let score = 0;
      for (const keyword of memory.keywords) {
        if (normalizedQuery.includes(keyword.toLowerCase())) {
          score += 2;
        }
      }
      for (const tag of memory.tags) {
        if (normalizedQuery.includes(tag.toLowerCase())) {
          score += 0.5;
        }
      }
      return { memory, score, source: 'keyword' as const };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function retrieveByVector(
  unlocked: NpcMemory[],
  queryVec: number[],
  memoryVecs: Map<string, number[]>,
  topK: number,
  minScore: number,
): RagHit[] {
  const scored: RagHit[] = [];
  for (const memory of unlocked) {
    const mv = memoryVecs.get(memory.id);
    if (!mv || mv.length !== queryVec.length) continue;
    const score = cosineSimilarity(queryVec, mv);
    if (score >= minScore) {
      scored.push({ memory, score, source: 'vector' });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

/** 无 API 时用本地袋向量给记忆建索引 */
export function buildLocalMemoryVectors(
  memories: NpcMemory[],
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const m of memories) {
    map.set(m.id, localEmbed(memoryEmbedText(m)));
  }
  return map;
}
