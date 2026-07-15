import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type {
  ArchivedMessage,
  ArchivedNpcState,
  ArchiveScope,
  ConversationArchiveSummary,
  ConversationSnapshotV2,
} from '@ocraft/shared';
import { PlayerStateRepository } from '../db/player-state.repository';
import type { AppDatabase } from '../db/db.service';
import {
  conversationArchives,
  conversationSnapshots,
} from '../db/schema';
import { migrateSave } from './save-migrate';

/** 内存/返回用：统一带上可选 v2 payload */
export interface ConversationSnapshot {
  saved_at: string;
  npc_state: ArchivedNpcState;
  messages: ArchivedMessage[];
  payload?: ConversationSnapshotV2 | null;
}

export interface CreateArchiveOpts {
  playerId: string;
  /** 焦点 NPC（run 档也写，便于兼容） */
  npcId: string;
  sessionStartedAt: string;
  snapshot: ConversationSnapshot;
  displayName?: string;
  scope?: ArchiveScope;
  worldId?: string;
  packVersionId?: string;
}

@Injectable()
export class ConversationArchiveService {
  private readonly logger = new Logger(ConversationArchiveService.name);

  constructor(private readonly playerStateRepo: PlayerStateRepository) {}

  private requireDb() {
    if (!this.playerStateRepo.ready) {
      throw new Error(
        'Database not available. Set DATABASE_URL and run npm run db:migrate.',
      );
    }
    return this.playerStateRepo.db;
  }

  async createSessionArchive(opts: CreateArchiveOpts): Promise<string> {
    const {
      playerId,
      npcId,
      sessionStartedAt,
      snapshot,
      displayName,
      scope = 'npc',
      worldId,
      packVersionId,
    } = opts;
    const started = new Date(sessionStartedAt);
    const stamp = this.formatFileStamp(started);
    const filename = await this.nextFilename(playerId, stamp);
    const db = this.requireDb();
    const payload = snapshot.payload ?? null;

    const [archive] = await db
      .insert(conversationArchives)
      .values({
        playerId,
        npcId,
        filename,
        displayName: displayName?.trim() || null,
        sessionStartedAt: started,
        scope,
        worldId: worldId ?? null,
        packVersionId: packVersionId ?? null,
      })
      .returning();

    await db.insert(conversationSnapshots).values({
      archiveId: archive.id,
      snapshotIndex: 0,
      savedAt: new Date(snapshot.saved_at),
      npcState: snapshot.npc_state,
      messages: snapshot.messages,
      payload,
    });

    this.logger.log(
      `Created archive player=${playerId} scope=${scope} npc=${npcId} → ${filename} (snapshot 0)`,
    );
    return filename;
  }

  async renameArchive(
    playerId: string,
    filename: string,
    displayName: string,
  ): Promise<{ filename: string; display_name: string }> {
    const archive = await this.playerStateRepo.findArchiveByFilename(
      playerId,
      filename,
    );
    if (!archive) {
      throw new NotFoundException(`Archive not found: ${filename}`);
    }
    const name = displayName.trim();
    if (!name) {
      throw new Error('存档名不能为空');
    }
    const db = this.requireDb();
    await db
      .update(conversationArchives)
      .set({ displayName: name })
      .where(eq(conversationArchives.id, archive.id));
    return { filename, display_name: name };
  }

  async appendSnapshot(
    playerId: string,
    filename: string,
    snapshot: ConversationSnapshot,
  ): Promise<number> {
    const archive = await this.playerStateRepo.findArchiveByFilename(
      playerId,
      filename,
    );
    if (!archive) {
      throw new NotFoundException(`Archive not found: ${filename}`);
    }

    const db = this.requireDb();
    const existing = await db
      .select()
      .from(conversationSnapshots)
      .where(eq(conversationSnapshots.archiveId, archive.id));

    const snapshotIndex = existing.length;
    await db.insert(conversationSnapshots).values({
      archiveId: archive.id,
      snapshotIndex,
      savedAt: new Date(snapshot.saved_at),
      npcState: snapshot.npc_state,
      messages: snapshot.messages,
      payload: snapshot.payload ?? null,
    });

    this.logger.log(`Appended snapshot ${snapshotIndex} → ${filename}`);
    return snapshotIndex;
  }

