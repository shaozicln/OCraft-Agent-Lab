import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  getDefaultNpcId,
  listConversationArchivesPayloadSchema,
  loadConversationArchivePayloadSchema,
  playerChatPayloadSchema,
  renameArchivePayloadSchema,
  requestChatSuggestionsPayloadSchema,
  requestNpcStatePayloadSchema,
  requestStoryMapPayloadSchema,
  saveConversationPayloadSchema,
  setRunNpcSelectionPayloadSchema,
  startNewRunPayloadSchema,
} from '@ocraft/shared';
import { AuthService } from '../auth/auth.service';
import { AgentHarnessService } from '../agent/agent-harness.service';
import { NpcExchangeService } from '../agent/npc-exchange.service';
import { NpcAsideService } from '../agent/npc-aside.service';
import { DirectorService } from '../agent/director.service';
import { PackService } from '../story/pack.service';
import { ConversationService } from './conversation.service';
import { NpcService } from '../npc/npc.service';

interface AuthedSocket extends Socket {
  data: {
    playerId?: string;
    username?: string;
  };
}

@WebSocketGateway({
  cors: { origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000' },
})
export class GameGateway implements OnGatewayConnection {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly agentHarness: AgentHarnessService,
    private readonly npcExchange: NpcExchangeService,
    private readonly npcAside: NpcAsideService,
    private readonly director: DirectorService,
    private readonly conversationService: ConversationService,
    private readonly npcService: NpcService,
    private readonly packService: PackService,
  ) {}

  handleConnection(client: AuthedSocket) {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string' || !token) {
      this.logger.warn(`WS rejected: missing token (${client.id})`);
      client.disconnect(true);
      return;
    }

    const session = this.authService.verifyToken(token);
    if (!session) {
      this.logger.warn(`WS rejected: invalid token (${client.id})`);
      client.disconnect(true);
      return;
    }

    client.data.playerId = session.playerId;
    this.logger.log(
      `Client connected: ${client.id} player=${session.playerId}`,
    );
  }

  handleDisconnect(client: AuthedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private requirePlayerId(client: AuthedSocket): string {
    const playerId = client.data.playerId;
    if (!playerId) {
      throw new WsException('未登录或会话已失效');
    }
    return playerId;
  }

  private buildStatePayload(
    playerId: string,
    npcId: string,
    animation?: string,
  ) {
    const def = this.npcService.getDefinition(npcId);
    const state = this.npcService.getRuntimeState(playerId, npcId);
    return {
      npcId,
      name: def.name,
      affinity: state.affinity,
      fatigue: state.fatigue,
      maxFatigue: def.attributes.max_fatigue,
      animation: animation ?? state.current_status,
      current_status: state.current_status,
      chapter_state: this.conversationService.getChapterState(playerId, npcId),
      story_flags: this.conversationService.getStoryFlags(playerId, npcId),
    };
  }

  /** 读档 / 新开局后：全员状态推给客户端（含进度订阅键） */
  private emitAllNpcStates(client: AuthedSocket, playerId: string) {
    for (const npc of this.packService.getPack().npcs) {
      const runtime = this.npcService.getRuntimeState(playerId, npc.npc_id);
      client.emit(
        'npc_state_update',
        this.buildStatePayload(
          playerId,
          npc.npc_id,
          runtime.current_status,
        ),
      );
    }
  }

  @SubscribeMessage('request_npc_state')
  async handleRequestNpcState(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: unknown,
  ) {
    const parsed = requestNpcStatePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new WsException(parsed.error.message);
    }

    const playerId = this.requirePlayerId(client);
    const { npcId } = parsed.data;
    return this.packService.runWithPlayerAsync(playerId, async () => {
      await this.conversationService.ensureSession(playerId, npcId);
      await this.conversationService.ensureNpcSelectionHydrated(playerId);
      client.emit(
        'npc_state_update',
        this.buildStatePayload(playerId, npcId),
      );
      client.emit('run_npc_selection', {
        selected_npc_ids: this.conversationService.getNpcSelection(playerId),
      });
    });
  }

  @SubscribeMessage('request_chat_suggestions')
  async handleRequestChatSuggestions(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: unknown,
  ) {
    const parsed = requestChatSuggestionsPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new WsException(parsed.error.message);
    }

    const playerId = this.requirePlayerId(client);
    const { npcId } = parsed.data;

    return this.packService.runWithPlayerAsync(playerId, async () => {
      await this.conversationService.ensureSession(playerId, npcId);
      try {
        const suggestions = await this.agentHarness.suggestPlayerReplies(
          playerId,
          npcId,
        );
        client.emit('chat_suggestions', { npcId, suggestions });
      } catch (err) {
        this.logger.error(err);
        client.emit('chat_suggestions', {
          npcId,
          suggestions: [],
          error: err instanceof Error ? err.message : '生成建议失败',
        });
      }
    });
  }

  @SubscribeMessage('player_chat')
  async handlePlayerChat(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: unknown,
  ) {
    const parsed = playerChatPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new WsException(parsed.error.message);
    }

    const playerId = this.requirePlayerId(client);
    const { npcId, message, nearbyNpcIds, whisper } = parsed.data;
    const isWhisper = whisper === true;

    return this.packService.runWithPlayerAsync(playerId, async () => {
      await this.conversationService.ensureSession(playerId, npcId);
      this.logger.log(
        `player_chat player=${playerId} npc=${npcId} whisper=${isWhisper} msg="${message}" nearby=${(nearbyNpcIds ?? []).join(',') || '-'}`,
      );

      try {
        // 导演：whisper 跳过 LLM；否则真决策。fallback ≠ false → 等同现网仍尝试互聊路径
        const directorDecision = isWhisper
          ? this.director.skippedWhisperDecision(npcId)
          : await this.director.decide(
              await this.director.buildInput(
                playerId,
                npcId,
                message,
                nearbyNpcIds ?? [],
              ),
            );
        const shouldTryExchange =
          directorDecision.fallback !== false ||
          directorDecision.mode === 'reply_then_exchange';
        this.logger.log(
          `director mode=${directorDecision.mode} fallback=${String(directorDecision.fallback)} speakers=[${directorDecision.speakers.join(',')}] reason="${directorDecision.reason}"`,
        );

        const result = await this.agentHarness.run(playerId, npcId, message, {
          director: directorDecision,
        });

        let fullReply = '';
        for await (const chunk of result.stream) {
          if (chunk.text) {
            fullReply += chunk.text;
            client.emit('npc_stream', { npcId, chunk: chunk.text });
          }
        }
        client.emit('npc_stream', { npcId, chunk: '', done: true });

        await this.agentHarness.recordAssistantReply(
          playerId,
          npcId,
          message,
          fullReply,
          { whisper: isWhisper },
        );

        client.emit('npc_state_update', {
          ...this.buildStatePayload(playerId, npcId, result.animation),
          toolCalls: result.toolCalls,
        });

        // 世界章/flags 已写 L2：同步刷 HUD（进度与聊天 NPC 可能不是同一人）
        const progressNpcId = getDefaultNpcId(this.packService.getPack());
        if (progressNpcId !== npcId) {
          client.emit(
            'npc_state_update',
            this.buildStatePayload(playerId, progressNpcId),
          );
        }

        // 悄悄话 / reply_player 成功：不跑互聊 / 旁听；fallback 或开放模式：与现网一致
        if (!isWhisper && shouldTryExchange) {
          const exchange = await this.npcExchange.tryRunAfterChat({
            playerId,
            chatNpcId: npcId,
            playerMessage: message,
            assistantReply: fullReply,
            traceId: result.traceId,
          });
          if (exchange) {
            await this.conversationService.appendExchangeToSceneLog(
              playerId,
              exchange,
            );
            client.emit('npc_exchange', exchange);
            client.emit(
              'npc_state_update',
              this.buildStatePayload(playerId, progressNpcId),
            );
            if (progressNpcId !== npcId) {
              client.emit(
                'npc_state_update',
                this.buildStatePayload(playerId, npcId),
              );
            }
          } else {
            const aside = await this.npcAside.tryNearbyAside({
              playerId,
              chatNpcId: npcId,
              nearbyNpcIds: nearbyNpcIds ?? [],
              playerMessage: message,
              assistantReply: fullReply,
            });
            if (aside) {
              await this.conversationService.appendAsideToSceneLog(
                playerId,
                aside,
              );
              client.emit('npc_aside', aside);
            }
          }
        }

        try {
          const saved = await this.conversationService.autoSaveActiveRun(
            playerId,
            npcId,
          );
          if (saved) {
            client.emit('conversation_saved', {
              npcId,
              filename: saved.filename,
              snapshotIndex: saved.snapshotIndex,
              savedAt: saved.savedAt,
              chapter_state: saved.chapterState,
              scope: saved.scope,
              world_changed: saved.worldChanged,
            });
          }
        } catch (autoErr) {
          this.logger.warn(
            `autoSave skipped player=${playerId}: ${autoErr instanceof Error ? autoErr.message : autoErr}`,
          );
        }
      } catch (err) {
        this.logger.error(err);
        client.emit('npc_error', {
          npcId,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });
  }

  @SubscribeMessage('save_conversation')
  async handleSaveConversation(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: unknown,
  ) {
    const parsed = saveConversationPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new WsException(parsed.error.message);
    }

    const playerId = this.requirePlayerId(client);
    const { npcId } = parsed.data;
    return this.packService.runWithPlayerAsync(playerId, async () => {
      await this.conversationService.ensureSession(playerId, npcId);
      const runtime = this.npcService.getRuntimeState(playerId, npcId);
      const result = await this.conversationService.saveSnapshot(
        playerId,
        npcId,
        runtime,
      );

      if (!result) {
        throw new WsException('自动存档失败，请稍后重试。');
      }

      client.emit('conversation_saved', {
        npcId,
        filename: result.filename,
        snapshotIndex: result.snapshotIndex,
        savedAt: result.savedAt,
        chapter_state: result.chapterState,
        scope: result.scope,
        world_changed: result.worldChanged,
      });
    });
  }

  @SubscribeMessage('list_conversation_archives')
  async handleListConversationArchives(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: unknown,
  ) {
    const parsed = listConversationArchivesPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new WsException(parsed.error.message);
    }

    const playerId = this.requirePlayerId(client);
    const { npcId } = parsed.data;
    return this.packService.runWithPlayerAsync(playerId, async () => {
      const archives = await this.conversationService.listArchives(
        playerId,
        npcId,
      );
      client.emit('conversation_archives_list', {
        npcId,
        archives,
      });
    });
  }

  @SubscribeMessage('load_conversation_archive')
  async handleLoadConversationArchive(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: unknown,
  ) {
    const parsed = loadConversationArchivePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new WsException(parsed.error.message);
    }

    const playerId = this.requirePlayerId(client);
    const { npcId, filename, snapshotIndex } = parsed.data;
    return this.packService.runWithPlayerAsync(playerId, async () => {
      const restored = await this.conversationService.restoreSnapshot(
        playerId,
        npcId,
        filename,
        snapshotIndex,
      );

      this.emitAllNpcStates(client, playerId);

      client.emit('conversation_loaded', {
        npcId,
        filename: restored.filename,
        snapshotIndex: restored.snapshotIndex,
        messages: restored.messages,
        npc_state: {
          ...restored.npcState,
          chapter_state: restored.chapterState,
          story_flags: restored.storyFlags,
        },
        scope: restored.scope,
        restored_npc_ids: restored.restoredNpcIds,
        scene_log: restored.sceneLog,
        selected_npc_ids: restored.selectedNpcIds ?? null,
      });
      client.emit(
        'run_npc_selection',
        { selected_npc_ids: restored.selectedNpcIds ?? null },
      );
      client.emit(
        'story_map',
        this.conversationService.buildStoryMap(playerId, npcId),
      );
    });
  }

  @SubscribeMessage('request_story_map')
  async handleRequestStoryMap(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: unknown,
  ) {
    const parsed = requestStoryMapPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new WsException(parsed.error.message);
    }
    const playerId = this.requirePlayerId(client);
    const { npcId } = parsed.data;
    return this.packService.runWithPlayerAsync(playerId, async () => {
      await this.conversationService.ensureSession(playerId, npcId);
      client.emit(
        'story_map',
        this.conversationService.buildStoryMap(playerId, npcId),
      );
    });
  }

  @SubscribeMessage('start_new_run')
  async handleStartNewRun(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: unknown,
  ) {
    const parsed = startNewRunPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new WsException(parsed.error.message);
    }
    const playerId = this.requirePlayerId(client);
    const { npcId, ...opts } = parsed.data;
    return this.packService.runWithPlayerAsync(playerId, async () => {
      try {
        const result = await this.conversationService.startNewRun(
          playerId,
          npcId,
          opts,
        );
        client.emit('new_run_started', {
          npcId,
          filename: result.filename,
          display_name: result.display_name,
          chapter_state: result.chapterState,
          story_flags: result.storyFlags,
          selected_npc_ids: null,
        });
        client.emit('run_npc_selection', { selected_npc_ids: null });
        this.emitAllNpcStates(client, playerId);
        client.emit('story_map', this.conversationService.buildStoryMap(playerId, npcId));
        const archives = await this.conversationService.listArchives(
          playerId,
          npcId,
        );
        client.emit('conversation_archives_list', { npcId, archives });
      } catch (err) {
        throw new WsException(
          err instanceof Error ? err.message : '新开一局失败',
        );
      }
    });
  }

  @SubscribeMessage('set_run_npc_selection')
  async handleSetRunNpcSelection(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: unknown,
  ) {
    const parsed = setRunNpcSelectionPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new WsException(parsed.error.message);
    }
    const playerId = this.requirePlayerId(client);
    return this.packService.runWithPlayerAsync(playerId, async () => {
      try {
        const selected = await this.conversationService.setNpcSelection(
          playerId,
          parsed.data.npcIds,
        );
        client.emit('run_npc_selection', { selected_npc_ids: selected });

        const focusNpcId = getDefaultNpcId(this.packService.getPack());
        try {
          const saved = await this.conversationService.autoSaveActiveRun(
            playerId,
            focusNpcId,
          );
          if (saved) {
            client.emit('conversation_saved', {
              npcId: focusNpcId,
              filename: saved.filename,
              snapshotIndex: saved.snapshotIndex,
              savedAt: saved.savedAt,
              chapter_state: saved.chapterState,
              scope: saved.scope,
              world_changed: false,
            });
          }
        } catch (autoErr) {
          this.logger.warn(
            `autoSave after npc_selection skipped player=${playerId}: ${
              autoErr instanceof Error ? autoErr.message : autoErr
            }`,
          );
        }
      } catch (err) {
        throw new WsException(
          err instanceof Error ? err.message : '更新出场选用失败',
        );
      }
    });
  }

  @SubscribeMessage('rename_archive')
  async handleRenameArchive(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: unknown,
  ) {
    const parsed = renameArchivePayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new WsException(parsed.error.message);
    }
    const playerId = this.requirePlayerId(client);
    const { npcId, filename, displayName } = parsed.data;
    return this.packService.runWithPlayerAsync(playerId, async () => {
      try {
        const result = await this.conversationService.renameArchive(
          playerId,
          filename,
          displayName,
        );
        client.emit('archive_renamed', {
          npcId,
          filename: result.filename,
          display_name: result.display_name,
        });
        const archives = await this.conversationService.listArchives(
          playerId,
          npcId,
        );
        client.emit('conversation_archives_list', { npcId, archives });
      } catch (err) {
        throw new WsException(
          err instanceof Error ? err.message : '重命名失败',
        );
      }
    });
  }
}
