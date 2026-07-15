import { Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  BOOLEAN_FLAG_VALUE,
  isFlagSet,
  type ChapterState,
  type StoryFlagsSnapshot,
  type StoryFlagValue,
} from '@ocraft/shared';
import type { AppDatabase } from '../db/db.service';
import { PlayerStateRepository } from '../db/player-state.repository';
import { worldFlags, worldProgress } from '../db/schema';
import { PackService } from './pack.service';

/**
 * L2 共享世界进度：章 + flags（与 default_npc / 分人 story_flags 解耦）
 */
@Injectable()
export class WorldProgressService {
  private readonly logger = new Logger(WorldProgressService.name);
  /** key: playerId:worldId:packVersionId */
  private readonly chapterCache = new Map<string, ChapterState>();
  private readonly flagsCache = new Map<string, StoryFlagsSnapshot>();
  private readonly hydrated = new Set<string>();
  /** 章/世界 flags 变更后待自动存 */
  private readonly dirty = new Set<string>();

  constructor(
    private readonly playerStateRepo: PlayerStateRepository,
    private readonly packService: PackService,
  ) {}

  private packKey(playerId: string) {
    const { worldId, packVersionId } = this.packService.getProgressKey();
    return `${playerId}:${worldId}:${packVersionId}`;
  }

  private db(tx?: AppDatabase) {
    return tx ?? this.playerStateRepo.db;
  }

  markDirty(playerId: string) {
    this.dirty.add(this.packKey(playerId));
  }

  /** 若脏则清掉并返回 true（供自动存消费） */
  consumeDirty(playerId: string): boolean {
    const k = this.packKey(playerId);
    if (!this.dirty.has(k)) return false;
    this.dirty.delete(k);
    return true;
  }

  isDirty(playerId: string): boolean {
    return this.dirty.has(this.packKey(playerId));
  }

  private defaultChapter(): ChapterState {
    return this.packService.getDefaultChapter();
  }

  private resolveValidChapter(raw: ChapterState): ChapterState {
    const pack = this.packService.getPack();
    const known = new Set(pack.world.chapters.map((c) => c.id));
    if (known.has(raw)) return raw;
    return this.defaultChapter();
  }

  async ensureHydrated(playerId: string): Promise<void> {
    const k = this.packKey(playerId);
    if (this.hydrated.has(k)) return;

    if (!this.playerStateRepo.ready) {
      this.chapterCache.set(k, this.defaultChapter());
      this.flagsCache.set(k, {});
      this.hydrated.add(k);
      return;
    }

    await this.playerStateRepo.ensurePlayer(playerId);
    const { worldId, packVersionId } = this.packService.getProgressKey();
    const db = this.playerStateRepo.db;

    const chapterRows = await db
      .select()
      .from(worldProgress)
      .where(
        and(
          eq(worldProgress.playerId, playerId),
          eq(worldProgress.worldId, worldId),
          eq(worldProgress.packVersionId, packVersionId),
        ),
      )
      .limit(1);

    let chapter = chapterRows[0]?.chapterState;
    if (!chapter) {
      chapter = this.defaultChapter();
      await db
        .insert(worldProgress)
        .values({
          playerId,
          worldId,
          packVersionId,
          chapterState: chapter,
        })
        .onConflictDoNothing();
    }
    this.chapterCache.set(k, this.resolveValidChapter(chapter));

    const flagRows = await db
      .select()
      .from(worldFlags)
      .where(
        and(
          eq(worldFlags.playerId, playerId),
          eq(worldFlags.worldId, worldId),
          eq(worldFlags.packVersionId, packVersionId),
        ),
      );
    const flags: StoryFlagsSnapshot = {};
    for (const row of flagRows) {
      flags[row.flagName] = row.value;
    }
    this.flagsCache.set(k, flags);
    this.hydrated.add(k);
  }

  getChapter(playerId: string): ChapterState {
    const k = this.packKey(playerId);
    const raw = this.chapterCache.get(k) ?? this.defaultChapter();
    return this.resolveValidChapter(raw);
  }

  getFlags(playerId: string): StoryFlagsSnapshot {
    const k = this.packKey(playerId);
    return { ...(this.flagsCache.get(k) ?? {}) };
  }

