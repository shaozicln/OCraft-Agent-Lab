import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { PackVersionSummary, PackWorldSummary } from '@ocraft/shared';
import { DbService } from '../db/db.service';
import {
  communityVersions,
  communityVersionsTrash,
  communityWorlds,
  communityWorldsTrash,
  packFavorites,
  packLikes,
  players,
} from '../db/schema';
import { listDiskWorldSummaries } from './pack-ops';
import { makeUserWorldId } from './community-short-name';

export type ModerationStatus = 'normal' | 'hidden';
export { makeUserWorldId } from './community-short-name';

function flagTrue(v: string | null | undefined): boolean {
  return v === 'true' || v === '1';
}

function flagStr(v: boolean): string {
  return v ? 'true' : 'false';
}

@Injectable()
export class CommunityPackService {
  private readonly logger = new Logger(CommunityPackService.name);
  /**
   * 取消共享后「本局可打完」：仅内存 grant。
   * 刷新 / 断线清掉；不能靠 DB selected 续玩。
   */
  private readonly playGrants = new Map<
    string,
    { worldId: string; versionDir: string }
  >();

  constructor(private readonly dbService: DbService) {}

  grantPlay(playerId: string, worldId: string, versionDir: string) {
    this.playGrants.set(playerId, { worldId, versionDir });
  }

  clearPlayGrant(playerId: string) {
    this.playGrants.delete(playerId);
  }

  private requireDb() {
    if (!this.dbService.isReady) {
      throw new BadRequestException(
        '数据库不可用，社区剧情包功能需要 PostgreSQL',
      );
    }
    return this.dbService.db;
  }

  async isAdmin(playerId: string): Promise<boolean> {
    if (!this.dbService.isReady) return false;
    const rows = await this.dbService.db
      .select({ isAdmin: players.isAdmin })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    return flagTrue(rows[0]?.isAdmin);
  }

  async requireAdmin(playerId: string): Promise<void> {
    if (!(await this.isAdmin(playerId))) {
      throw new ForbiddenException('需要管理员权限');
    }
  }

