import { Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import {
  DEFAULT_CHAPTER_STATE,
  type ArchivedMessage,
  type ChapterState,
  type LlmMessage,
  type NpcRuntimeState,
  type PlayerProfile,
  type UpdatePlayerProfilePayload,
} from '@ocraft/shared';
import { DbService } from './db.service';
import {
  conversationArchives,
  conversationSnapshots,
  playerNpcState,
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

@Injectable()
export class PlayerStateRepository {
  private readonly logger = new Logger(PlayerStateRepository.name);

  constructor(private readonly dbService: DbService) {}

  async ensurePlayer(playerId: string): Promise<void> {
    if (!this.dbService.isReady) return;
    const db = this.dbService.db;
    await db
      .insert(players)
      .values({ id: playerId, extra: {} })
      .onConflictDoNothing();
  }

  async getPlayerProfile(playerId: string): Promise<PlayerProfile | null> {
    if (!this.dbService.isReady) return null;
    const db = this.dbService.db;
    const rows = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      realName: row.realName,
      onlineName: row.onlineName,
      jobTitle: row.jobTitle,
      gender: row.gender,
      age: row.age,
      birthday: row.birthday,
      extra: row.extra ?? {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updatePlayerProfile(
    playerId: string,
    patch: Omit<UpdatePlayerProfilePayload, 'playerId'>,
  ): Promise<PlayerProfile | null> {
    if (!this.dbService.isReady) return null;
    await this.ensurePlayer(playerId);
    const db = this.dbService.db;
    const now = new Date();
    const set: Partial<typeof players.$inferInsert> = { updatedAt: now };
    if (patch.realName !== undefined) set.realName = patch.realName;
    if (patch.onlineName !== undefined) set.onlineName = patch.onlineName;
    if (patch.jobTitle !== undefined) set.jobTitle = patch.jobTitle;
    if (patch.gender !== undefined) set.gender = patch.gender;
    if (patch.age !== undefined) set.age = patch.age;
    if (patch.birthday !== undefined) set.birthday = patch.birthday;
    if (patch.extra !== undefined) set.extra = patch.extra;

    await db
      .insert(players)
      .values({
        id: playerId,
        extra: patch.extra ?? {},
        ...set,
      })
      .onConflictDoUpdate({
        target: players.id,
        set,
      });

    return this.getPlayerProfile(playerId);
  }

  async loadSession(
    playerId: string,
    npcId: string,
    defaults: NpcRuntimeState,
  ): Promise<PersistedSessionRow> {
    if (!this.dbService.isReady) {
      return {
        runtime: defaults,
        chapterState: DEFAULT_CHAPTER_STATE,
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
      .where(
        and(
          eq(playerNpcState.playerId, playerId),
          eq(playerNpcState.npcId, npcId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      await db.insert(playerNpcState).values({
        playerId,
        npcId,
        affinity: defaults.affinity,
        fatigue: defaults.fatigue,
        currentStatus: defaults.current_status,
        chapterState: DEFAULT_CHAPTER_STATE,
        recentMessages: [],
        transcriptMessages: [],
      });
      return {
        runtime: defaults,
        chapterState: DEFAULT_CHAPTER_STATE,
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
    npcId: string,
    runtime: NpcRuntimeState,
  ): Promise<void> {
    if (!this.dbService.isReady) return;
    await this.ensurePlayer(playerId);
    const db = this.dbService.db;
    await db
      .insert(playerNpcState)
      .values({
        playerId,
        npcId,
        affinity: runtime.affinity,
        fatigue: runtime.fatigue,
        currentStatus: runtime.current_status,
        chapterState: DEFAULT_CHAPTER_STATE,
      })
      .onConflictDoUpdate({
        target: [playerNpcState.playerId, playerNpcState.npcId],
        set: {
          affinity: runtime.affinity,
          fatigue: runtime.fatigue,
          currentStatus: runtime.current_status,
        },
      });
  }

  async saveChapterState(
    playerId: string,
    npcId: string,
    chapterState: ChapterState,
  ): Promise<void> {
    if (!this.dbService.isReady) return;
    await this.ensurePlayer(playerId);
    const db = this.dbService.db;
    await db
      .update(playerNpcState)
      .set({ chapterState })
      .where(
        and(
          eq(playerNpcState.playerId, playerId),
          eq(playerNpcState.npcId, npcId),
        ),
      );
  }

  async saveConversationBuffers(
    playerId: string,
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
      .where(
        and(
          eq(playerNpcState.playerId, playerId),
          eq(playerNpcState.npcId, npcId),
        ),
      );
  }

  async saveFullSession(
    playerId: string,
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
        target: [playerNpcState.playerId, playerNpcState.npcId],
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
