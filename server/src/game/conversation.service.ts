import { Injectable } from '@nestjs/common';
import * as path from 'path';
import {
  type ChapterState,
  DEFAULT_CHAPTER_STATE,
  type LlmMessage,
  type NpcRuntimeState,
} from '@ocraft/shared';
import { PlayerStateRepository } from '../db/player-state.repository';
import { NpcService } from '../npc/npc.service';
import {
  ConversationArchiveService,
  type ConversationSnapshot,
} from './conversation-archive.service';

const MAX_HISTORY_TURNS = 6;

interface SessionTranscript {
  startedAt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; at: string }>;
}

export interface SaveSnapshotResult {
  filename: string;
  snapshotIndex: number;
  savedAt: string;
}

export interface RestoreSnapshotResult {
  filename: string;
  snapshotIndex: number;
  messages: SessionTranscript['messages'];
  npcState: NpcRuntimeState;
  chapterState: ChapterState;
}

@Injectable()
export class ConversationService {
  /** key: `${playerId}:${npcId}` */
  private readonly history = new Map<string, LlmMessage[]>();
  private readonly chapterStates = new Map<string, ChapterState>();
  private readonly transcripts = new Map<string, SessionTranscript>();
  private readonly sessionArchiveFiles = new Map<string, string>();
  private readonly hydrated = new Set<string>();

  constructor(
    private readonly archiveService: ConversationArchiveService,
    private readonly playerStateRepo: PlayerStateRepository,
    private readonly npcService: NpcService,
  ) {}

  private key(playerId: string, npcId: string) {
    return `${playerId}:${npcId}`;
  }

  async ensureSession(playerId: string, npcId: string): Promise<void> {
    const k = this.key(playerId, npcId);
    if (this.hydrated.has(k)) {
      return;
    }

    const defaults = this.npcService.getDefaultRuntimeState(npcId);
    const session = await this.playerStateRepo.loadSession(
      playerId,
      npcId,
      defaults,
    );

    await this.npcService.hydrateRuntime(playerId, npcId);
    this.chapterStates.set(k, session.chapterState);
    this.history.set(k, session.recentMessages);

    if (session.transcriptMessages.length > 0) {
      this.transcripts.set(k, {
        startedAt:
          session.sessionStartedAt ??
          session.transcriptMessages[0]?.at ??
          new Date().toISOString(),
        messages: session.transcriptMessages,
      });
    }

    if (session.activeArchiveFilename) {
      this.sessionArchiveFiles.set(k, session.activeArchiveFilename);
    }

    this.hydrated.add(k);
  }

  private async persistSession(playerId: string, npcId: string) {
    const k = this.key(playerId, npcId);
    const transcript = this.transcripts.get(k);
    await this.playerStateRepo.saveFullSession(playerId, npcId, {
      runtime: this.npcService.getRuntimeState(playerId, npcId),
      chapterState: this.getChapterState(playerId, npcId),
      recentMessages: this.history.get(k) ?? [],
      transcriptMessages: transcript?.messages ?? [],
      sessionStartedAt: transcript?.startedAt ?? null,
      activeArchiveFilename: this.sessionArchiveFiles.get(k) ?? null,
    });
  }

  getChapterState(playerId: string, npcId: string): ChapterState {
    return this.chapterStates.get(this.key(playerId, npcId)) ?? DEFAULT_CHAPTER_STATE;
  }

  async setChapterState(
    playerId: string,
    npcId: string,
    state: ChapterState,
  ): Promise<ChapterState> {
    const k = this.key(playerId, npcId);
    this.chapterStates.set(k, state);
    await this.playerStateRepo.saveChapterState(playerId, npcId, state);
    return state;
  }

  getRecentTurns(playerId: string, npcId: string): LlmMessage[] {
    return this.history.get(this.key(playerId, npcId)) ?? [];
  }

