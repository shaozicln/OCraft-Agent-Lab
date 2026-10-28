import { AsyncLocalStorage } from 'async_hooks';
import * as fs from 'fs';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  assertPackReferences,
  getChapterLabelMap,
  getChapterRankMap,
  getDefaultChapterId,
  getDefaultNpcId,
  getPackPlayablePlayerId,
  isPackPlayablePlayerEnabled,
  storyPackSchema,
  type PackNpc,
  type PackRuntime,
  type PackSelection,
  type PackWorldSummary,
  type StoryPack,
} from '@ocraft/shared';
import { AuthService } from '../auth/auth.service';
import { DbService } from '../db/db.service';
import { LlmService } from '../agent/core/llm.service';
import {
  playerNpcState,
  playerPackProfiles,
  players,
  storyFlags,
  storyPackVersions,
} from '../db/schema';
import {
  loadOfficialPack,
  loadStoryPackFromDir,
  loadWorldManifest,
  resolveStoryPacksRoot,
} from './pack-loader';
import {
  CommunityPackService,
  makeUserWorldId,
} from './community-pack.service';
import {
  createWorldPack,
  deleteVersionOnDisk,
  deleteWorldOnDisk,
  forkWorldPack,
  listDiskWorldSummaries,
  resolveVersionPath,
  savePackAsCopy,
  writeStoryPackToDir,
  writeWorldManifest,
} from './pack-ops';

interface PackAlsStore {
  playerId: string;
  pack: StoryPack;
}

/**
 * 默认包 + 每玩家选用包。
 * WS/HTTP 在处理前 hydratePlayer + runWithPlayer，使 getPack() 读到该玩家的包。
 */
@Injectable()
export class PackService implements OnModuleInit {
  private readonly logger = new Logger(PackService.name);
  private readonly als = new AsyncLocalStorage<PackAlsStore>();
  private officialPack: StoryPack | null = null;
  /** `${worldId}::${versionDir}` → pack */
  private readonly packCache = new Map<string, StoryPack>();
  /** playerId → 已解析的选用键 */
  private readonly playerKeys = new Map<
    string,
    { worldId: string; packVersionId: string; explicit: boolean }
  >();

  constructor(
    private readonly dbService: DbService,
    private readonly community: CommunityPackService,
    private readonly authService: AuthService,
    @Optional() private readonly llmService?: LlmService,
  ) {}

