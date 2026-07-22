import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  getDefaultNpcId,
  getFirstChapterId,
  SCENE_PLAYER_DISPLAY_NAME,
  SCENE_PLAYER_ID,
  type ArchivedNpcSlot,
  type ArchiveScope,
  type ChapterState,
  type ConversationSnapshotV3,
  type LlmMessage,
  type NpcAsideEvent,
  type NpcExchangeEvent,
  type NpcRuntimeState,
  type SceneUtterance,
  type StartNewRunPayload,
  type StoryFlagsSnapshot,
  type StoryMapEvent,
} from '@ocraft/shared';
import { PlayerStateRepository } from '../db/player-state.repository';
import { NpcService } from '../npc/npc.service';
import { PackService } from '../story/pack.service';
import { StoryFlagService } from '../story/story-flag.service';
import { WorldProgressService } from '../story/world-progress.service';
import {
  ConversationArchiveService,
  type ConversationSnapshot,
} from './conversation-archive.service';
import { migrateSave } from './save-migrate';
const MAX_HISTORY_TURNS = 6;

interface SessionTranscript {
  startedAt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; at: string }>;
}

export interface SaveSnapshotResult {
  filename: string;
  snapshotIndex: number;
  savedAt: string;
  scope: ArchiveScope;
  chapterState: ChapterState;
  /** 本轮写入前世界章/旗是否脏（升章/立旗） */
  worldChanged: boolean;
}

export interface RestoreSnapshotResult {
  filename: string;
  snapshotIndex: number;
  messages: SessionTranscript['messages'];
  npcState: NpcRuntimeState;
  chapterState: ChapterState;
  storyFlags: StoryFlagsSnapshot;
  scope: ArchiveScope;
  restoredNpcIds: string[];
  sceneLog: SceneUtterance[];
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  /** key: PackService.sessionKey(playerId, npcId) */
  private readonly history = new Map<string, LlmMessage[]>();
  private readonly chapterStates = new Map<string, ChapterState>();
  private readonly transcripts = new Map<string, SessionTranscript>();
  private readonly sessionArchiveFiles = new Map<string, string>();
  /** 一局档文件名：player:world:pack */
  private readonly runArchiveFiles = new Map<string, string>();
  /** 一局整场对白时间线：runKey → scene_log */
  private readonly sceneLogs = new Map<string, SceneUtterance[]>();
  /** 已从存档灌入过 scene_log 的 runKey（避免重启后写空覆盖） */
  private readonly sceneLogHydrated = new Set<string>();
  private readonly hydrated = new Set<string>();

  constructor(
    private readonly archiveService: ConversationArchiveService,
    private readonly playerStateRepo: PlayerStateRepository,
    private readonly npcService: NpcService,
    private readonly storyFlagService: StoryFlagService,
    private readonly worldProgress: WorldProgressService,
    private readonly packService: PackService,
  ) {}

  private key(playerId: string, npcId: string) {
    return this.packService.sessionKey(playerId, npcId);
  }

  private runKey(playerId: string) {
    const { worldId, packVersionId } = this.progressKey();
    return `${playerId}:${worldId}:${packVersionId}`;
  }

  private progressNpcId(): string {
    return getDefaultNpcId(this.packService.getPack());
  }

  private allNpcIds(): string[] {
    return this.packService.getPack().npcs.map((n) => n.npc_id);
  }

  private progressKey() {
    return this.packService.getProgressKey();
  }

  private defaultChapter(): ChapterState {
    return this.packService.getDefaultChapter();
  }

  private npcDisplayName(npcId: string): string {
    return (
      this.packService.getPack().npcs.find((n) => n.npc_id === npcId)?.name ??
      npcId
    );
  }

  getSceneLog(playerId: string): SceneUtterance[] {
    return [...(this.sceneLogs.get(this.runKey(playerId)) ?? [])];
  }

