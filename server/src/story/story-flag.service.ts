import { Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  BOOLEAN_FLAG_VALUE,
  type StoryFlagsSnapshot,
  type StoryFlagValue,
  isFlagSet,
} from '@ocraft/shared';
import { PlayerStateRepository } from '../db/player-state.repository';
import { storyFlags } from '../db/schema';
import { PackService } from './pack.service';

@Injectable()
export class StoryFlagService {
  private readonly logger = new Logger(StoryFlagService.name);
  /** key: PackService.sessionKey(playerId, npcId) */
  private readonly cache = new Map<string, StoryFlagsSnapshot>();

  constructor(
    private readonly playerStateRepo: PlayerStateRepository,
    private readonly packService: PackService,
  ) {}

  private key(playerId: string, npcId: string) {
    return this.packService.sessionKey(playerId, npcId);
  }

  private progressKey() {
    return this.packService.getProgressKey();
  }

  getFlags(playerId: string, npcId: string): StoryFlagsSnapshot {
    return { ...(this.cache.get(this.key(playerId, npcId)) ?? {}) };
  }

  hasFlag(playerId: string, npcId: string, name: string): boolean {
    return isFlagSet(this.getFlags(playerId, npcId), name);
  }

  async hydrate(playerId: string, npcId: string): Promise<StoryFlagsSnapshot> {
    const k = this.key(playerId, npcId);
    if (!this.playerStateRepo.ready) {
      this.cache.set(k, this.cache.get(k) ?? {});
      return this.getFlags(playerId, npcId);
    }

    const { worldId, packVersionId } = this.progressKey();
    const db = this.playerStateRepo.db;
    const rows = await db
      .select()
      .from(storyFlags)
      .where(
        and(
          eq(storyFlags.playerId, playerId),
          eq(storyFlags.worldId, worldId),
          eq(storyFlags.packVersionId, packVersionId),
          eq(storyFlags.npcId, npcId),
        ),
      );

    const snapshot: StoryFlagsSnapshot = {};
    for (const row of rows) {
      snapshot[row.flagName] = row.value;
    }
    this.cache.set(k, snapshot);
    return this.getFlags(playerId, npcId);
  }

  /**
   * 置位（只升不降）：已存在同名 flag 则不覆盖（stance 亦只写一次）。
   * @returns 是否新写入
   */
  async setFlag(
    playerId: string,
    npcId: string,
    flagName: string,
    value: StoryFlagValue = BOOLEAN_FLAG_VALUE,
  ): Promise<boolean> {
    const k = this.key(playerId, npcId);
    const current = this.cache.get(k) ?? {};
    if (isFlagSet(current, flagName)) {
      return false;
    }

    const next = { ...current, [flagName]: value };
    this.cache.set(k, next);

    if (this.playerStateRepo.ready) {
      await this.playerStateRepo.ensurePlayer(playerId);
      const { worldId, packVersionId } = this.progressKey();
      const db = this.playerStateRepo.db;
      await db
        .insert(storyFlags)
        .values({
          playerId,
          worldId,
          packVersionId,
          npcId,
          flagName,
          value,
        })
        .onConflictDoNothing();
    }

    this.logger.log(
      `Flag set player=${playerId} npc=${npcId} ${flagName}=${value}`,
    );
    return true;
  }

  async setFlags(
    playerId: string,
    npcId: string,
    entries: Array<{ name: string; value?: string }>,
  ): Promise<string[]> {
    const newly: string[] = [];
    for (const entry of entries) {
      const ok = await this.setFlag(
        playerId,
        npcId,
        entry.name,
        entry.value ?? BOOLEAN_FLAG_VALUE,
      );
      if (ok) newly.push(entry.name);
    }
    return newly;
  }

  /** 读档：用快照整表覆盖（唯一允许回退） */
  async replaceAll(
    playerId: string,
    npcId: string,
    snapshot: StoryFlagsSnapshot,
  ): Promise<void> {
    const k = this.key(playerId, npcId);
    const safe: StoryFlagsSnapshot = { ...snapshot };
    this.cache.set(k, safe);

    if (!this.playerStateRepo.ready) return;

    await this.playerStateRepo.ensurePlayer(playerId);
    const { worldId, packVersionId } = this.progressKey();
    const db = this.playerStateRepo.db;
    await db
      .delete(storyFlags)
      .where(
        and(
          eq(storyFlags.playerId, playerId),
          eq(storyFlags.worldId, worldId),
          eq(storyFlags.packVersionId, packVersionId),
          eq(storyFlags.npcId, npcId),
        ),
      );

    const rows = Object.entries(safe).map(([flagName, value]) => ({
      playerId,
      worldId,
      packVersionId,
      npcId,
      flagName,
      value,
    }));
    if (rows.length > 0) {
      await db.insert(storyFlags).values(rows);
    }

    this.logger.log(
      `Flags replaced player=${playerId} npc=${npcId} count=${rows.length}`,
    );
  }

  clearCache(playerId: string, npcId: string) {
    this.cache.delete(this.key(playerId, npcId));
  }
}