  async setChapter(playerId: string, state: ChapterState): Promise<ChapterState> {
    await this.ensureHydrated(playerId);
    const valid = this.resolveValidChapter(state);
    const k = this.packKey(playerId);
    const prev = this.getChapter(playerId);
    this.chapterCache.set(k, valid);

    if (this.playerStateRepo.ready) {
      const { worldId, packVersionId } = this.packService.getProgressKey();
      await this.db()
        .insert(worldProgress)
        .values({
          playerId,
          worldId,
          packVersionId,
          chapterState: valid,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            worldProgress.playerId,
            worldProgress.worldId,
            worldProgress.packVersionId,
          ],
          set: { chapterState: valid, updatedAt: new Date() },
        });
    }

    if (prev !== valid) {
      this.markDirty(playerId);
      this.logger.log(
        `World chapter player=${playerId} ${prev} → ${valid}`,
      );
    }
    return valid;
  }

  async setFlag(
    playerId: string,
    flagName: string,
    value: StoryFlagValue = BOOLEAN_FLAG_VALUE,
  ): Promise<boolean> {
    await this.ensureHydrated(playerId);
    const k = this.packKey(playerId);
    const current = this.flagsCache.get(k) ?? {};
    if (isFlagSet(current, flagName)) return false;

    const next = { ...current, [flagName]: value };
    this.flagsCache.set(k, next);

    if (this.playerStateRepo.ready) {
      const { worldId, packVersionId } = this.packService.getProgressKey();
      await this.db()
        .insert(worldFlags)
        .values({
          playerId,
          worldId,
          packVersionId,
          flagName,
          value,
        })
        .onConflictDoNothing();
    }

    this.markDirty(playerId);
    this.logger.log(`World flag set player=${playerId} ${flagName}=${value}`);
    return true;
  }

  async setFlags(
    playerId: string,
    entries: Array<{ name: string; value?: string }>,
  ): Promise<string[]> {
    const newly: string[] = [];
    for (const entry of entries) {
      const ok = await this.setFlag(
        playerId,
        entry.name,
        entry.value ?? BOOLEAN_FLAG_VALUE,
      );
      if (ok) newly.push(entry.name);
    }
    return newly;
  }

  /** 读档 / 新开局：整表覆盖世界 flags */
  async replaceFlags(
    playerId: string,
    snapshot: StoryFlagsSnapshot,
    tx?: AppDatabase,
  ): Promise<void> {
    await this.ensureHydrated(playerId);
    const k = this.packKey(playerId);
    const safe = { ...snapshot };
    this.flagsCache.set(k, safe);
    this.markDirty(playerId);

    if (!this.playerStateRepo.ready && !tx) return;

    const { worldId, packVersionId } = this.packService.getProgressKey();
    const db = this.db(tx);
    await db
      .delete(worldFlags)
      .where(
        and(
          eq(worldFlags.playerId, playerId),
          eq(worldFlags.worldId, worldId),
          eq(worldFlags.packVersionId, packVersionId),
        ),
      );

    const rows = Object.entries(safe).map(([flagName, value]) => ({
      playerId,
      worldId,
      packVersionId,
      flagName,
      value,
    }));
    if (rows.length > 0) {
      await db.insert(worldFlags).values(rows);
    }
  }

  /**
   * 读档 / 新开局：章 + flags 一次对齐。
   * 可传入 tx，与会话表/快照同事务提交。
   */
  async replaceWorld(
    playerId: string,
    chapter: ChapterState,
    flags: StoryFlagsSnapshot,
    tx?: AppDatabase,
  ): Promise<ChapterState> {
    await this.ensureHydrated(playerId);
    const valid = this.resolveValidChapter(chapter);
    const k = this.packKey(playerId);
    this.chapterCache.set(k, valid);

    if (this.playerStateRepo.ready || tx) {
      const { worldId, packVersionId } = this.packService.getProgressKey();
      const db = this.db(tx);
      await db
        .insert(worldProgress)
        .values({
          playerId,
          worldId,
          packVersionId,
          chapterState: valid,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            worldProgress.playerId,
            worldProgress.worldId,
            worldProgress.packVersionId,
          ],
          set: { chapterState: valid, updatedAt: new Date() },
        });
    }

    await this.replaceFlags(playerId, flags, tx);
    return valid;
  }

  clearCache(playerId: string) {
    const k = this.packKey(playerId);
    this.chapterCache.delete(k);
    this.flagsCache.delete(k);
    this.hydrated.delete(k);
    this.dirty.delete(k);
  }
}