  /** 进程重启后从活跃一局档最新快照灌回 scene_log */
  private async ensureSceneLogHydrated(playerId: string): Promise<void> {
    const rk = this.runKey(playerId);
    if (this.sceneLogHydrated.has(rk)) return;

    const focus = this.progressNpcId();
    const filename =
      this.runArchiveFiles.get(rk) ??
      (await this.resolveActiveRunFilename(playerId, focus));

    if (!filename) {
      if (!this.sceneLogs.has(rk)) this.sceneLogs.set(rk, []);
      this.sceneLogHydrated.add(rk);
      return;
    }

    this.runArchiveFiles.set(rk, filename);

    try {
      const { worldId, packVersionId } = this.progressKey();
      const list = await this.archiveService.listArchives(playerId, focus, {
        worldId,
        packVersionId,
      });
      const arch = list.find((a) => a.filename === filename);
      const idx = arch?.snapshots[arch.snapshots.length - 1]?.index ?? 0;
      const loaded = await this.archiveService.loadSnapshot(
        playerId,
        filename,
        idx,
      );
      const migrated = migrateSave(
        loaded.snapshot.payload ?? {
          npc_state: loaded.snapshot.npc_state,
          messages: loaded.snapshot.messages,
          saved_at: loaded.snapshot.saved_at,
          focus_npc_id: focus,
        },
      );
      if (!this.sceneLogs.has(rk)) {
        this.sceneLogs.set(rk, [...(migrated?.scene_log ?? [])]);
      }
    } catch (err) {
      this.logger.warn(
        `scene_log hydrate failed player=${playerId}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      if (!this.sceneLogs.has(rk)) this.sceneLogs.set(rk, []);
    }
    this.sceneLogHydrated.add(rk);
  }

  private pushSceneUtterance(
    playerId: string,
    partial: Omit<SceneUtterance, 'id' | 'at'> &
      Partial<Pick<SceneUtterance, 'id' | 'at'>>,
  ): SceneUtterance {
    const rk = this.runKey(playerId);
    const list = this.sceneLogs.get(rk) ?? [];
    const utterance: SceneUtterance = {
      id: partial.id ?? randomUUID(),
      at: partial.at ?? new Date().toISOString(),
      kind: partial.kind,
      speaker_id: partial.speaker_id,
      speaker_name: partial.speaker_name,
      addressee_id: partial.addressee_id,
      addressee_name: partial.addressee_name,
      text: partial.text,
      meta: partial.meta,
    };
    list.push(utterance);
    this.sceneLogs.set(rk, list);
    return utterance;
  }

  /** 私聊双写：scene_log + 分人 messages（messages 仍由 appendTurn 写） */
  async appendChatPairToSceneLog(
    playerId: string,
    npcId: string,
    userMessage: string,
    assistantReply: string,
  ) {
    await this.ensureSceneLogHydrated(playerId);
    const npcName = this.npcDisplayName(npcId);
    const t0 = new Date().toISOString();
    this.pushSceneUtterance(playerId, {
      at: t0,
      kind: 'player_to_npc',
      speaker_id: SCENE_PLAYER_ID,
      speaker_name: SCENE_PLAYER_DISPLAY_NAME,
      addressee_id: npcId,
      addressee_name: npcName,
      text: userMessage,
    });
    this.pushSceneUtterance(playerId, {
      kind: 'npc_to_player',
      speaker_id: npcId,
      speaker_name: npcName,
      addressee_id: SCENE_PLAYER_ID,
      addressee_name: SCENE_PLAYER_DISPLAY_NAME,
      text: assistantReply,
    });
  }

  /** 互聊旁听写入整场流（每句一条） */
  async appendExchangeToSceneLog(playerId: string, exchange: NpcExchangeEvent) {
    await this.ensureSceneLogHydrated(playerId);
    const participantIds = [
      ...new Set(exchange.lines.map((l) => l.npcId)),
    ];
    const nameById = new Map(
      exchange.lines.map((l) => [l.npcId, l.name] as const),
    );
    for (const line of exchange.lines) {
      const otherId = participantIds.find((id) => id !== line.npcId);
      this.pushSceneUtterance(playerId, {
        kind: 'npc_to_npc',
        speaker_id: line.npcId,
        speaker_name: line.name,
        addressee_id: otherId,
        addressee_name: otherId ? nameById.get(otherId) : undefined,
        text: line.text,
        meta: {
          event_id: exchange.eventId,
          exchange: true,
          chat_npc_id: exchange.chatNpcId,
        },
      });
    }
  }

  /** 同场短接话写入整场流 */
  async appendAsideToSceneLog(playerId: string, aside: NpcAsideEvent) {
    await this.ensureSceneLogHydrated(playerId);
    this.pushSceneUtterance(playerId, {
      kind: 'npc_to_player',
      speaker_id: aside.npcId,
      speaker_name: aside.name,
      addressee_id: SCENE_PLAYER_ID,
      addressee_name: SCENE_PLAYER_DISPLAY_NAME,
      text: aside.text,
      meta: {
        aside: true,
        chat_npc_id: aside.chatNpcId,
      },
    });
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
   * 章节真相源为 world_progress（L2）。
   */
  private async sanitizeChapterState(
    playerId: string,
    _npcId: string,
  ): Promise<ChapterState> {
    await this.worldProgress.ensureHydrated(playerId);
    const raw = this.worldProgress.getChapter(playerId);
    const valid = this.resolveValidChapter(raw);
    if (valid === raw) {
      this.mirrorChapterToNpcCaches(playerId, valid);
      return valid;
    }
    this.logger.warn(
      `章节 id「${raw}」不在当前 Pack，已重置为「${valid}」（player=${playerId}）`,
    );
    await this.worldProgress.setChapter(playerId, valid);
    this.mirrorChapterToNpcCaches(playerId, valid);
    return valid;
  }

  /** 把世界章镜像到各 NPC 内存章（兼容旧 persist 路径） */
  private mirrorChapterToNpcCaches(playerId: string, chapter: ChapterState) {
    for (const id of this.allNpcIds()) {
      this.chapterStates.set(this.key(playerId, id), chapter);
    }
  }

  async ensureSession(playerId: string, npcId: string): Promise<void> {
    await this.worldProgress.ensureHydrated(playerId);
    const k = this.key(playerId, npcId);
    if (this.hydrated.has(k)) {
      await this.sanitizeChapterState(playerId, npcId);
      return;
    }

    const { worldId, packVersionId } = this.progressKey();
    const defaults = this.npcService.getDefaultRuntimeState(npcId);
    const worldChapter = this.worldProgress.getChapter(playerId);
    const session = await this.playerStateRepo.loadSession(
      playerId,
      worldId,
      packVersionId,
      npcId,
      defaults,
      worldChapter,
    );

    await this.npcService.hydrateRuntime(playerId, npcId);
    await this.storyFlagService.hydrate(playerId, npcId);
    this.chapterStates.set(k, worldChapter);
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
      // 任一 NPC 绑的若是一局档，恢复后继续往同一文件追加
      try {
        const arch = await this.playerStateRepo.findArchiveByFilename(
          playerId,
          session.activeArchiveFilename,
        );
        if (arch?.scope === 'run') {
          this.runArchiveFiles.set(
            this.runKey(playerId),
            session.activeArchiveFilename,
          );
          await this.ensureSceneLogHydrated(playerId);
        }
      } catch {
        /* ignore */
      }
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
        chapterState: this.worldProgress.getChapter(playerId),
        recentMessages: this.history.get(k) ?? [],
        transcriptMessages: transcript?.messages ?? [],
        sessionStartedAt: transcript?.startedAt ?? null,
        activeArchiveFilename: this.sessionArchiveFiles.get(k) ?? null,
      },
    );
  }

  /** 世界章（npcId 仅保留签名兼容） */
  getChapterState(playerId: string, _npcId?: string): ChapterState {
    return this.resolveValidChapter(this.worldProgress.getChapter(playerId));
  }

  /** HUD / 剧情图：世界 flags（L2） */
  getStoryFlags(playerId: string, _npcId?: string): StoryFlagsSnapshot {
    return this.worldProgress.getFlags(playerId);
  }

  async setChapterState(
    playerId: string,
    _npcId: string,
    state: ChapterState,
  ): Promise<ChapterState> {
    const valid = await this.worldProgress.setChapter(playerId, state);
    this.mirrorChapterToNpcCaches(playerId, valid);
    const { worldId, packVersionId } = this.progressKey();
    // 镜像写各 NPC 行，便于旧查询；真相源仍是 world_progress
    for (const id of this.allNpcIds()) {
      await this.playerStateRepo.saveChapterState(
        playerId,
        worldId,
        packVersionId,
        id,
        valid,
      );
    }
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

  /**
   * 组装当前一局快照（世界进度 + 全员状态/聊天）。
   * 无任何对话时仍可存（用于新开局后的自动存）。
   */
  private async buildRunSnapshot(
    playerId: string,
    focusNpcId: string,
  ): Promise<{
    snapshot: ConversationSnapshot;
    chapterState: ChapterState;
  }> {
    await this.worldProgress.ensureHydrated(playerId);
    for (const id of this.allNpcIds()) {
      await this.ensureSession(playerId, id);
    }
    await this.ensureSceneLogHydrated(playerId);

    const focusKey = this.key(playerId, focusNpcId);
    const focusTranscript = this.transcripts.get(focusKey);
    const worldChapter = this.worldProgress.getChapter(playerId);
    const worldFlagsSnap = this.worldProgress.getFlags(playerId);

    const npcs: Record<string, ArchivedNpcSlot> = {};
    for (const id of this.allNpcIds()) {
      const runtime = this.npcService.getRuntimeState(playerId, id);
      const t = this.transcripts.get(this.key(playerId, id));
      npcs[id] = {
        affinity: runtime.affinity,
        fatigue: runtime.fatigue,
        current_status: runtime.current_status,
        story_flags: this.storyFlagService.getFlags(playerId, id),
        messages: t ? [...t.messages] : [],
      };
    }

    const focusRuntime = this.npcService.getRuntimeState(playerId, focusNpcId);
    const focusMessages = focusTranscript
      ? [...focusTranscript.messages]
      : npcs[focusNpcId]?.messages ?? [];

    const savedAt = new Date().toISOString();
    const payload: ConversationSnapshotV3 = {
      schema_version: 3,
      saved_at: savedAt,
      focus_npc_id: focusNpcId,
      world: {
        chapter_state: worldChapter,
        story_flags: worldFlagsSnap,
      },
      npc_state: {
        affinity: focusRuntime.affinity,
        fatigue: focusRuntime.fatigue,
        current_status: focusRuntime.current_status,
        chapter_state: worldChapter,
        story_flags: worldFlagsSnap,
      },
      messages: focusMessages,
      npcs,
      scene_log: this.getSceneLog(playerId),
    };

    return {
      chapterState: worldChapter,
      snapshot: {
        saved_at: savedAt,
        npc_state: payload.npc_state,
        messages: focusMessages,
        payload,
      },
    };
  }

  private async resolveActiveRunFilename(
    playerId: string,
    focusNpcId: string,
  ): Promise<string | null> {
    const rk = this.runKey(playerId);
    const progressNpcId = this.progressNpcId();
    const candidate =
      this.runArchiveFiles.get(rk) ??
      this.sessionArchiveFiles.get(this.key(playerId, progressNpcId)) ??
      this.sessionArchiveFiles.get(this.key(playerId, focusNpcId));
    if (!candidate) return null;
    const arch = await this.playerStateRepo.findArchiveByFilename(
      playerId,
      candidate,
    );
    if (arch?.scope !== 'run') return null;
    return candidate;
  }

  /**
   * 保证有活跃一局槽：已有则复用；没有则按当前进度建槽（不重置章/旗/对白）。
   */
  private async ensureActiveRunFilename(
    playerId: string,
    focusNpcId: string,
  ): Promise<string> {
    const existing = await this.resolveActiveRunFilename(playerId, focusNpcId);
    if (existing) return existing;

    const { snapshot, chapterState } = await this.buildRunSnapshot(
      playerId,
      focusNpcId,
    );
    const { worldId, packVersionId } = this.progressKey();
    const progressNpcId = this.progressNpcId();
    const pack = this.packService.getPack();
    const rank =
      pack.world.chapters.find((c) => c.id === chapterState)?.rank ?? 0;
    const displayName = `自动记录·第${rank + 1}章·${new Date().toLocaleString(
      'zh-CN',
      {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      },
    )}`;

    const focusKey = this.key(playerId, focusNpcId);
    const sessionStartedAt =
      this.transcripts.get(focusKey)?.startedAt ?? snapshot.saved_at;

    const filename = await this.archiveService.createSessionArchive({
      playerId,
      npcId: progressNpcId,
      sessionStartedAt,
      snapshot,
      displayName,
      scope: 'run',
      worldId,
      packVersionId,
    });

    this.runArchiveFiles.set(this.runKey(playerId), filename);
    for (const id of this.allNpcIds()) {
      const k = this.key(playerId, id);
      this.sessionArchiveFiles.set(k, filename);
      const transcript = this.transcripts.get(k);
      await this.playerStateRepo.saveFullSession(
        playerId,
        worldId,
        packVersionId,
        id,
        {
          runtime: this.npcService.getRuntimeState(playerId, id),
          chapterState,
          recentMessages: this.history.get(k) ?? [],
          transcriptMessages: transcript?.messages ?? [],
          sessionStartedAt: transcript?.startedAt ?? sessionStartedAt,
          activeArchiveFilename: filename,
        },
      );
    }

    this.logger.log(
      `Auto-created run slot player=${playerId} archive=${filename} chapter=${chapterState}`,
    );
    return filename;
  }

  /**
   * 自动存档：每轮对话覆盖「当前活跃一局槽」最新快照（含对白/好感/章旗）。
   * 无槽时自动建一局（不重置进度）。opts.force 保留兼容，已无门禁差异。
   */
  async autoSaveActiveRun(
    playerId: string,
    focusNpcId: string,
    _opts?: { force?: boolean },
  ): Promise<SaveSnapshotResult | null> {
    const worldChanged = this.worldProgress.isDirty(playerId);
    const filename = await this.ensureActiveRunFilename(playerId, focusNpcId);

    const { snapshot, chapterState } = await this.buildRunSnapshot(
      playerId,
      focusNpcId,
    );

    const snapshotIndex = await this.playerStateRepo.transaction(async (tx) => {
      const idx = await this.archiveService.upsertLatestSnapshot(
        playerId,
        filename,
        snapshot,
        tx,
      );
      const { worldId, packVersionId } = this.progressKey();
      for (const id of this.allNpcIds()) {
        const k = this.key(playerId, id);
        const transcript = this.transcripts.get(k);
        const row = {
          runtime: this.npcService.getRuntimeState(playerId, id),
          chapterState,
          recentMessages: this.history.get(k) ?? [],
          transcriptMessages: transcript?.messages ?? [],
          sessionStartedAt: transcript?.startedAt ?? null,
          activeArchiveFilename: filename,
        };
        if (tx) {
          await this.playerStateRepo.saveFullSessionWithDb(
            tx,
            playerId,
            worldId,
            packVersionId,
            id,
            row,
          );
        } else {
          await this.playerStateRepo.saveFullSession(
            playerId,
            worldId,
            packVersionId,
            id,
            row,
          );
        }
      }
      return idx;
    });

    this.worldProgress.consumeDirty(playerId);
    this.runArchiveFiles.set(this.runKey(playerId), filename);
    for (const id of this.allNpcIds()) {
      this.sessionArchiveFiles.set(this.key(playerId, id), filename);
    }

    return {
      filename,
      snapshotIndex,
      savedAt: snapshot.saved_at,
      scope: 'run',
      chapterState,
      worldChanged,
    };
  }

  /** @deprecated 手动存档已取消；保留别名以免旧客户端报错 */
  async saveSnapshot(
    playerId: string,
    focusNpcId: string,
    _npcState: NpcRuntimeState,
  ): Promise<SaveSnapshotResult | null> {
    return this.autoSaveActiveRun(playerId, focusNpcId);
  }

  async restoreSnapshot(
    playerId: string,
    focusNpcId: string,
    filename: string,
    snapshotIndex: number,
  ): Promise<RestoreSnapshotResult> {
    const loaded = await this.archiveService.loadSnapshot(
      playerId,
      filename,
      snapshotIndex,
    );
    const { snapshot, scope } = loaded;
    const safeFilename = path.basename(filename);
    const { worldId, packVersionId } = this.progressKey();
    const progressNpcId = this.progressNpcId();

    const migrated = migrateSave(snapshot.payload ?? {
      npc_state: snapshot.npc_state,
      messages: snapshot.messages,
      saved_at: snapshot.saved_at,
      focus_npc_id: focusNpcId,
    });

    // —— v3 一局档（含 v1/v2 迁移结果）——
    if (migrated?.schema_version === 3) {
      const v3 = migrated;
      const worldChapter = this.resolveValidChapter(v3.world.chapter_state);
      const worldFlagsSnap: StoryFlagsSnapshot = { ...v3.world.story_flags };

      await this.playerStateRepo.transaction(async (tx) => {
        await this.worldProgress.replaceWorld(
          playerId,
          worldChapter,
          worldFlagsSnap,
          tx,
        );
        this.mirrorChapterToNpcCaches(playerId, worldChapter);

        for (const id of this.allNpcIds()) {
          const slot = v3.npcs[id];
          const k = this.key(playerId, id);
          const defaults = this.npcService.getDefaultRuntimeState(id);
          const runtime: NpcRuntimeState = slot
            ? {
                affinity: slot.affinity,
                fatigue: slot.fatigue,
                current_status: slot.current_status,
              }
            : defaults;

          this.npcService.updateRuntimeState(playerId, id, runtime);
          this.sessionArchiveFiles.set(k, safeFilename);
          this.hydrated.add(k);

          const messages = slot?.messages ?? [];
          const transcript: SessionTranscript = {
            startedAt: messages[0]?.at ?? v3.saved_at,
            messages: [...messages],
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

          const flagsForNpc = { ...(slot?.story_flags ?? {}) };
          await this.storyFlagService.replaceAll(playerId, id, flagsForNpc);

          const row = {
            runtime,
            chapterState: worldChapter,
            recentMessages: history,
            transcriptMessages: messages,
            sessionStartedAt: transcript.startedAt,
            activeArchiveFilename: safeFilename,
          };
          if (tx) {
            await this.playerStateRepo.saveFullSessionWithDb(
              tx,
              playerId,
              worldId,
              packVersionId,
              id,
              row,
            );
          } else {
            await this.playerStateRepo.saveFullSession(
              playerId,
              worldId,
              packVersionId,
              id,
              row,
            );
          }
        }
      });

      this.worldProgress.consumeDirty(playerId);
      this.runArchiveFiles.set(this.runKey(playerId), safeFilename);
      this.sceneLogs.set(this.runKey(playerId), [...(v3.scene_log ?? [])]);
      this.sceneLogHydrated.add(this.runKey(playerId));

      const focusSlot = v3.npcs[focusNpcId] ?? v3.npcs[progressNpcId];
      const focusMessages = focusSlot?.messages ?? v3.messages ?? [];

      return {
        filename: safeFilename,
        snapshotIndex,
        messages: focusMessages,
        npcState: focusSlot
          ? {
              affinity: focusSlot.affinity,
              fatigue: focusSlot.fatigue,
              current_status: focusSlot.current_status,
            }
          : this.npcService.getRuntimeState(playerId, focusNpcId),
        chapterState: worldChapter,
        storyFlags: worldFlagsSnap,
        scope: 'run',
        restoredNpcIds: this.allNpcIds(),
        sceneLog: [...(v3.scene_log ?? [])],
      };
    }

    // —— 无法迁移时的 v1 兜底 ——
    const npcId = focusNpcId;
    const k = this.key(playerId, npcId);
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

    const chapterState = this.resolveValidChapter(
      snapshot.npc_state.chapter_state,
    );
    const storyFlags: StoryFlagsSnapshot = {
      ...(snapshot.npc_state.story_flags ?? {}),
    };

    await this.playerStateRepo.transaction(async (tx) => {
      await this.worldProgress.replaceWorld(
        playerId,
        chapterState,
        storyFlags,
        tx,
      );
      this.mirrorChapterToNpcCaches(playerId, chapterState);
      this.sessionArchiveFiles.set(k, safeFilename);
      this.hydrated.add(k);
      await this.storyFlagService.replaceAll(playerId, npcId, storyFlags);

      const row = {
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
      };
      if (tx) {
        await this.playerStateRepo.saveFullSessionWithDb(
          tx,
          playerId,
          worldId,
          packVersionId,
          npcId,
          row,
        );
      } else {
        await this.playerStateRepo.saveFullSession(
          playerId,
          worldId,
          packVersionId,
          npcId,
          row,
        );
      }
    });
    this.worldProgress.consumeDirty(playerId);

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
      scope: scope === 'run' ? 'run' : 'npc',
      restoredNpcIds: [npcId],
      sceneLog: [],
    };
  }

  async listArchives(playerId: string, npcId: string) {
    const { worldId, packVersionId } = this.progressKey();
    return this.archiveService.listArchives(playerId, npcId, {
      worldId,
      packVersionId,
    });
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
      current_chapter: this.getChapterState(playerId),
      flags: this.worldProgress.getFlags(playerId),
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
   * 新开独立存档槽：重置包内全部 NPC，切到目标章/分歧，并立刻建一局空槽快照。
   * 旧存档文件不受影响。
   */
  async startNewRun(
    playerId: string,
    focusNpcId: string,
    opts: Omit<StartNewRunPayload, 'npcId'>,
  ): Promise<{
    filename: string;
    display_name?: string;
    chapterState: ChapterState;
    storyFlags: StoryFlagsSnapshot;
    npcState: NpcRuntimeState;
  }> {
    const pack = this.packService.getPack();
    const progressNpcId = this.progressNpcId();
    const { worldId, packVersionId } = this.progressKey();

    for (const id of this.allNpcIds()) {
      await this.ensureSession(playerId, id);
    }

    let chapterId = opts.chapterId ?? getFirstChapterId(pack);
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
    const startedAt = new Date().toISOString();

    const npcs: Record<string, ArchivedNpcSlot> = {};
    await this.playerStateRepo.transaction(async (tx) => {
      await this.worldProgress.replaceWorld(playerId, chapterId, flags, tx);
      this.mirrorChapterToNpcCaches(playerId, chapterId);

      for (const id of this.allNpcIds()) {
        const defaults = this.npcService.getDefaultRuntimeState(id);
        this.npcService.updateRuntimeState(playerId, id, defaults);
        const k = this.key(playerId, id);
        this.history.set(k, []);
        this.transcripts.set(k, { startedAt, messages: [] });
        this.hydrated.add(k);
        await this.storyFlagService.replaceAll(playerId, id, {});
        npcs[id] = {
          affinity: defaults.affinity,
          fatigue: defaults.fatigue,
          current_status: defaults.current_status,
          story_flags: {},
          messages: [],
        };
      }
    });

    const focusDefaults = this.npcService.getDefaultRuntimeState(focusNpcId);
    const displayName =
      opts.displayName?.trim() ||
      `第${(pack.world.chapters.find((c) => c.id === chapterId)?.rank ?? 0) + 1}章起·${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;

    const payload: ConversationSnapshotV3 = {
      schema_version: 3,
      saved_at: startedAt,
      focus_npc_id: focusNpcId,
      world: {
        chapter_state: chapterId,
        story_flags: flags,
      },
      npc_state: {
        affinity: focusDefaults.affinity,
        fatigue: focusDefaults.fatigue,
        current_status: focusDefaults.current_status,
        chapter_state: chapterId,
        story_flags: flags,
      },
      messages: [],
      npcs,
      scene_log: [],
    };

    const snapshot: ConversationSnapshot = {
      saved_at: startedAt,
      npc_state: payload.npc_state,
      messages: [],
      payload,
    };

    const filename = await this.archiveService.createSessionArchive({
      playerId,
      npcId: progressNpcId,
      sessionStartedAt: startedAt,
      snapshot,
      displayName,
      scope: 'run',
      worldId,
      packVersionId,
    });

    this.runArchiveFiles.set(this.runKey(playerId), filename);
    this.sceneLogs.set(this.runKey(playerId), []);
    this.sceneLogHydrated.add(this.runKey(playerId));
    for (const id of this.allNpcIds()) {
      this.sessionArchiveFiles.set(this.key(playerId, id), filename);
      await this.playerStateRepo.saveFullSession(
        playerId,
        worldId,
        packVersionId,
        id,
        {
          runtime: this.npcService.getRuntimeState(playerId, id),
          chapterState: chapterId,
          recentMessages: [],
          transcriptMessages: [],
          sessionStartedAt: startedAt,
          activeArchiveFilename: filename,
        },
      );
    }

    this.worldProgress.consumeDirty(playerId);

    this.logger.log(
      `New run player=${playerId} focus=${focusNpcId} chapter=${chapterId} archive=${filename} scope=run`,
    );

    return {
      filename,
      display_name: displayName,
      chapterState: chapterId,
      storyFlags: flags,
      npcState: focusDefaults,
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
