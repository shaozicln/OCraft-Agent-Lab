import { Injectable, Logger } from '@nestjs/common';
import type { ChapterState, NpcMemory } from '@ocraft/shared';
import { NpcService } from '../../npc/npc.service';
import { PackService } from '../../story/pack.service';
import { LlmService } from '../core/llm.service';
import {
  localEmbed,
  memoryEmbedText,
} from './local-embedding';
import {
  buildLocalMemoryVectors,
  filterUnlockedMemories,
  retrieveByKeyword,
  retrieveByVector,
  type RagHit,
  type RagRetrieveResult,
} from './rag-retrieve';

export type { RagHit, RagRetrieveResult };

const DEFAULT_TOP_K = 2;
/** 本地袋向量阈值偏低；API 嵌入略高 */
const MIN_SCORE_LOCAL = 0.08;
const MIN_SCORE_API = 0.22;

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  /** `${packKey}::${npcId}::${backend}` → memoryId → vec */
  private readonly vecCache = new Map<string, Map<string, number[]>>();

  constructor(
    private readonly npcService: NpcService,
    private readonly packService: PackService,
    private readonly llmService: LlmService,
  ) {}

  /**
   * Mem-V：先向量（API 或本地）→ 无命中/失败则关键词回退。始终先做 min_chapter 门控。
   */
  async retrieve(
    npcId: string,
    query: string,
    chapterState: ChapterState,
    topK = DEFAULT_TOP_K,
    opts?: { vectorMinScore?: number; forceKeyword?: boolean },
  ): Promise<RagRetrieveResult> {
    const def = this.npcService.getDefinition(npcId);
    const defaultChapter = this.packService.getDefaultChapter();
    const rankMap = this.packService.getChapterRankMap();
    const unlocked = filterUnlockedMemories(
      def.memories,
      chapterState,
      defaultChapter,
      rankMap,
    );

    if (opts?.forceKeyword) {
      return {
        hits: retrieveByKeyword(unlocked, query, topK),
        path: 'keyword_fallback',
        error: 'force_keyword',
      };
    }

    try {
      const { queryVec, memoryVecs, backend } = await this.resolveVectors(
        npcId,
        unlocked,
        query,
      );
      const minScore =
        opts?.vectorMinScore ??
        (backend === 'api' ? MIN_SCORE_API : MIN_SCORE_LOCAL);
      const hits = retrieveByVector(
        unlocked,
        queryVec,
        memoryVecs,
        topK,
        minScore,
      );
      if (hits.length > 0) {
        return { hits, path: 'vector', embed_backend: backend };
      }
      const kw = retrieveByKeyword(unlocked, query, topK);
      return {
        hits: kw,
        path: 'keyword_fallback',
        embed_backend: backend,
        error: 'vector_empty',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`rag vector failed → keyword: ${msg}`);
      return {
        hits: retrieveByKeyword(unlocked, query, topK),
        path: 'keyword_fallback',
        error: msg.slice(0, 120),
      };
    }
  }

  /** 同步关键词路径（Eval / 对比用） */
  retrieveKeywordOnly(
    npcId: string,
    query: string,
    chapterState: ChapterState,
    topK = DEFAULT_TOP_K,
  ): RagHit[] {
    const def = this.npcService.getDefinition(npcId);
    const unlocked = filterUnlockedMemories(
      def.memories,
      chapterState,
      this.packService.getDefaultChapter(),
      this.packService.getChapterRankMap(),
    );
    return retrieveByKeyword(unlocked, query, topK);
  }

  formatMemoriesForPrompt(hits: RagHit[]): string {
    if (hits.length === 0) {
      return '（暂无相关长期记忆）';
    }
    return hits.map((h) => `- ${h.memory.content}`).join('\n');
  }

  private packKey(): string {
    const pack = this.packService.getPack();
    return `${pack.header.world_id}::${pack.version_dir}`;
  }

  private cacheKey(npcId: string, backend: 'api' | 'local'): string {
    return `${this.packKey()}::${npcId}::${backend}`;
  }

  private async resolveVectors(
    npcId: string,
    unlocked: NpcMemory[],
    query: string,
  ): Promise<{
    queryVec: number[];
    memoryVecs: Map<string, number[]>;
    backend: 'api' | 'local';
  }> {
    const apiVecs = await this.tryApiVectors(npcId, unlocked, query);
    if (apiVecs) return { ...apiVecs, backend: 'api' };

    const ck = this.cacheKey(npcId, 'local');
    let memoryVecs = this.vecCache.get(ck);
    if (!memoryVecs) {
      memoryVecs = buildLocalMemoryVectors(
        this.npcService.getDefinition(npcId).memories,
      );
      this.vecCache.set(ck, memoryVecs);
    }
    return {
      queryVec: localEmbed(query),
      memoryVecs,
      backend: 'local',
    };
  }

  private async tryApiVectors(
    npcId: string,
    unlocked: NpcMemory[],
    query: string,
  ): Promise<{
    queryVec: number[];
    memoryVecs: Map<string, number[]>;
  } | null> {
    if (this.llmService.isMockMode()) return null;

    const ck = this.cacheKey(npcId, 'api');
    let memoryVecs = this.vecCache.get(ck);
    if (!memoryVecs) {
      const all = this.npcService.getDefinition(npcId).memories;
      const texts = all.map((m) => memoryEmbedText(m));
      const embedded = await this.llmService.embed(texts);
      if (!embedded || embedded.length !== all.length) return null;
      memoryVecs = new Map();
      for (let i = 0; i < all.length; i++) {
        memoryVecs.set(all[i]!.id, embedded[i]!);
      }
      this.vecCache.set(ck, memoryVecs);
    }

    const q = await this.llmService.embed([query]);
    if (!q?.[0]) return null;
    // 只对 unlocked 检索；缺向量的跳过
    const filtered = new Map<string, number[]>();
    for (const m of unlocked) {
      const v = memoryVecs.get(m.id);
      if (v) filtered.set(m.id, v);
    }
    return { queryVec: q[0], memoryVecs: filtered };
  }
}