  /** 自动存：覆盖该档最新快照（不新增历史点，避免每句对话涨一条） */
  async upsertLatestSnapshot(
    playerId: string,
    filename: string,
    snapshot: ConversationSnapshot,
    tx?: AppDatabase,
  ): Promise<number> {
    const archive = await this.playerStateRepo.findArchiveByFilename(
      playerId,
      filename,
    );
    if (!archive) {
      throw new NotFoundException(`Archive not found: ${filename}`);
    }

    const db = tx ?? this.requireDb();
    const existing = await db
      .select()
      .from(conversationSnapshots)
      .where(eq(conversationSnapshots.archiveId, archive.id))
      .orderBy(conversationSnapshots.snapshotIndex);

    if (existing.length === 0) {
      await db.insert(conversationSnapshots).values({
        archiveId: archive.id,
        snapshotIndex: 0,
        savedAt: new Date(snapshot.saved_at),
        npcState: snapshot.npc_state,
        messages: snapshot.messages,
        payload: snapshot.payload ?? null,
      });
      return 0;
    }

    const last = existing[existing.length - 1]!;
    await db
      .update(conversationSnapshots)
      .set({
        savedAt: new Date(snapshot.saved_at),
        npcState: snapshot.npc_state,
        messages: snapshot.messages,
        payload: snapshot.payload ?? null,
      })
      .where(eq(conversationSnapshots.id, last.id));

    return last.snapshotIndex;
  }

  /**
   * 列表：仅当前包的「整局」档（由新开一局 / 读档激活后自动更新）
   */
  async listArchives(
    playerId: string,
    _npcId: string,
    pack?: { worldId: string; packVersionId: string },
  ): Promise<ConversationArchiveSummary[]> {
    if (!this.playerStateRepo.ready) {
      return [];
    }
    if (!pack) {
      return [];
    }

    const db = this.requireDb();
    const archives = await db
      .select()
      .from(conversationArchives)
      .where(
        and(
          eq(conversationArchives.playerId, playerId),
          eq(conversationArchives.scope, 'run'),
          eq(conversationArchives.worldId, pack.worldId),
          eq(conversationArchives.packVersionId, pack.packVersionId),
        ),
      );

    const summaries: ConversationArchiveSummary[] = [];

    for (const archive of archives) {
      const snapshots = await db
        .select()
        .from(conversationSnapshots)
        .where(eq(conversationSnapshots.archiveId, archive.id))
        .orderBy(conversationSnapshots.snapshotIndex);

      summaries.push({
        filename: archive.filename,
        display_name: archive.displayName ?? undefined,
        session_started_at: archive.sessionStartedAt.toISOString(),
        scope: 'run',
        snapshots: snapshots.map((snap) => {
          const worldChapter = snap.payload?.world?.chapter_state;
          const worldFlags = snap.payload?.world?.story_flags;
          return {
            index: snap.snapshotIndex,
            saved_at: snap.savedAt.toISOString(),
            message_count:
              snap.payload?.messages?.length ?? snap.messages.length,
            npc_state: {
              ...snap.npcState,
              chapter_state: worldChapter ?? snap.npcState.chapter_state,
              story_flags:
                worldFlags ?? snap.npcState.story_flags ?? {},
            },
          };
        }),
      });
    }

    summaries.sort((a, b) =>
      b.session_started_at.localeCompare(a.session_started_at),
    );
    return summaries;
  }

  async loadSnapshot(
    playerId: string,
    filename: string,
    snapshotIndex: number,
  ): Promise<{
    snapshot: ConversationSnapshot;
    scope: ArchiveScope;
    archiveNpcId: string;
  }> {
    const archive = await this.playerStateRepo.findArchiveByFilename(
      playerId,
      filename,
    );
    if (!archive) {
      throw new NotFoundException(`Archive not found: ${filename}`);
    }

    const db = this.requireDb();
    const rows = await db
      .select()
      .from(conversationSnapshots)
      .where(
        and(
          eq(conversationSnapshots.archiveId, archive.id),
          eq(conversationSnapshots.snapshotIndex, snapshotIndex),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      throw new NotFoundException(
        `Snapshot ${snapshotIndex} not found in ${filename}`,
      );
    }

    let payload: ConversationSnapshotV2 | null = null;
    if (row.payload) {
      payload = migrateSave(row.payload);
    }

    return {
      scope: (archive.scope as ArchiveScope) ?? 'npc',
      archiveNpcId: archive.npcId,
      snapshot: {
        saved_at: row.savedAt.toISOString(),
        npc_state: {
          ...row.npcState,
          story_flags: row.npcState.story_flags ?? {},
        },
        messages: row.messages,
        payload,
      },
    };
  }

  private formatFileStamp(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }

  private async nextFilename(playerId: string, stamp: string): Promise<string> {
    const prefix = `${stamp}V`;
    const existing = await this.playerStateRepo.listArchiveFilenames(playerId);
    let version = 1;
    for (const name of existing) {
      if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
      const match = name.match(/^(\d{8})V(\d+)\.json$/);
      if (match?.[1] === stamp) {
        version = Math.max(version, Number(match[2]) + 1);
      }
    }
    return `${stamp}V${version}.json`;
  }
}