  async getWorldRow(worldId: string) {
    const db = this.requireDb();
    const rows = await db
      .select()
      .from(communityWorlds)
      .where(eq(communityWorlds.worldId, worldId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getVersionRow(worldId: string, versionDir: string) {
    const db = this.requireDb();
    const rows = await db
      .select()
      .from(communityVersions)
      .where(
        and(
          eq(communityVersions.worldId, worldId),
          eq(communityVersions.versionDir, versionDir),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async isWorldOwner(playerId: string, worldId: string): Promise<boolean> {
    const row = await this.getWorldRow(worldId);
    return !!row && row.ownerPlayerId === playerId;
  }

  /**
   * 启动时：把磁盘上的世界扫进元数据表。
   * - 已存在行：只补版本，不覆盖用户改过的共享/审核
   * - 新世界：office/awaken（及 OFFICIAL_WORLD）标官方+共享；其余先标私有
   */
  async syncFromDisk(): Promise<void> {
    if (!this.dbService.isReady) {
      this.logger.warn('DB not ready — skip community pack sync');
      return;
    }
    const db = this.requireDb();
    const officialWorld = process.env.OFFICIAL_WORLD ?? 'office';
    const knownOfficial = new Set(['office', 'awaken', officialWorld]);
    const disk = listDiskWorldSummaries();
    const trashIds = new Set(
      (
        await db
          .select({ worldId: communityWorldsTrash.worldId })
          .from(communityWorldsTrash)
      ).map((r) => r.worldId),
    );

    for (const w of disk) {
      if (trashIds.has(w.world_id)) continue;
      const existing = await this.getWorldRow(w.world_id);
      const isOfficial = knownOfficial.has(w.world_id);
      if (!existing) {
        await db.insert(communityWorlds).values({
          worldId: w.world_id,
          shortName: w.world_id,
          ownerPlayerId: null,
          description: w.description,
          officialVersionDir: w.official_version_dir,
          isOfficial: flagStr(isOfficial),
          isShared: flagStr(isOfficial),
          moderation: 'normal',
        });
        this.logger.log(
          `Synced world ${w.world_id} official=${isOfficial} versions=${w.versions.length}`,
        );
      } else {
        await db
          .update(communityWorlds)
          .set({
            officialVersionDir: w.official_version_dir,
            description: w.description ?? existing.description,
            updatedAt: new Date(),
          })
          .where(eq(communityWorlds.worldId, w.world_id));
      }

      for (const v of w.versions) {
        const ver = await this.getVersionRow(w.world_id, v.version_dir);
        if (!ver) {
          await db.insert(communityVersions).values({
            worldId: w.world_id,
            versionDir: v.version_dir,
            ownerPlayerId: existing?.ownerPlayerId ?? null,
            isShared: flagStr(isOfficial || flagTrue(existing?.isShared)),
            moderation: 'normal',
          });
        }
      }
    }
  }

  async assertWorldIdAvailable(worldId: string) {
    const db = this.requireDb();
    if (await this.getWorldRow(worldId)) {
      throw new BadRequestException(`世界已存在: ${worldId}`);
    }
    const trash = await db
      .select({ worldId: communityWorldsTrash.worldId })
      .from(communityWorldsTrash)
      .where(eq(communityWorldsTrash.worldId, worldId))
      .limit(1);
    if (trash.length > 0) {
      throw new BadRequestException(
        `世界「${worldId}」仍在回收站中，请先恢复或彻底清空后再建同名`,
      );
    }
  }

  async upsertWorldMeta(opts: {
    worldId: string;
    shortName: string;
    ownerPlayerId: string | null;
    description?: string;
    officialVersionDir: string;
    isOfficial?: boolean;
    isShared?: boolean;
    forkedFromWorldId?: string | null;
    forkedFromVersionDirs?: string[] | null;
  }) {
    const db = this.requireDb();
    const existing = await this.getWorldRow(opts.worldId);
    if (existing) {
      await db
        .update(communityWorlds)
        .set({
          shortName: opts.shortName,
          description: opts.description,
          officialVersionDir: opts.officialVersionDir,
          updatedAt: new Date(),
        })
        .where(eq(communityWorlds.worldId, opts.worldId));
      return;
    }
    await this.assertWorldIdAvailable(opts.worldId);
    await db.insert(communityWorlds).values({
      worldId: opts.worldId,
      shortName: opts.shortName,
      ownerPlayerId: opts.ownerPlayerId,
      description: opts.description,
      officialVersionDir: opts.officialVersionDir,
      isOfficial: flagStr(opts.isOfficial ?? false),
      isShared: flagStr(opts.isShared ?? false),
      moderation: 'normal',
      forkedFromWorldId: opts.forkedFromWorldId ?? null,
      forkedFromVersionDirs: opts.forkedFromVersionDirs ?? null,
    });
  }

  async upsertVersionMeta(opts: {
    worldId: string;
    versionDir: string;
    ownerPlayerId: string | null;
    isShared?: boolean;
  }) {
    const db = this.requireDb();
    const existing = await this.getVersionRow(opts.worldId, opts.versionDir);
    if (existing) return;
    await db.insert(communityVersions).values({
      worldId: opts.worldId,
      versionDir: opts.versionDir,
      ownerPlayerId: opts.ownerPlayerId,
      isShared: flagStr(opts.isShared ?? false),
      moderation: 'normal',
    });
  }

  async deleteWorldMeta(worldId: string) {
    if (!this.dbService.isReady) return;
    await this.dbService.db
      .delete(communityWorlds)
      .where(eq(communityWorlds.worldId, worldId));
  }

  async deleteVersionMeta(worldId: string, versionDir: string) {
    if (!this.dbService.isReady) return;
    await this.dbService.db
      .delete(communityVersions)
      .where(
        and(
          eq(communityVersions.worldId, worldId),
          eq(communityVersions.versionDir, versionDir),
        ),
      );
  }

  /**
   * 列表可见：官方 ∪ 自己的 ∪（共享且未隐藏，且至少有一个可见共享版本）
   * admin 额外看到全部（含隐藏）便于审核。
   */
  async listVisibleWorlds(viewerId: string): Promise<PackWorldSummary[]> {
    const db = this.requireDb();
    const admin = await this.isAdmin(viewerId);
    const disk = listDiskWorldSummaries();
    const diskMap = new Map(disk.map((w) => [w.world_id, w]));

    const worldRows = await db.select().from(communityWorlds);
    const versionRows = await db.select().from(communityVersions);
    const versionsByWorld = new Map<string, typeof versionRows>();
    for (const v of versionRows) {
      const list = versionsByWorld.get(v.worldId) ?? [];
      list.push(v);
      versionsByWorld.set(v.worldId, list);
    }

    const ownerIds = [
      ...new Set(
        worldRows
          .map((w) => w.ownerPlayerId)
          .filter((id): id is string => !!id),
      ),
    ];
    const ownerName = new Map<string, string>();
    if (ownerIds.length > 0) {
      const rows = await db
        .select({ id: players.id, username: players.username })
        .from(players)
        .where(inArray(players.id, ownerIds));
      for (const r of rows) {
        if (r.username) ownerName.set(r.id, r.username);
      }
    }

    const reaction = await this.loadReactionStats(viewerId);

    const out: PackWorldSummary[] = [];
    for (const w of worldRows) {
      const diskWorld = diskMap.get(w.worldId);
      if (!diskWorld) continue;

      const isOwner = w.ownerPlayerId === viewerId;
      const isOfficial = flagTrue(w.isOfficial);
      const isShared = flagTrue(w.isShared);
      const moderation = (w.moderation === 'hidden' ? 'hidden' : 'normal') as ModerationStatus;

      // 隐藏：仅 admin 可见；作者也不能操作，直到 admin 再显示
      if (!admin) {
        if (moderation === 'hidden') continue;
        if (!isOfficial && !isOwner && !isShared) continue;
      }

      const metaVers = versionsByWorld.get(w.worldId) ?? [];
      const metaByDir = new Map(metaVers.map((v) => [v.versionDir, v]));

      const versions: PackVersionSummary[] = [];
      for (const dv of diskWorld.versions) {
        const mv = metaByDir.get(dv.version_dir);
        const vShared = mv ? flagTrue(mv.isShared) : isOfficial;
        const vMod = (mv?.moderation === 'hidden' ? 'hidden' : 'normal') as ModerationStatus;
        const vOwner = mv?.ownerPlayerId === viewerId || isOwner;

        if (!admin) {
          if (vMod === 'hidden') continue;
          if (!isOfficial && !vOwner && !(isShared && vShared)) continue;
        }

        const vk = `version:${w.worldId}:${dv.version_dir}`;
        versions.push({
          ...dv,
          is_shared: vShared,
          is_owner: vOwner,
          moderation: vMod,
          like_count: reaction.counts.get(`like:${vk}`) ?? 0,
          favorite_count: reaction.counts.get(`fav:${vk}`) ?? 0,
          liked_by_me: reaction.mine.has(`like:${vk}`),
          favorited_by_me: reaction.mine.has(`fav:${vk}`),
        });
      }

      if (!admin && !isOfficial && !isOwner) {
        if (!versions.some((v) => v.is_shared && v.moderation !== 'hidden')) {
          continue;
        }
      }

      if (versions.length === 0 && !isOwner && !admin) continue;

      const wk = `world:${w.worldId}`;
      const forkDirs = w.forkedFromVersionDirs ?? null;
      out.push({
        world_id: w.worldId,
        short_name: w.shortName,
        description: w.description ?? diskWorld.description,
        official_version_dir: w.officialVersionDir || diskWorld.official_version_dir,
        versions,
        owner_player_id: w.ownerPlayerId,
        owner_username: w.ownerPlayerId
          ? (ownerName.get(w.ownerPlayerId) ?? null)
          : null,
        is_official_world: isOfficial,
        is_shared: isShared,
        is_owner: isOwner,
        moderation,
        forked_from_world_id: w.forkedFromWorldId,
        forked_from_version_dirs: forkDirs,
        forked_from_version_dir: forkDirs?.[0] ?? null,
        like_count: reaction.counts.get(`like:${wk}`) ?? 0,
        favorite_count: reaction.counts.get(`fav:${wk}`) ?? 0,
        liked_by_me: reaction.mine.has(`like:${wk}`),
        favorited_by_me: reaction.mine.has(`fav:${wk}`),
      });
    }

    out.sort((a, b) => {
      const ao = a.is_official_world ? 0 : 1;
      const bo = b.is_official_world ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return (a.short_name ?? a.world_id).localeCompare(
        b.short_name ?? b.world_id,
        'zh',
      );
    });
    return out;
  }

  private async loadReactionStats(viewerId: string) {
    const db = this.requireDb();
    const counts = new Map<string, number>();
    const mine = new Set<string>();

    const likeRows = await db.select().from(packLikes);
    for (const r of likeRows) {
      const key =
        r.targetType === 'world'
          ? `world:${r.worldId}`
          : `version:${r.worldId}:${r.versionDir}`;
      const ck = `like:${key}`;
      counts.set(ck, (counts.get(ck) ?? 0) + 1);
      if (r.playerId === viewerId) mine.add(ck);
    }
    const favRows = await db.select().from(packFavorites);
    for (const r of favRows) {
      const key =
        r.targetType === 'world'
          ? `world:${r.worldId}`
          : `version:${r.worldId}:${r.versionDir}`;
      const ck = `fav:${key}`;
      counts.set(ck, (counts.get(ck) ?? 0) + 1);
      if (r.playerId === viewerId) mine.add(ck);
    }
    return { counts, mine };
  }

  /**
   * 能否加载版本：
   * - 列表可见，或
   * - 本局 playGrant（取消共享后未断线可打完）
   */
  /** 货架可见（不含本局 grant）——用于新选用 */
  async isVersionListed(
    viewerId: string,
    worldId: string,
    versionDir: string,
  ): Promise<boolean> {
    if (await this.isAdmin(viewerId)) return true;
    const worlds = await this.listVisibleWorlds(viewerId);
    const w = worlds.find((x) => x.world_id === worldId);
    return !!w?.versions.some((v) => v.version_dir === versionDir);
  }

  /** 加载/游玩：列表可见 或 本局 grant */
  async canAccessVersion(
    viewerId: string,
    worldId: string,
    versionDir: string,
  ): Promise<boolean> {
    if (await this.isAdmin(viewerId)) return true;
    const grant = this.playGrants.get(viewerId);
    if (grant?.worldId === worldId && grant.versionDir === versionDir) {
      return true;
    }
    return this.isVersionListed(viewerId, worldId, versionDir);
  }

  async assertCanEditWorld(playerId: string, worldId: string) {
    if (await this.isAdmin(playerId)) {
      const row = await this.getWorldRow(worldId);
      if (row?.moderation === 'hidden') return; // admin 可审
    }
    const row = await this.getWorldRow(worldId);
    if (!row) {
      if (process.env.NODE_ENV === 'development') return;
      throw new ForbiddenException('未知世界');
    }
    if (row.moderation === 'hidden') {
      throw new ForbiddenException(
        '该世界处于审核隐藏，无法操作；请等待管理员恢复显示',
      );
    }
    if (row.ownerPlayerId === playerId) return;
    if (flagTrue(row.isOfficial) && (await this.isAdmin(playerId))) return;
    throw new ForbiddenException('只能编辑自己拥有的世界');
  }

  async setWorldShared(
    playerId: string,
    worldId: string,
    isShared: boolean,
    ensureVersionDir?: string,
  ) {
    await this.assertCanEditWorld(playerId, worldId);
    const db = this.requireDb();
    const row = await this.getWorldRow(worldId);
    if (!row) throw new NotFoundException(`未知世界: ${worldId}`);
    if (row.moderation === 'hidden') {
      throw new ForbiddenException(
        '该世界处于审核隐藏状态，无法修改共享；请联系管理员恢复显示',
      );
    }

    if (isShared) {
      const vers = await db
        .select()
        .from(communityVersions)
        .where(eq(communityVersions.worldId, worldId));
      let sharedCount = vers.filter((v) => flagTrue(v.isShared)).length;
      if (sharedCount === 0) {
        const target =
          ensureVersionDir ??
          row.officialVersionDir ??
          vers[0]?.versionDir;
        if (!target) {
          throw new BadRequestException('共享世界前请先创建一个版本');
        }
        const vrow = vers.find((v) => v.versionDir === target);
        if (!vrow) {
          throw new BadRequestException(`版本不存在: ${target}`);
        }
        if (vrow.moderation === 'hidden') {
          throw new BadRequestException('该版本被审核隐藏，不能作为共享版本');
        }
        await db
          .update(communityVersions)
          .set({ isShared: 'true', updatedAt: new Date() })
          .where(
            and(
              eq(communityVersions.worldId, worldId),
              eq(communityVersions.versionDir, target),
            ),
          );
        sharedCount = 1;
      }
      if (sharedCount < 1) {
        throw new BadRequestException('共享世界时至少需要共享一个版本');
      }
    } else {
      // 世界取消共享 → 全部版本取消共享
      await db
        .update(communityVersions)
        .set({ isShared: 'false', updatedAt: new Date() })
        .where(eq(communityVersions.worldId, worldId));
    }

    await db
      .update(communityWorlds)
      .set({ isShared: flagStr(isShared), updatedAt: new Date() })
      .where(eq(communityWorlds.worldId, worldId));

    return { world_id: worldId, is_shared: isShared };
  }

  async setVersionShared(
    playerId: string,
    worldId: string,
    versionDir: string,
    isShared: boolean,
  ) {
    await this.assertCanEditWorld(playerId, worldId);
    const db = this.requireDb();
    const world = await this.getWorldRow(worldId);
    if (!world) throw new NotFoundException(`未知世界: ${worldId}`);
    if (world.moderation === 'hidden') {
      throw new ForbiddenException('世界处于审核隐藏，无法修改版本共享');
    }
    const ver = await this.getVersionRow(worldId, versionDir);
    if (!ver) throw new NotFoundException(`版本不存在: ${versionDir}`);
    if (ver.moderation === 'hidden') {
      throw new ForbiddenException('版本处于审核隐藏，无法修改共享');
    }

    if (isShared && !flagTrue(world.isShared)) {
      throw new BadRequestException('请先共享世界，才能共享版本');
    }

    if (!isShared && flagTrue(world.isShared)) {
      const others = await db
        .select()
        .from(communityVersions)
        .where(eq(communityVersions.worldId, worldId));
      const remain = others.filter(
        (v) => v.versionDir !== versionDir && flagTrue(v.isShared),
      ).length;
      if (remain < 1) {
        throw new BadRequestException(
          '共享中的世界至少保留一个共享版本；若要全部私密，请先取消世界共享',
        );
      }
    }

    await db
      .update(communityVersions)
      .set({ isShared: flagStr(isShared), updatedAt: new Date() })
      .where(
        and(
          eq(communityVersions.worldId, worldId),
          eq(communityVersions.versionDir, versionDir),
        ),
      );

    return { world_id: worldId, version_dir: versionDir, is_shared: isShared };
  }

  async setWorldModeration(
    adminId: string,
    worldId: string,
    status: ModerationStatus,
  ) {
    await this.requireAdmin(adminId);
    const db = this.requireDb();
    const row = await this.getWorldRow(worldId);
    if (!row) throw new NotFoundException(`未知世界: ${worldId}`);
    if (flagTrue(row.isOfficial) && status === 'hidden') {
      throw new BadRequestException('不能隐藏官方世界；请先取消官方标记');
    }

    await db
      .update(communityWorlds)
      .set({ moderation: status, updatedAt: new Date() })
      .where(eq(communityWorlds.worldId, worldId));

    // 隐藏时顺带取消共享，避免误曝光
    if (status === 'hidden') {
      await db
        .update(communityWorlds)
        .set({ isShared: 'false', updatedAt: new Date() })
        .where(eq(communityWorlds.worldId, worldId));
      await db
        .update(communityVersions)
        .set({ isShared: 'false', updatedAt: new Date() })
        .where(eq(communityVersions.worldId, worldId));
    }

    return { world_id: worldId, moderation: status };
  }

  async setVersionModeration(
    adminId: string,
    worldId: string,
    versionDir: string,
    status: ModerationStatus,
  ) {
    await this.requireAdmin(adminId);
    const db = this.requireDb();
    const ver = await this.getVersionRow(worldId, versionDir);
    if (!ver) throw new NotFoundException(`版本不存在: ${versionDir}`);

    await db
      .update(communityVersions)
      .set({
        moderation: status,
        isShared: status === 'hidden' ? 'false' : ver.isShared,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(communityVersions.worldId, worldId),
          eq(communityVersions.versionDir, versionDir),
        ),
      );

    return { world_id: worldId, version_dir: versionDir, moderation: status };
  }

  async setOfficial(
    adminId: string,
    worldId: string,
    isOfficial: boolean,
    afterCancel?: 'private' | 'public',
  ) {
    await this.requireAdmin(adminId);
    const db = this.requireDb();
    const row = await this.getWorldRow(worldId);
    if (!row) throw new NotFoundException(`未知世界: ${worldId}`);
    if (row.moderation === 'hidden' && isOfficial) {
      throw new BadRequestException('请先取消审核隐藏再设为官方');
    }

    if (isOfficial) {
      await db
        .update(communityWorlds)
        .set({
          isOfficial: 'true',
          isShared: 'true',
          ownerPlayerId: null,
          updatedAt: new Date(),
        })
        .where(eq(communityWorlds.worldId, worldId));
      await db
        .update(communityVersions)
        .set({ isShared: 'true', updatedAt: new Date() })
        .where(eq(communityVersions.worldId, worldId));
      return { world_id: worldId, is_official: true };
    }

    if (!afterCancel) {
      throw new BadRequestException(
        '取消官方时请指定 afterCancel=private|public',
      );
    }
    const share = afterCancel === 'public';
    await db
      .update(communityWorlds)
      .set({
        isOfficial: 'false',
        ownerPlayerId: adminId,
        isShared: flagStr(share),
        updatedAt: new Date(),
      })
      .where(eq(communityWorlds.worldId, worldId));
    await db
      .update(communityVersions)
      .set({
        isShared: flagStr(share),
        ownerPlayerId: adminId,
        updatedAt: new Date(),
      })
      .where(eq(communityVersions.worldId, worldId));

    return {
      world_id: worldId,
      is_official: false,
      owner_player_id: adminId,
      is_shared: share,
    };
  }

  async moveWorldToTrash(
    actorId: string,
    worldId: string,
    scope: 'user' | 'admin',
  ) {
    if (scope === 'admin') await this.requireAdmin(actorId);
    else await this.assertCanEditWorld(actorId, worldId);

    const db = this.requireDb();
    const row = await this.getWorldRow(worldId);
    if (!row) throw new NotFoundException(`未知世界: ${worldId}`);
    if (flagTrue(row.isOfficial)) {
      throw new BadRequestException('不能删除官方世界；请先取消官方标记');
    }
    if (scope === 'user' && row.ownerPlayerId !== actorId) {
      throw new ForbiddenException('只能删除自己的世界');
    }

    const vers = await db
      .select()
      .from(communityVersions)
      .where(eq(communityVersions.worldId, worldId));

    await db.transaction(async (tx) => {
      await tx.insert(communityWorldsTrash).values({
        worldId: row.worldId,
        shortName: row.shortName,
        ownerPlayerId: row.ownerPlayerId,
        description: row.description,
        officialVersionDir: row.officialVersionDir,
        isOfficial: row.isOfficial,
        isShared: row.isShared,
        moderation: row.moderation,
        forkedFromWorldId: row.forkedFromWorldId,
        forkedFromVersionDirs: row.forkedFromVersionDirs,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: new Date(),
        deletedBy: actorId,
        deleteScope: scope,
      });
      if (vers.length > 0) {
        await tx.insert(communityVersionsTrash).values(
          vers.map((v) => ({
            worldId: v.worldId,
            versionDir: v.versionDir,
            ownerPlayerId: v.ownerPlayerId,
            isShared: v.isShared,
            moderation: v.moderation,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
            deletedAt: new Date(),
            deletedBy: actorId,
            deleteScope: scope,
          })),
        );
      }
      // CASCADE 清 community_versions；磁盘与进度保留
      await tx
        .delete(communityWorlds)
        .where(eq(communityWorlds.worldId, worldId));
    });
    return { world_id: worldId, trashed: true, delete_scope: scope };
  }

  async restoreWorldFromTrash(actorId: string, worldId: string) {
    const db = this.requireDb();
    const rows = await db
      .select()
      .from(communityWorldsTrash)
      .where(eq(communityWorldsTrash.worldId, worldId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException(`回收站中无此世界: ${worldId}`);

    const admin = await this.isAdmin(actorId);
    if (row.deleteScope === 'admin' && !admin) {
      throw new ForbiddenException('仅管理员可恢复审核删除的世界');
    }
    if (
      row.deleteScope === 'user' &&
      !admin &&
      row.deletedBy !== actorId &&
      row.ownerPlayerId !== actorId
    ) {
      throw new ForbiddenException('只能恢复自己删除的世界');
    }
    if (await this.getWorldRow(worldId)) {
      throw new BadRequestException(`世界已存在，无法恢复: ${worldId}`);
    }

    const vers = await db
      .select()
      .from(communityVersionsTrash)
      .where(eq(communityVersionsTrash.worldId, worldId));

    await db.transaction(async (tx) => {
      await tx.insert(communityWorlds).values({
        worldId: row.worldId,
        shortName: row.shortName,
        ownerPlayerId: row.ownerPlayerId,
        description: row.description,
        officialVersionDir: row.officialVersionDir,
        isOfficial: 'false',
        isShared: row.isShared,
        moderation: row.moderation === 'hidden' ? 'normal' : row.moderation,
        forkedFromWorldId: row.forkedFromWorldId,
        forkedFromVersionDirs: row.forkedFromVersionDirs,
        createdAt: row.createdAt,
        updatedAt: new Date(),
      });
      if (vers.length > 0) {
        await tx.insert(communityVersions).values(
          vers.map((v) => ({
            worldId: v.worldId,
            versionDir: v.versionDir,
            ownerPlayerId: v.ownerPlayerId,
            isShared: v.isShared,
            moderation: v.moderation === 'hidden' ? 'normal' : v.moderation,
            createdAt: v.createdAt,
            updatedAt: new Date(),
          })),
        );
      }
      await tx
        .delete(communityVersionsTrash)
        .where(eq(communityVersionsTrash.worldId, worldId));
      await tx
        .delete(communityWorldsTrash)
        .where(eq(communityWorldsTrash.worldId, worldId));
    });
    return { world_id: worldId, restored: true };
  }

  async purgeWorldFromTrash(adminId: string, worldId: string) {
    await this.requireAdmin(adminId);
    const db = this.requireDb();
    const rows = await db
      .select()
      .from(communityWorldsTrash)
      .where(eq(communityWorldsTrash.worldId, worldId))
      .limit(1);
    if (!rows[0]) throw new NotFoundException(`回收站中无此世界: ${worldId}`);
    await db
      .delete(communityVersionsTrash)
      .where(eq(communityVersionsTrash.worldId, worldId));
    await db
      .delete(communityWorldsTrash)
      .where(eq(communityWorldsTrash.worldId, worldId));
    // 调用方负责删磁盘；进度行保留
    return { world_id: worldId, purged: true };
  }

  async listTrash(actorId: string) {
    const db = this.requireDb();
    const admin = await this.isAdmin(actorId);
    const rows = await db.select().from(communityWorldsTrash);
    return rows
      .filter(
        (r) =>
          admin ||
          (r.deleteScope === 'user' &&
            (r.deletedBy === actorId || r.ownerPlayerId === actorId)),
      )
      .map((r) => ({
        world_id: r.worldId,
        short_name: r.shortName,
        owner_player_id: r.ownerPlayerId,
        delete_scope: r.deleteScope,
        deleted_at: r.deletedAt.toISOString(),
        deleted_by: r.deletedBy,
      }));
  }

  async setReaction(
    playerId: string,
    worldId: string,
    opts: {
      target: 'world' | 'version';
      versionDir?: string;
      kind: 'like' | 'favorite';
      active: boolean;
    },
  ) {
    const versionDir =
      opts.target === 'world' ? '' : (opts.versionDir ?? '').trim();
    if (opts.target === 'version' && !versionDir) {
      throw new BadRequestException('赞/藏版本时必须提供 versionDir');
    }
    // 须对目标可见（隐藏包不能刷赞）
    if (opts.target === 'world') {
      const worlds = await this.listVisibleWorlds(playerId);
      if (!worlds.some((w) => w.world_id === worldId) && !(await this.isAdmin(playerId))) {
        throw new ForbiddenException('不可见的世界无法点赞/收藏');
      }
    } else if (!(await this.canAccessVersion(playerId, worldId, versionDir))) {
      throw new ForbiddenException('不可见的版本无法点赞/收藏');
    }

    const db = this.requireDb();
    const table = opts.kind === 'like' ? packLikes : packFavorites;
    const key = {
      playerId,
      targetType: opts.target,
      worldId,
      versionDir,
    };
    if (opts.active) {
      await db
        .insert(table)
        .values({ ...key, createdAt: new Date() })
        .onConflictDoNothing();
    } else {
      await db
        .delete(table)
        .where(
          and(
            eq(table.playerId, playerId),
            eq(table.targetType, opts.target),
            eq(table.worldId, worldId),
            eq(table.versionDir, versionDir),
          ),
        );
    }
    return {
      world_id: worldId,
      target: opts.target,
      version_dir: versionDir || null,
      kind: opts.kind,
      active: opts.active,
    };
  }

}