  async onModuleInit() {
    try {
      this.officialPack = loadOfficialPack();
      this.cachePack(this.officialPack);
      this.logger.log(
        `Loaded official pack world=${this.officialPack.header.world_id} version=${this.officialPack.version_dir} npcs=${this.officialPack.npcs.length} root=${resolveStoryPacksRoot()}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to load official story pack: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
    try {
      await this.authService.bootstrapAdminIfNeeded();
    } catch (err) {
      this.logger.warn(
        `Admin bootstrap failed: ${err instanceof Error ? err.message : err}`,
      );
    }
    try {
      await this.community.syncFromDisk();
    } catch (err) {
      this.logger.warn(
        `Community pack sync failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private cacheKey(worldId: string, versionDir: string) {
    return `${worldId}::${versionDir}`;
  }

  private cachePack(pack: StoryPack) {
    this.packCache.set(
      this.cacheKey(pack.header.world_id, pack.version_dir),
      pack,
    );
  }

  getOfficialPack(): StoryPack {
    if (!this.officialPack) {
      throw new Error('Official story pack not loaded');
    }
    return this.officialPack;
  }

  /** 当前异步上下文中的包；无上下文则默认包 */
  getPack(): StoryPack {
    return this.als.getStore()?.pack ?? this.getOfficialPack();
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

  getProgressKey(): { worldId: string; packVersionId: string } {
    const pack = this.getPack();
    return {
      worldId: pack.header.world_id,
      packVersionId: pack.version_dir,
    };
  }

  sessionKey(playerId: string, npcId: string): string {
    const { worldId, packVersionId } = this.getProgressKey();
    return `${playerId}:${worldId}:${packVersionId}:${npcId}`;
  }

  /** 在玩家包上下文中执行（WS/HTTP 入口调用） */
  runWithPlayer<T>(playerId: string, fn: () => T): T {
    const pack = this.getPackForPlayerSync(playerId);
    return this.als.run({ playerId, pack }, fn);
  }

  async runWithPlayerAsync<T>(
    playerId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    await this.hydratePlayer(playerId);
    const pack = this.getPackForPlayerSync(playerId);
    const run = () => this.als.run({ playerId, pack }, fn);
    if (!this.llmService) return run();
    return this.als.run({ playerId, pack }, () =>
      this.llmService!.runForPlayer(playerId, fn),
    );
  }

  private getPackForPlayerSync(playerId: string): StoryPack {
    const key = this.playerKeys.get(playerId);
    if (!key) {
      return this.getOfficialPack();
    }
    const cached = this.packCache.get(
      this.cacheKey(key.worldId, key.packVersionId),
    );
    if (cached) return cached;
    return this.loadPackOrThrow(key.worldId, key.packVersionId);
  }

  private loadPackOrThrow(worldId: string, versionDir: string): StoryPack {
    const diskPath = resolveVersionPath(worldId, versionDir);
    try {
      const pack = loadStoryPackFromDir(diskPath);
      this.cachePack(pack);
      return pack;
    } catch (diskErr) {
      // 磁盘没有时尝试 DB JSONB
      if (this.dbService.isReady) {
        // sync path can't await — throw with hint; hydrate loads DB async
      }
      throw new NotFoundException(
        `包不存在或无效: ${worldId}/${versionDir} (${diskErr instanceof Error ? diskErr.message : diskErr})`,
      );
    }
  }

  private async loadPackAsync(
    worldId: string,
    versionDir: string,
  ): Promise<StoryPack> {
    const ck = this.cacheKey(worldId, versionDir);
    const hit = this.packCache.get(ck);
    if (hit) return hit;

    const diskPath = resolveVersionPath(worldId, versionDir);
    try {
      const pack = loadStoryPackFromDir(diskPath);
      this.cachePack(pack);
      return pack;
    } catch (diskErr) {
      if (this.dbService.isReady) {
        const rows = await this.dbService.db
          .select()
          .from(storyPackVersions)
          .where(
            and(
              eq(storyPackVersions.worldId, worldId),
              eq(storyPackVersions.packVersionId, versionDir),
            ),
          )
          .limit(1);
        const row = rows[0];
        if (row?.packJson) {
          this.cachePack(row.packJson);
          this.logger.warn(
            `Loaded pack ${worldId}/${versionDir} from DB (disk missing)`,
          );
          return row.packJson;
        }
      }
      throw new NotFoundException(
        `包不存在或无效: ${worldId}/${versionDir} (${diskErr instanceof Error ? diskErr.message : diskErr})`,
      );
    }
  }

  /** 从 DB 读选用并缓存；无选用则默认默认 */
  async hydratePlayer(playerId: string): Promise<StoryPack> {
    const official = this.getOfficialPack();
    let worldId = official.header.world_id;
    let packVersionId = official.version_dir;
    let explicit = false;

    if (this.dbService.isReady) {
      const rows = await this.dbService.db
        .select({
          selectedWorldId: players.selectedWorldId,
          selectedPackVersionId: players.selectedPackVersionId,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);
      const row = rows[0];
      if (row?.selectedWorldId && row?.selectedPackVersionId) {
        const ok = await this.community.canAccessVersion(
          playerId,
          row.selectedWorldId,
          row.selectedPackVersionId,
        );
        if (ok) {
          worldId = row.selectedWorldId;
          packVersionId = row.selectedPackVersionId;
          explicit = true;
          this.community.grantPlay(playerId, worldId, packVersionId);
        }
        // 刷新后无 grant 且已取消共享 → 回官方，不清 DB 历史选用（仅本局不用）
      }
    }

    const pack = await this.loadPackAsync(worldId, packVersionId);
    this.playerKeys.set(playerId, {
      worldId: pack.header.world_id,
      packVersionId: pack.version_dir,
      explicit,
    });
    return pack;
  }

  /** 磁盘全量扫描（无社区过滤）；社区货架请用 listWorldsForPlayer */
  listWorlds() {
    return listDiskWorldSummaries();
  }

  /** 按玩家过滤的社区货架（官方 + 自己的 + 已共享） */
  async listWorldsForPlayer(playerId: string): Promise<PackWorldSummary[]> {
    if (!this.dbService.isReady) {
      return this.listWorlds().map((w) => ({
        ...w,
        short_name: w.world_id,
        is_official_world: true,
        is_shared: true,
        is_owner: false,
        moderation: 'normal' as const,
        versions: w.versions.map((v) => ({
          ...v,
          is_shared: true,
          is_owner: false,
          moderation: 'normal' as const,
          like_count: 0,
          favorite_count: 0,
          liked_by_me: false,
          favorited_by_me: false,
        })),
        like_count: 0,
        favorite_count: 0,
        liked_by_me: false,
        favorited_by_me: false,
      }));
    }
    return this.community.listVisibleWorlds(playerId);
  }

  async seedVersion(
    worldId: string,
    versionDir: string,
  ): Promise<{ world_id: string; version_dir: string; display_name: string }> {
    const pack = await this.loadPackAsync(worldId, versionDir);
    if (pack.header.world_id !== worldId) {
      throw new BadRequestException(
        `pack.json world_id=${pack.header.world_id} 与路径 world=${worldId} 不一致`,
      );
    }

    if (this.dbService.isReady) {
      await this.dbService.db
        .insert(storyPackVersions)
        .values({
          worldId,
          packVersionId: pack.version_dir,
          displayName: pack.header.display_name,
          createdAt: pack.header.created_at,
          notes: pack.header.notes,
          packJson: pack,
          seededAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            storyPackVersions.worldId,
            storyPackVersions.packVersionId,
          ],
          set: {
            displayName: pack.header.display_name,
            createdAt: pack.header.created_at,
            notes: pack.header.notes,
            packJson: pack,
            seededAt: new Date(),
          },
        });
      this.logger.log(`Seeded pack ${worldId}/${pack.version_dir} → DB`);
    } else {
      this.logger.warn(
        `DB unavailable — validated ${worldId}/${pack.version_dir} but did not seed`,
      );
    }

    return {
      world_id: worldId,
      version_dir: pack.version_dir,
      display_name: pack.header.display_name,
    };
  }

  async saveAs(opts: {
    worldId: string;
    fromVersionDir?: string;
    versionName: string;
    notes?: string;
    blankContent?: boolean;
  }) {
    const fromVersionDir =
      opts.fromVersionDir ?? this.getOfficialPack().version_dir;
    try {
      const result = savePackAsCopy({
        worldId: opts.worldId,
        fromVersionDir,
        versionName: opts.versionName,
        notes: opts.notes,
        blankContent: opts.blankContent,
      });
      this.cachePack(result.pack);
      await this.seedVersion(result.worldId, result.versionDir);
      return {
        world_id: result.worldId,
        version_dir: result.versionDir,
        version_name: result.pack.header.display_name,
        created_at: result.pack.header.created_at,
        path: result.versionPath,
      };
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : '另存失败',
      );
    }
  }

  async createWorld(opts: {
    worldId: string;
    versionName?: string;
    description?: string;
    notes?: string;
  }) {
    const versionName = opts.versionName?.trim() || opts.worldId;

    try {
      const result = createWorldPack({
        worldId: opts.worldId,
        versionName,
        description: opts.description,
        notes: opts.notes,
      });
      this.cachePack(result.pack);
      await this.seedVersion(result.worldId, result.versionDir);
      return {
        world_id: result.worldId,
        version_dir: result.versionDir,
        version_name: result.pack.header.display_name,
        created_at: result.pack.header.created_at,
        path: result.versionPath,
      };
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : '新建世界失败',
      );
    }
  }

  /** 登录用户新建社区世界（shortName → u{uid}_{shortName}） */
  async createWorldForPlayer(
    playerId: string,
    opts: {
      shortName?: string;
      worldId?: string;
      versionName?: string;
      description?: string;
      notes?: string;
    },
  ) {
    const reserved = new Set([
      'office',
      'awaken',
      process.env.OFFICIAL_WORLD ?? 'office',
    ]);
    const shortRaw = (opts.shortName ?? opts.worldId ?? '').trim();
    if (!shortRaw) {
      throw new BadRequestException('请提供 shortName');
    }
    if (reserved.has(shortRaw.normalize('NFC'))) {
      throw new BadRequestException('不能占用官方世界短名');
    }
    const worldId = makeUserWorldId(playerId, shortRaw);
    const shortName = worldId.slice(`u${playerId}_`.length);
    if (this.dbService.isReady) {
      await this.community.assertWorldIdAvailable(worldId);
    }
    const versionName = opts.versionName?.trim() || shortName;
    const created = await this.createWorld({
      worldId,
      versionName,
      description: opts.description,
      notes: opts.notes,
    });
    if (this.dbService.isReady) {
      await this.community.upsertWorldMeta({
        worldId,
        shortName,
        ownerPlayerId: playerId,
        description: opts.description,
        officialVersionDir: created.version_dir,
        isOfficial: false,
        isShared: false,
      });
      await this.community.upsertVersionMeta({
        worldId,
        versionDir: created.version_dir,
        ownerPlayerId: playerId,
        isShared: false,
      });
    }
    return { ...created, short_name: shortName, owner_player_id: playerId };
  }

  async forkWorldForPlayer(
    playerId: string,
    opts: {
      fromWorldId: string;
      fromVersionDirs: string[];
      shortName?: string;
      description?: string;
      notes?: string;
    },
  ) {
    for (const dir of opts.fromVersionDirs) {
      const ok = await this.community.isVersionListed(
        playerId,
        opts.fromWorldId,
        dir,
      );
      if (!ok) {
        throw new BadRequestException(
          `无权 Fork 版本 ${opts.fromWorldId}/${dir}（须已共享可见）`,
        );
      }
    }
    const source = (await this.listWorldsForPlayer(playerId)).find(
      (w) => w.world_id === opts.fromWorldId,
    );
    const shortRaw =
      opts.shortName?.trim() ||
      source?.short_name ||
      opts.fromWorldId;
    const worldId = makeUserWorldId(playerId, shortRaw);
    const shortName = worldId.slice(`u${playerId}_`.length);
    if (this.dbService.isReady) {
      await this.community.assertWorldIdAvailable(worldId);
    }

    let forked: {
      worldId: string;
      versionDirs: string[];
      officialVersionDir: string;
    };
    try {
      forked = forkWorldPack({
        fromWorldId: opts.fromWorldId,
        fromVersionDirs: opts.fromVersionDirs,
        toWorldId: worldId,
        description: opts.description,
        notes: opts.notes,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Fork 失败',
      );
    }

    for (const versionDir of forked.versionDirs) {
      const pack = await this.loadPackAsync(worldId, versionDir);
      this.cachePack(pack);
      await this.seedVersion(worldId, versionDir);
    }
    if (this.dbService.isReady) {
      await this.community.upsertWorldMeta({
        worldId,
        shortName,
        ownerPlayerId: playerId,
        description: opts.description ?? source?.description,
        officialVersionDir: forked.officialVersionDir,
        isOfficial: false,
        isShared: false,
        forkedFromWorldId: opts.fromWorldId,
        forkedFromVersionDirs: forked.versionDirs,
      });
      for (const versionDir of forked.versionDirs) {
        await this.community.upsertVersionMeta({
          worldId,
          versionDir,
          ownerPlayerId: playerId,
          isShared: false,
        });
      }
    }
    return {
      world_id: worldId,
      short_name: shortName,
      version_dirs: forked.versionDirs,
      official_version_dir: forked.officialVersionDir,
      forked_from_world_id: opts.fromWorldId,
      forked_from_version_dirs: forked.versionDirs,
    };
  }

  async getSelection(playerId: string): Promise<PackSelection> {
    const pack = await this.hydratePlayer(playerId);
    const key = this.playerKeys.get(playerId);
    return {
      world_id: pack.header.world_id,
      pack_version_id: pack.version_dir,
      is_explicit: key?.explicit ?? false,
    };
  }

  clearPlayGrant(playerId: string) {
    this.community.clearPlayGrant(playerId);
  }

  async selectPack(
    playerId: string,
    worldId: string,
    packVersionId: string,
  ): Promise<PackSelection> {
    if (this.dbService.isReady) {
      const visible = await this.community.isVersionListed(
        playerId,
        worldId,
        packVersionId,
      );
      if (!visible) {
        throw new BadRequestException(
          '该世界/版本不可见（未共享、已隐藏或在回收站）',
        );
      }
    }

    await this.loadPackAsync(worldId, packVersionId);

    if (!this.dbService.isReady) {
      throw new BadRequestException(
        'Database not available. Set DATABASE_URL and run npm run db:migrate.',
      );
    }

    const db = this.dbService.db;
    await db
      .insert(players)
      .values({
        id: playerId,
        selectedWorldId: worldId,
        selectedPackVersionId: packVersionId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: players.id,
        set: {
          selectedWorldId: worldId,
          selectedPackVersionId: packVersionId,
          updatedAt: new Date(),
        },
      });

    this.playerKeys.set(playerId, {
      worldId,
      packVersionId,
      explicit: true,
    });
    this.community.grantPlay(playerId, worldId, packVersionId);
    this.logger.log(
      `Player ${playerId} selected pack ${worldId}/${packVersionId}`,
    );
    return this.getSelection(playerId);
  }

  /** 清除显式选用，回到默认默认 */
  async clearSelection(playerId: string): Promise<PackSelection> {
    if (this.dbService.isReady) {
      await this.dbService.db
        .update(players)
        .set({
          selectedWorldId: null,
          selectedPackVersionId: null,
          updatedAt: new Date(),
        })
        .where(eq(players.id, playerId));
    }
    this.playerKeys.delete(playerId);
    // 恢复默认 = 结束本局；取消共享后的 play grant 一并清掉
    this.community.clearPlayGrant(playerId);
    return this.getSelection(playerId);
  }

  /** 进场用：当前生效包的 NPC / 章节摘要 */
  async getRuntime(playerId: string): Promise<PackRuntime> {
    const pack = await this.hydratePlayer(playerId);
    const selection = await this.getSelection(playerId);
    return {
      selection,
      default_npc_id: getDefaultNpcId(pack),
      default_chapter: getDefaultChapterId(pack),
      chapters: pack.world.chapters.map((c) => ({
        id: c.id,
        display_name: c.display_name,
        hud_label: c.hud_label,
        rank: c.rank,
      })),
      chapter_labels: getChapterLabelMap(pack),
      npcs: pack.npcs.map((n) => ({
        npc_id: n.npc_id,
        name: n.name,
        spawn_position: n.meta.spawn_position,
        model_path: n.meta.model_path?.trim() || undefined,
        appear_from_chapter: n.appear_from_chapter,
        appear_require_flags: n.appear_require_flags ?? [],
      })),
      endings: (pack.world.endings ?? []).map((e) => ({
        id: e.id,
        display_name: e.display_name,
        enabled: e.enabled !== false,
        chapter: e.chapter,
        require_flags: [...(e.require_flags ?? [])],
        require_any_flags: [...(e.require_any_flags ?? [])],
        forbid_flags: [...(e.forbid_flags ?? [])],
        set_flags: (e.set_flags ?? []).map((f) => ({
          name: f.name,
          value: f.value,
        })),
      })),
      world_id: pack.header.world_id,
      display_name: pack.header.display_name,
      default_style_id: pack.header.default_style_id,
      playable_player_enabled: isPackPlayablePlayerEnabled(pack),
      playable_player_id: getPackPlayablePlayerId(pack),
    };
  }

  async getVersionPack(worldId: string, versionDir: string): Promise<StoryPack> {
    return this.loadPackAsync(worldId, versionDir);
  }

  /**
   * 覆盖写回磁盘版本 + seed DB + 刷新缓存。
   * version_dir 以路径为准（不允许通过 body 改目录名）。
   */
  async updateVersionPack(
    worldId: string,
    versionDir: string,
    rawPack: unknown,
  ): Promise<StoryPack> {
    const versionPath = resolveVersionPath(worldId, versionDir);
    if (!fs.existsSync(versionPath)) {
      throw new NotFoundException(`版本目录不存在: ${worldId}/${versionDir}`);
    }

    let pack: StoryPack;
    try {
      pack = storyPackSchema.parse({
        ...(rawPack as object),
        version_dir: versionDir,
      });
      if (pack.header.world_id !== worldId) {
        throw new BadRequestException(
          `pack.header.world_id=${pack.header.world_id} 与路径 world=${worldId} 不一致`,
        );
      }
      pack = { ...pack, version_dir: versionDir };
      assertPackReferences(pack);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`包校验失败: ${msg}`);
    }

    writeStoryPackToDir(versionPath, pack);
    this.cachePack(pack);

    // 若改的是当前默认包，同步内存默认指针
    if (
      this.officialPack &&
      this.officialPack.header.world_id === worldId &&
      this.officialPack.version_dir === versionDir
    ) {
      this.officialPack = pack;
    }

    await this.seedVersion(worldId, versionDir);
    this.logger.log(`Updated pack on disk ${worldId}/${versionDir}`);
    return pack;
  }

  private uncache(worldId: string, versionDir?: string) {
    if (versionDir) {
      this.packCache.delete(this.cacheKey(worldId, versionDir));
      return;
    }
    const prefix = `${worldId}/`;
    for (const key of [...this.packCache.keys()]) {
      if (key.startsWith(prefix)) this.packCache.delete(key);
    }
  }

  private async clearPlayersSelecting(
    worldId: string,
    packVersionId?: string,
  ) {
    if (!this.dbService.isReady) return;
    const db = this.dbService.db;
    const rows = await db
      .select({
        id: players.id,
        selectedWorldId: players.selectedWorldId,
        selectedPackVersionId: players.selectedPackVersionId,
      })
      .from(players);
    for (const row of rows) {
      if (row.selectedWorldId !== worldId) continue;
      if (
        packVersionId &&
        row.selectedPackVersionId !== packVersionId
      ) {
        continue;
      }
      await db
        .update(players)
        .set({
          selectedWorldId: null,
          selectedPackVersionId: null,
          updatedAt: new Date(),
        })
        .where(eq(players.id, row.id));
      this.playerKeys.delete(row.id);
    }
  }

  private async deleteProgressRows(worldId: string, packVersionId?: string) {
    if (!this.dbService.isReady) return;
    const db = this.dbService.db;
    if (packVersionId) {
      await db
        .delete(storyPackVersions)
        .where(
          and(
            eq(storyPackVersions.worldId, worldId),
            eq(storyPackVersions.packVersionId, packVersionId),
          ),
        );
      await db
        .delete(playerPackProfiles)
        .where(
          and(
            eq(playerPackProfiles.worldId, worldId),
            eq(playerPackProfiles.packVersionId, packVersionId),
          ),
        );
      await db
        .delete(playerNpcState)
        .where(
          and(
            eq(playerNpcState.worldId, worldId),
            eq(playerNpcState.packVersionId, packVersionId),
          ),
        );
      await db
        .delete(storyFlags)
        .where(
          and(
            eq(storyFlags.worldId, worldId),
            eq(storyFlags.packVersionId, packVersionId),
          ),
        );
      return;
    }
    await db
      .delete(storyPackVersions)
      .where(eq(storyPackVersions.worldId, worldId));
    await db
      .delete(playerPackProfiles)
      .where(eq(playerPackProfiles.worldId, worldId));
    await db
      .delete(playerNpcState)
      .where(eq(playerNpcState.worldId, worldId));
    await db.delete(storyFlags).where(eq(storyFlags.worldId, worldId));
  }

  /** 删除版本；不可删全服测试默认版本；删光则请删世界 */
  async deleteVersion(worldId: string, versionDir: string) {
    const official = this.getOfficialPack();
    if (
      worldId === official.header.world_id &&
      versionDir === official.version_dir
    ) {
      throw new BadRequestException('不能删除全服测试默认版本');
    }

    const world = this.listWorlds().find((w) => w.world_id === worldId);
    if (!world) throw new NotFoundException(`未知世界: ${worldId}`);
    if (!world.versions.some((v) => v.version_dir === versionDir)) {
      throw new NotFoundException(`版本不存在: ${worldId}/${versionDir}`);
    }
    if (world.versions.length <= 1) {
      throw new BadRequestException('世界仅剩一个版本，请直接删除世界');
    }

    try {
      deleteVersionOnDisk(worldId, versionDir);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : '删除版本失败',
      );
    }

    if (world.official_version_dir === versionDir) {
      const next = world.versions.find((v) => v.version_dir !== versionDir);
      if (next) {
        const packsRoot = resolveStoryPacksRoot();
        const manifest = loadWorldManifest(packsRoot, worldId);
        writeWorldManifest(worldId, {
          world_id: worldId,
          official_version_dir: next.version_dir,
          description: manifest.description,
        });
      }
    }

    this.uncache(worldId, versionDir);
    await this.clearPlayersSelecting(worldId, versionDir);
    await this.deleteProgressRows(worldId, versionDir);
    this.logger.log(`Deleted version ${worldId}/${versionDir}`);
    return { world_id: worldId, version_dir: versionDir, deleted: true };
  }

  /** 删除世界；不可删全服测试世界 */
  async deleteWorld(worldId: string) {
    const officialWorld = process.env.OFFICIAL_WORLD ?? 'office';
    if (worldId === officialWorld) {
      throw new BadRequestException('不能删除全服测试世界');
    }
    const world = this.listWorlds().find((w) => w.world_id === worldId);
    if (!world) throw new NotFoundException(`未知世界: ${worldId}`);

    try {
      deleteWorldOnDisk(worldId);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : '删除世界失败',
      );
    }

    this.uncache(worldId);
    await this.clearPlayersSelecting(worldId);
    await this.deleteProgressRows(worldId);
    this.logger.log(`Deleted world ${worldId}`);
    return { world_id: worldId, deleted: true };
  }
}
