import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import {
  getFirstChapterId,
  type ChapterState,
  type LlmMessage,
  type NpcRuntimeState,
  type StartNewRunPayload,
  type StoryFlagsSnapshot,
  type StoryMapEvent,
} from '@ocraft/shared';
import { PlayerStateRepository } from '../db/player-state.repository';
import { NpcService } from '../npc/npc.service';
import { PackService } from '../story/pack.service';
import { StoryFlagService } from '../story/story-flag.service';
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
  storyFlags: StoryFlagsSnapshot;
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  /** key: PackService.sessionKey(playerId, npcId) */
  private readonly history = new Map<string, LlmMessage[]>();
  private readonly chapterStates = new Map<string, ChapterState>();
  private readonly transcripts = new Map<string, SessionTranscript>();
  private readonly sessionArchiveFiles = new Map<string, string>();
  private readonly hydrated = new Set<string>();

  constructor(
    private readonly archiveService: ConversationArchiveService,
    private readonly playerStateRepo: PlayerStateRepository,
    private readonly npcService: NpcService,
    private readonly storyFlagService: StoryFlagService,
    private readonly packService: PackService,
  ) {}

  private key(playerId: string, npcId: string) {
    return this.packService.sessionKey(playerId, npcId);
  }

  private progressKey() {
    return this.packService.getProgressKey();
  }

  private defaultChapter(): ChapterState {
    return this.packService.getDefaultChapter();
  }

  /** 进度里的章节必须属于当前 Pack；旧版遗留 id（如 uneasy）纠正为默认章 */
  private resolveValidChapter(raw: ChapterState): ChapterState {
    const pack = this.packService.getPack();
    const known = new Set(pack.world.chapters.map((c) => c.id));
    if (known.has(raw)) return raw;
    return this.defaultChapter();
  }

  /**
   * 若内存/库中的章节不在当前 Pack，改回默认章并写库。
   */
  private async sanitizeChapterState(
    playerId: string,
    npcId: string,
  ): Promise<ChapterState> {
    const k = this.key(playerId, npcId);
    const raw =
      this.chapterStates.get(k) ?? this.defaultChapter();
    const valid = this.resolveValidChapter(raw);
    if (valid === raw) {
      this.chapterStates.set(k, valid);
      return valid;
    }
    this.logger.warn(
      `章节 id「${raw}」不在当前 Pack，已重置为「${valid}」（player=${playerId} npc=${npcId}）`,
    );
    this.chapterStates.set(k, valid);
    const { worldId, packVersionId } = this.progressKey();
    await this.playerStateRepo.saveChapterState(
      playerId,
      worldId,
      packVersionId,
      npcId,
      valid,
    );
    return valid;
  }

  async ensureSession(playerId: string, npcId: string): Promise<void> {
    const k = this.key(playerId, npcId);
    if (this.hydrated.has(k)) {
      await this.sanitizeChapterState(playerId, npcId);
      return;
    }

    const { worldId, packVersionId } = this.progressKey();
    const defaults = this.npcService.getDefaultRuntimeState(npcId);
    const session = await this.playerStateRepo.loadSession(
      playerId,
      worldId,
      packVersionId,
      npcId,
      defaults,
      this.defaultChapter(),
    );

    await this.npcService.hydrateRuntime(playerId, npcId);
    await this.storyFlagService.hydrate(playerId, npcId);
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
    await this.sanitizeChapterState(playerId, npcId);
  }

  private async persistSession(playerId: string, npcId: string) {
    const k = this.key(playerId, npcId);
    const transcript = this.transcripts.get(k);
    const { worldId, packVersionId } = this.progressKey();
    await this.playerStateRepo.saveFullSession(
      playerId,
      worldId,
      packVersionId,
      npcId,
      {
        runtime: this.npcService.getRuntimeState(playerId, npcId),
        chapterState: this.getChapterState(playerId, npcId),
        recentMessages: this.history.get(k) ?? [],
        transcriptMessages: transcript?.messages ?? [],
        sessionStartedAt: transcript?.startedAt ?? null,
        activeArchiveFilename: this.sessionArchiveFiles.get(k) ?? null,
      },
    );
  }

  getChapterState(playerId: string, npcId: string): ChapterState {
    const raw =
      this.chapterStates.get(this.key(playerId, npcId)) ??
      this.defaultChapter();
    return this.resolveValidChapter(raw);
  }

  getStoryFlags(playerId: string, npcId: string): StoryFlagsSnapshot {
    return this.storyFlagService.getFlags(playerId, npcId);
  }

  async setChapterState(
    playerId: string,
    npcId: string,
    state: ChapterState,
  ): Promise<ChapterState> {
    const valid = this.resolveValidChapter(state);
    if (valid !== state) {
      this.logger.warn(
        `拒绝写入无效章节「${state}」，改为「${valid}」（player=${playerId} npc=${npcId}）`,
      );
    }
    const k = this.key(playerId, npcId);
    this.chapterStates.set(k, valid);
    const { worldId, packVersionId } = this.progressKey();
    await this.playerStateRepo.saveChapterState(
      playerId,
      worldId,
      packVersionId,
      npcId,
      valid,
    );
    return valid;
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
        story_flags: this.storyFlagService.getFlags(playerId, npcId),
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

    this.chapterStates.set(
      k,
      this.resolveValidChapter(snapshot.npc_state.chapter_state),
    );
    this.sessionArchiveFiles.set(k, safeFilename);
    this.hydrated.add(k);

    const storyFlags: StoryFlagsSnapshot = {
      ...(snapshot.npc_state.story_flags ?? {}),
    };
    await this.storyFlagService.replaceAll(playerId, npcId, storyFlags);

    const chapterState = await this.sanitizeChapterState(playerId, npcId);

    const { worldId, packVersionId } = this.progressKey();
    await this.playerStateRepo.saveFullSession(
      playerId,
      worldId,
      packVersionId,
      npcId,
      {
        runtime: {
          affinity: snapshot.npc_state.affinity,
          fatigue: snapshot.npc_state.fatigue,
          current_status: snapshot.npc_state.current_status,
        },
        chapterState,
        recentMessages: history,
        transcriptMessages: messages,
        sessionStartedAt: transcript.startedAt,
        activeArchiveFilename: safeFilename,
      },
    );

    return {
      filename: safeFilename,
      snapshotIndex,
      messages,
      npcState: {
        affinity: snapshot.npc_state.affinity,
        fatigue: snapshot.npc_state.fatigue,
        current_status: snapshot.npc_state.current_status,
      },
      chapterState,
      storyFlags,
    };
  }

  async listArchives(playerId: string, npcId: string) {
    return this.archiveService.listArchives(playerId, npcId);
  }

  async renameArchive(
    playerId: string,
    filename: string,
    displayName: string,
  ) {
    return this.archiveService.renameArchive(playerId, filename, displayName);
  }

  buildStoryMap(playerId: string, npcId: string): StoryMapEvent {
    const pack = this.packService.getPack();
    const edges = pack.triggers.rules
      .filter((r) => r.enabled)
      .map((r) => ({
        id: r.id,
        from: r.from_chapter,
        to: r.to_chapter,
        label:
          r.notes?.trim() ||
          (r.player_triggers.length
            ? r.player_triggers.slice(0, 3).join(' / ')
            : r.id),
        set_flag_names: r.set_flags.map((f) => f.name),
      }));

    return {
      npcId,
      current_chapter: this.getChapterState(playerId, npcId),
      flags: this.storyFlagService.getFlags(playerId, npcId),
      chapters: [...pack.world.chapters]
        .sort((a, b) => a.rank - b.rank)
        .map((c) => ({
          id: c.id,
          display_name: c.display_name,
          rank: c.rank,
        })),
      edges,
    };
  }

  /**
   * 新开独立存档槽：重置对话与数值，切到目标章/分歧，并立刻建空槽快照。
   * 旧存档文件不受影响。
   */
  async startNewRun(
    playerId: string,
    npcId: string,
    opts: Omit<StartNewRunPayload, 'npcId'>,
  ): Promise<{
    filename: string;
    display_name?: string;
    chapterState: ChapterState;
    storyFlags: StoryFlagsSnapshot;
    npcState: NpcRuntimeState;
  }> {
    await this.ensureSession(playerId, npcId);
    const pack = this.packService.getPack();
    const k = this.key(playerId, npcId);

    let chapterId =
      opts.chapterId ?? getFirstChapterId(pack);
    const flags: StoryFlagsSnapshot = {};

    if (opts.viaRuleId) {
      const rule = pack.triggers.rules.find((r) => r.id === opts.viaRuleId);
      if (!rule || !rule.enabled) {
        throw new Error(`未知或未启用的分歧规则：${opts.viaRuleId}`);
      }
      if (rule.to_chapter) {
        chapterId = rule.to_chapter;
      } else {
        chapterId = rule.from_chapter;
      }
      for (const f of rule.set_flags) {
        flags[f.name] = f.value;
      }
      for (const name of rule.require_flags) {
        if (flags[name] === undefined) flags[name] = 'true';
      }
    }

    chapterId = this.resolveValidChapter(chapterId);

    const defaults = this.npcService.getDefaultRuntimeState(npcId);
    this.npcService.updateRuntimeState(playerId, npcId, defaults);
    await this.storyFlagService.replaceAll(playerId, npcId, flags);
    this.chapterStates.set(k, chapterId);
    this.history.set(k, []);
    const startedAt = new Date().toISOString();
    this.transcripts.set(k, { startedAt, messages: [] });
    this.hydrated.add(k);

    const displayName =
      opts.displayName?.trim() ||
      `第${(pack.world.chapters.find((c) => c.id === chapterId)?.rank ?? 0) + 1}章起·${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;

    const snapshot: ConversationSnapshot = {
      saved_at: startedAt,
      npc_state: {
        affinity: defaults.affinity,
        fatigue: defaults.fatigue,
        current_status: defaults.current_status,
        chapter_state: chapterId,
        story_flags: flags,
      },
      messages: [],
    };

    const filename = await this.archiveService.createSessionArchive(
      playerId,
      npcId,
      startedAt,
      snapshot,
      displayName,
    );
    this.sessionArchiveFiles.set(k, filename);

    const { worldId, packVersionId } = this.progressKey();
    await this.playerStateRepo.saveFullSession(
      playerId,
      worldId,
      packVersionId,
      npcId,
      {
        runtime: defaults,
        chapterState: chapterId,
        recentMessages: [],
        transcriptMessages: [],
        sessionStartedAt: startedAt,
        activeArchiveFilename: filename,
      },
    );

    this.logger.log(
      `New run player=${playerId} npc=${npcId} chapter=${chapterId} archive=${filename}`,
    );

    return {
      filename,
      display_name: displayName,
      chapterState: chapterId,
      storyFlags: flags,
      npcState: defaults,
    };
  }

  clear(playerId: string, npcId: string) {
    const k = this.key(playerId, npcId);
    this.history.delete(k);
    this.chapterStates.delete(k);
    this.transcripts.delete(k);
    this.sessionArchiveFiles.delete(k);
    this.hydrated.delete(k);
    this.storyFlagService.clearCache(playerId, npcId);
  }
}
