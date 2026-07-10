import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type {
  ArchivedMessage,
  ArchivedNpcState,
  ConversationArchiveSummary,
} from '@ocraft/shared';
import { PlayerStateRepository } from '../db/player-state.repository';
import {
  conversationArchives,
  conversationSnapshots,
} from '../db/schema';

export interface ConversationSnapshot {
  saved_at: string;
  npc_state: ArchivedNpcState;
  messages: ArchivedMessage[];
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

  async createSessionArchive(
    playerId: string,
    npcId: string,
    sessionStartedAt: string,
    snapshot: ConversationSnapshot,
  ): Promise<string> {
    const started = new Date(sessionStartedAt);
    const stamp = this.formatFileStamp(started);
    const filename = await this.nextFilename(playerId, stamp);
    const db = this.requireDb();

    const [archive] = await db
      .insert(conversationArchives)
      .values({
        playerId,
        npcId,
        filename,
        sessionStartedAt: started,
      })
      .returning();

    await db.insert(conversationSnapshots).values({
      archiveId: archive.id,
      snapshotIndex: 0,
      savedAt: new Date(snapshot.saved_at),
      npcState: snapshot.npc_state,
      messages: snapshot.messages,
    });

    this.logger.log(
      `Created archive player=${playerId} npc=${npcId} → ${filename} (snapshot 0)`,
    );
    return filename;
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
    });

    this.logger.log(`Appended snapshot ${snapshotIndex} → ${filename}`);
    return snapshotIndex;
  }

  async listArchives(
    playerId: string,
    npcId: string,
  ): Promise<ConversationArchiveSummary[]> {
    if (!this.playerStateRepo.ready) {
      return [];
    }

    const db = this.requireDb();
    const archives = await db
      .select()
      .from(conversationArchives)
      .where(
        and(
          eq(conversationArchives.playerId, playerId),
          eq(conversationArchives.npcId, npcId),
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
        session_started_at: archive.sessionStartedAt.toISOString(),
        snapshots: snapshots.map((snap) => ({
          index: snap.snapshotIndex,
          saved_at: snap.savedAt.toISOString(),
          message_count: snap.messages.length,
          npc_state: {
            ...snap.npcState,
            story_flags: snap.npcState.story_flags ?? {},
          },
        })),
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
  ): Promise<{ snapshot: ConversationSnapshot }> {
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

    return {
      snapshot: {
        saved_at: row.savedAt.toISOString(),
        npc_state: {
          ...row.npcState,
          story_flags: row.npcState.story_flags ?? {},
        },
        messages: row.messages,
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
