import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  getChapterRankMap,
  getDefaultChapterId,
  type PackNpc,
  type StoryPack,
} from '@ocraft/shared';
import { loadOfficialPack, resolveStoryPacksRoot } from './pack-loader';

/**
 * P0：启动时加载全服官方 Pack。
 * 每玩家自选包 / DB 存档版本在后续切片接入。
 */
@Injectable()
export class PackService implements OnModuleInit {
  private readonly logger = new Logger(PackService.name);
  private pack: StoryPack | null = null;

  onModuleInit() {
    try {
      this.pack = loadOfficialPack();
      this.logger.log(
        `Loaded official pack world=${this.pack.header.world_id} version=${this.pack.version_dir} npcs=${this.pack.npcs.length} root=${resolveStoryPacksRoot()}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to load official story pack: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
  }

  getPack(): StoryPack {
    if (!this.pack) {
      throw new Error('Story pack not loaded');
    }
    return this.pack;
  }

  getDefaultChapter(): string {
    return getDefaultChapterId(this.getPack());
  }

  getChapterRankMap(): Record<string, number> {
    return getChapterRankMap(this.getPack());
  }

  getNpc(npcId: string): PackNpc {
    const npc = this.getPack().npcs.find((n) => n.npc_id === npcId);
    if (!npc) {
      throw new Error(`NPC not in current pack: ${npcId}`);
    }
    return npc;
  }

  tryGetNpc(npcId: string): PackNpc | null {
    return this.getPack().npcs.find((n) => n.npc_id === npcId) ?? null;
  }
}
