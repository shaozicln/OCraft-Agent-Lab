import { Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import {
  type ArchivedMessage,
  type ChapterState,
  type LlmMessage,
  type NpcRuntimeState,
  type PlayerExtra,
  type PlayerGender,
  type PlayerPackProfile,
} from '@ocraft/shared';
import { DbService } from './db.service';
import {
  conversationArchives,
  conversationSnapshots,
  playerNpcState,
  playerPackProfiles,
  players,
} from './schema';

export interface PersistedSessionRow {
  runtime: NpcRuntimeState;
  chapterState: ChapterState;
  recentMessages: LlmMessage[];
  transcriptMessages: ArchivedMessage[];
  sessionStartedAt: string | null;
  activeArchiveFilename: string | null;
}

function emptyPackProfile(
  playerId: string,
  worldId: string,
  packVersionId: string,
): PlayerPackProfile {
  return {
    playerId,
    worldId,
    packVersionId,
    realName: null,
    onlineName: null,
    jobTitle: null,
    gender: null,
    age: null,
    birthday: null,
    extra: {},
    updatedAt: new Date(0).toISOString(),
  };
}

@Injectable()
export class PlayerStateRepository {
  private readonly logger = new Logger(PlayerStateRepository.name);

  constructor(private readonly dbService: DbService) {}

  async ensurePlayer(playerId: string): Promise<void> {
    if (!this.dbService.isReady) return;
    const db = this.dbService.db;
    await db.insert(players).values({ id: playerId }).onConflictDoNothing();
  }

  async getPackProfile(
    playerId: string,
    worldId: string,
    packVersionId: string,
  ): Promise<PlayerPackProfile | null> {
    if (!this.dbService.isReady) return null;
    await this.ensurePlayer(playerId);
    const db = this.dbService.db;
    const rows = await db
      .select()
      .from(playerPackProfiles)
      .where(
        and(
          eq(playerPackProfiles.playerId, playerId),
          eq(playerPackProfiles.worldId, worldId),
          eq(playerPackProfiles.packVersionId, packVersionId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return emptyPackProfile(playerId, worldId, packVersionId);
    return {
      playerId: row.playerId,
      worldId: row.worldId,
      packVersionId: row.packVersionId,
      realName: row.realName,
      onlineName: row.onlineName,
      jobTitle: row.jobTitle,
      gender: row.gender,
      age: row.age,
      birthday: row.birthday,
      extra: row.extra ?? {},
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updatePackProfile(
    playerId: string,
    worldId: string,
    packVersionId: string,
    patch: {
      realName?: string | null;
      onlineName?: string | null;
      jobTitle?: string | null;
      gender?: PlayerGender | null;
      age?: number | null;
      birthday?: string | null;
      extra?: PlayerExtra;
    },
  ): Promise<PlayerPackProfile | null> {
    if (!this.dbService.isReady) return null;
    await this.ensurePlayer(playerId);
    const db = this.dbService.db;
    const now = new Date();
    const existing = await this.getPackProfile(playerId, worldId, packVersionId);
    const next = {
      realName:
        patch.realName !== undefined ? patch.realName : (existing?.realName ?? null),
      onlineName:
        patch.onlineName !== undefined
          ? patch.onlineName
          : (existing?.onlineName ?? null),
      jobTitle:
        patch.jobTitle !== undefined ? patch.jobTitle : (existing?.jobTitle ?? null),
      gender: patch.gender !== undefined ? patch.gender : (existing?.gender ?? null),
      age: patch.age !== undefined ? patch.age : (existing?.age ?? null),
      birthday:
        patch.birthday !== undefined ? patch.birthday : (existing?.birthday ?? null),
      extra: patch.extra !== undefined ? patch.extra : (existing?.extra ?? {}),
    };

    await db
      .insert(playerPackProfiles)
      .values({
        playerId,
        worldId,
        packVersionId,
        ...next,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          playerPackProfiles.playerId,
          playerPackProfiles.worldId,
          playerPackProfiles.packVersionId,
        ],
        set: { ...next, updatedAt: now },
      });

    return this.getPackProfile(playerId, worldId, packVersionId);
  }

  private sessionWhere(
    playerId: string,
    worldId: string,
    packVersionId: string,
    npcId: string,
  ) {
    return and(
      eq(playerNpcState.playerId, playerId),
      eq(playerNpcState.worldId, worldId),
      eq(playerNpcState.packVersionId, packVersionId),
      eq(playerNpcState.npcId, npcId),
    );
  }

  async loadSession(
    playerId: string,
    worldId: string,
    packVersionId: string,
    npcId: string,
    defaults: NpcRuntimeState,
    defaultChapter: ChapterState,
  ): Promise<PersistedSessionRow> {
    if (!this.dbService.isReady) {
      return {
        runtime: defaults,
        chapterState: defaultChapter,
        recentMessages: [],
        transcriptMessages: [],
        sessionStartedAt: null,
        activeArchiveFilename: null,
      };
    }

    await this.ensurePlayer(playerId);
    const db = this.dbService.db;
    const rows = await db
      .select()
      .from(playerNpcState)
      .where(this.sessionWhere(playerId, worldId, packVersionId, npcId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      await db.insert(playerNpcState).values({
        playerId,
        worldId,
        packVersionId,
        npcId,
        affinity: defaults.affinity,
        fatigue: defaults.fatigue,
        currentStatus: defaults.current_status,
        chapterState: defaultChapter,
        recentMessages: [],
        transcriptMessages: [],
      });
      return {
        runtime: defaults,
        chapterState: defaultChapter,
        recentMessages: [],
        transcriptMessages: [],
        sessionStartedAt: null,
        activeArchiveFilename: null,
      };
    }

    return {
      runtime: {
        affinity: row.affinity,
        fatigue: row.fatigue,
        current_status: row.currentStatus,
      },
      chapterState: row.chapterState,
      recentMessages: row.recentMessages ?? [],
      transcriptMessages: row.transcriptMessages ?? [],
      sessionStartedAt: row.sessionStartedAt?.toISOString() ?? null,
      activeArchiveFilename: row.activeArchiveFilename,
    };
  }

  async saveRuntime(
    playerId: string,
    worldId: string,
    packVersionId: string,
    npcId: string,
    runtime: NpcRuntimeState,
    defaultChapter: ChapterState,
  ): Promise<void> {
    if (!this.dbService.isReady) return;
    await this.ensurePlayer(playerId);
    const db = this.dbService.db;
    await db
      .insert(playerNpcState)
      .values({
        playerId,
        worldId,
        packVersionId,
        npcId,
        affinity: runtime.affinity,
        fatigue: runtime.fatigue,
        currentStatus: runtime.current_status,
        chapterState: defaultChapter,
      })
      .onConflictDoUpdate({
        target: [
          playerNpcState.playerId,
          playerNpcState.worldId,
          playerNpcState.packVersionId,
          playerNpcState.npcId,
        ],
        set: {
          affinity: runtime.affinity,
          fatigue: runtime.fatigue,
          currentStatus: runtime.current_status,
        },
      });
  }

  async saveChapterState(
    playerId: string,
    worldId: string,
    packVersionId: string,
    npcId: string,
    chapterState: ChapterState,
  ): Promise<void> {
    if (!this.dbService.isReady) return;
    await this.ensurePlayer(playerId);
    const db = this.dbService.db;
    await db
      .update(playerNpcState)
      .set({ chapterState })
      .where(this.sessionWhere(playerId, worldId, packVersionId, npcId));
  }

  async saveConversationBuffers(
    playerId: string,
    worldId: string,
    packVersionId: string,
    npcId: string,
    data: {
      recentMessages: LlmMessage[];
      transcriptMessages: ArchivedMessage[];
      sessionStartedAt?: string | null;
      activeArchiveFilename?: string | null;
    },
  ): Promise<void> {
    if (!this.dbService.isReady) return;
    const db = this.dbService.db;
    await db
      .update(playerNpcState)
      .set({
        recentMessages: data.recentMessages,
        transcriptMessages: data.transcriptMessages,
        ...(data.sessionStartedAt !== undefined && {
          sessionStartedAt: data.sessionStartedAt
            ? new Date(data.sessionStartedAt)
            : null,
        }),
        ...(data.activeArchiveFilename !== undefined && {
          activeArchiveFilename: data.activeArchiveFilename,
        }),
      })
      .where(this.sessionWhere(playerId, worldId, packVersionId, npcId));
  }

  async saveFullSession(
    playerId: string,
    worldId: string,
    packVersionId: string,
    npcId: string,
    data: {
      runtime: NpcRuntimeState;
      chapterState: ChapterState;
      recentMessages: LlmMessage[];
      transcriptMessages: ArchivedMessage[];
      sessionStartedAt?: string | null;
      activeArchiveFilename?: string | null;
    },
  ): Promise<void> {
    if (!this.dbService.isReady) return;
    await this.ensurePlayer(playerId);
    const db = this.dbService.db;
    await db
      .insert(playerNpcState)
      .values({
        playerId,
        worldId,
        packVersionId,
        npcId,
        affinity: data.runtime.affinity,
        fatigue: data.runtime.fatigue,
        currentStatus: data.runtime.current_status,
        chapterState: data.chapterState,
        recentMessages: data.recentMessages,
        transcriptMessages: data.transcriptMessages,
        sessionStartedAt: data.sessionStartedAt
          ? new Date(data.sessionStartedAt)
          : null,
        activeArchiveFilename: data.activeArchiveFilename ?? null,
      })
      .onConflictDoUpdate({
        target: [
          playerNpcState.playerId,
          playerNpcState.worldId,
          playerNpcState.packVersionId,
          playerNpcState.npcId,
        ],
        set: {
          affinity: data.runtime.affinity,
          fatigue: data.runtime.fatigue,
          currentStatus: data.runtime.current_status,
          chapterState: data.chapterState,
          recentMessages: data.recentMessages,
          transcriptMessages: data.transcriptMessages,
          sessionStartedAt: data.sessionStartedAt
            ? new Date(data.sessionStartedAt)
            : null,
          activeArchiveFilename: data.activeArchiveFilename ?? null,
        },
      });
  }

  async findArchiveByFilename(playerId: string, filename: string) {
    if (!this.dbService.isReady) return null;
    const db = this.dbService.db;
    const rows = await db
      .select()
      .from(conversationArchives)
      .where(
        and(
          eq(conversationArchives.playerId, playerId),
          eq(conversationArchives.filename, filename),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async listArchiveFilenames(playerId: string, npcId?: string): Promise<string[]> {
    if (!this.dbService.isReady) return [];
    const db = this.dbService.db;
    const conditions = [eq(conversationArchives.playerId, playerId)];
    if (npcId) {
      conditions.push(eq(conversationArchives.npcId, npcId));
    }
    const rows = await db
      .select({ filename: conversationArchives.filename })
      .from(conversationArchives)
      .where(and(...conditions));
    return rows.map((r) => r.filename);
  }

  get conversationArchives() {
    return conversationArchives;
  }

  get conversationSnapshots() {
    return conversationSnapshots;
  }

  get db() {
    return this.dbService.db;
  }

  get ready() {
    return this.dbService.isReady;
  }
}