  async appendTurn(
    playerId: string,
    npcId: string,
    role: 'user' | 'assistant',
    content: string,
  ) {
    const k = this.key(playerId, npcId);
    const now = new Date().toISOString();

    let transcript = this.transcripts.get(k);
    if (!transcript) {
      transcript = { startedAt: now, messages: [] };
      this.transcripts.set(k, transcript);
    }
    transcript.messages.push({ role, content, at: now });

    const list = this.history.get(k) ?? [];
    list.push({ role, content });
    while (list.length > MAX_HISTORY_TURNS * 2) {
      list.shift();
    }
    this.history.set(k, list);
    await this.persistSession(playerId, npcId);
  }

  buildDialogMessages(
    playerId: string,
    npcId: string,
    systemContent: string,
    userMessage: string,
  ): LlmMessage[] {
    const history = this.getRecentTurns(playerId, npcId);
    return [
      { role: 'system', content: systemContent },
      ...history,
      { role: 'user', content: userMessage },
    ];
  }

  async saveSnapshot(
    playerId: string,
    npcId: string,
    npcState: NpcRuntimeState,
  ): Promise<SaveSnapshotResult | null> {
    const k = this.key(playerId, npcId);
    const transcript = this.transcripts.get(k);
    if (!transcript || transcript.messages.length === 0) {
      return null;
    }

    const savedAt = new Date().toISOString();
    const snapshot: ConversationSnapshot = {
      saved_at: savedAt,
      npc_state: {
        affinity: npcState.affinity,
        fatigue: npcState.fatigue,
        current_status: npcState.current_status,
        chapter_state: this.getChapterState(playerId, npcId),
      },
      messages: [...transcript.messages],
    };

    const existingFile = this.sessionArchiveFiles.get(k);
    let filename: string;
    let snapshotIndex: number;

    if (existingFile) {
      filename = existingFile;
      snapshotIndex = await this.archiveService.appendSnapshot(
        playerId,
        filename,
        snapshot,
      );
    } else {
      filename = await this.archiveService.createSessionArchive(
        playerId,
        npcId,
        transcript.startedAt,
        snapshot,
      );
      snapshotIndex = 0;
      this.sessionArchiveFiles.set(k, filename);
    }

    await this.persistSession(playerId, npcId);
    return { filename, snapshotIndex, savedAt };
  }

  async restoreSnapshot(
    playerId: string,
    npcId: string,
    filename: string,
    snapshotIndex: number,
  ): Promise<RestoreSnapshotResult> {
    const { snapshot } = await this.archiveService.loadSnapshot(
      playerId,
      filename,
      snapshotIndex,
    );
    const k = this.key(playerId, npcId);
    const safeFilename = path.basename(filename);

    const messages = [...snapshot.messages];
    const transcript: SessionTranscript = {
      startedAt: messages[0]?.at ?? new Date().toISOString(),
      messages,
    };
    this.transcripts.set(k, transcript);

    const history: LlmMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    while (history.length > MAX_HISTORY_TURNS * 2) {
      history.shift();
    }
    this.history.set(k, history);

    this.chapterStates.set(k, snapshot.npc_state.chapter_state);
    this.sessionArchiveFiles.set(k, safeFilename);
    this.hydrated.add(k);

    await this.playerStateRepo.saveFullSession(playerId, npcId, {
      runtime: {
        affinity: snapshot.npc_state.affinity,
        fatigue: snapshot.npc_state.fatigue,
        current_status: snapshot.npc_state.current_status,
      },
      chapterState: snapshot.npc_state.chapter_state,
      recentMessages: history,
      transcriptMessages: messages,
      sessionStartedAt: transcript.startedAt,
      activeArchiveFilename: safeFilename,
    });

    return {
      filename: safeFilename,
      snapshotIndex,
      messages,
      npcState: {
        affinity: snapshot.npc_state.affinity,
        fatigue: snapshot.npc_state.fatigue,
        current_status: snapshot.npc_state.current_status,
      },
      chapterState: snapshot.npc_state.chapter_state,
    };
  }

  async listArchives(playerId: string, npcId: string) {
    return this.archiveService.listArchives(playerId, npcId);
  }

  clear(playerId: string, npcId: string) {
    const k = this.key(playerId, npcId);
    this.history.delete(k);
    this.chapterStates.delete(k);
    this.transcripts.delete(k);
    this.sessionArchiveFiles.delete(k);
    this.hydrated.delete(k);
  }
}
