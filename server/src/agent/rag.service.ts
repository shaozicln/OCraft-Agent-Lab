import { Injectable } from '@nestjs/common';
import {
  type ChapterState,
  isChapterAtLeast,
  NpcMemory,
} from '@ocraft/shared';
import { NpcService } from '../npc/npc.service';
import { PackService } from '../story/pack.service';

export interface RagHit {
  memory: NpcMemory;
  score: number;
}

@Injectable()
export class RagService {
  constructor(
    private readonly npcService: NpcService,
    private readonly packService: PackService,
  ) {}

  retrieve(
    npcId: string,
    query: string,
    chapterState: ChapterState,
    topK = 2,
  ): RagHit[] {
    const def = this.npcService.getDefinition(npcId);
    const defaultChapter = this.packService.getDefaultChapter();
    const rankMap = this.packService.getChapterRankMap();
    const normalizedQuery = query.toLowerCase();

    const scored = def.memories
      .filter((memory) =>
        isChapterAtLeast(
          chapterState,
          memory.min_chapter ?? defaultChapter,
          rankMap,
        ),
      )
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
        return { memory, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }

  formatMemoriesForPrompt(hits: RagHit[]): string {
    if (hits.length === 0) {
      return '（暂无相关长期记忆）';
    }
    return hits.map((h) => `- ${h.memory.content}`).join('\n');
  }
}
