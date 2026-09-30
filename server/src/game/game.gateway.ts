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
  normalizeAutoPlayBeatLines,
  npcFollowArrivedPayloadSchema,
  playerChatPayloadSchema,
  renameArchivePayloadSchema,
  requestAutoplayNextPayloadSchema,
  requestChatSuggestionsPayloadSchema,
  requestNpcStatePayloadSchema,
  requestStoryMapPayloadSchema,
  saveConversationPayloadSchema,
  setRunNpcSelectionPayloadSchema,
  startNewRunPayloadSchema,
} from '@ocraft/shared';
import { AuthService } from '../auth/auth.service';
import { clientOrigins } from '../config/env';
import { AgentHarnessService } from '../agent/core/agent-harness.service';
import { LlmService } from '../agent/core/llm.service';
import { NpcExchangeService } from '../agent/multiagent/npc-exchange.service';
import { NpcAsideService } from '../agent/multiagent/npc-aside.service';
import { DirectorService } from '../agent/core/director.service';
import { AutoPlayAgentService } from '../agent/multiagent/autoplay-agent.service';
import { LabPeerService } from '../agent/multiagent/lab-peer.service';
import { detectWhisperIntent } from '../agent/multiagent/whisper-detect';
import {
  pickSafetyFallback,
  scanNpcReplySafety,
} from '../agent/safety/reply-safety';
import { evaluateEndingSettlement } from '../agent/rules/ending-settle';
import { evaluateNpcReplyFlags } from '../agent/rules/chapter-transition';
import { AgentTraceService } from '../agent/observability/agent-trace.service';
import { PackService } from '../story/pack.service';
import { ConversationService } from './conversation.service';
import { NpcFollowService } from './npc-follow.service';
import { NpcService } from '../npc/npc.service';
import { WorldProgressService } from '../story/world-progress.service';

interface AuthedSocket extends Socket {
  data: {
    playerId?: string;
    username?: string;
  };
}

// 来源列表与 HTTP 侧共用 clientOrigins()，并且必须是数组 ——
// Socket.IO 不会自动拆分逗号分隔的字符串，写成一整个字符串会被当成
// 「单个字面 origin」从而全部拒绝。
//
// 历史坑：这里原本写的是 `process.env.CLIENT_ORIGIN ?? 'http://localhost:3000'`，
// 但装饰器参数在模块加载时求值，早于 dotenv 加载，所以永远读不到 .env，
// 一直用的是本不存在的 3000 端口（本项目 client 跑在 3300）。
// 现在 main.ts 首行 import './config/load-env' 已保证加载顺序。
//
// 说明：本项目客户端固定 `transports: ['websocket']`，浏览器不对 WebSocket
// 施加 CORS，所以这里主要覆盖 polling 兜底路径；真正的访问控制由
// handleConnection() 的 token 校验 + BIND_HOST 回环绑定承担。
@WebSocketGateway({ cors: { origin: clientOrigins() } })
export class GameGateway implements OnGatewayConnection {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly agentHarness: AgentHarnessService,
    private readonly llmService: LlmService,
    private readonly npcExchange: NpcExchangeService,
    private readonly npcAside: NpcAsideService,
    private readonly director: DirectorService,
    private readonly autoPlayAgent: AutoPlayAgentService,
    private readonly labPeer: LabPeerService,
    private readonly conversationService: ConversationService,
    private readonly npcFollow: NpcFollowService,
    private readonly npcService: NpcService,
    private readonly packService: PackService,
    private readonly worldProgress: WorldProgressService,
    private readonly agentTrace: AgentTraceService,
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
      follow: this.npcFollow.get(playerId, npcId),
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

  @SubscribeMessage('npc_follow_arrived')
  async handleNpcFollowArrived(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: unknown,
  ) {
    const parsed = npcFollowArrivedPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new WsException(parsed.error.message);
    }
    const playerId = this.requirePlayerId(client);
    const { npcId, target_npc_id } = parsed.data;
    return this.packService.runWithPlayerAsync(playerId, async () => {
      const cur = this.npcFollow.get(playerId, npcId);
      if (
        cur?.mode === 'to_npc' &&
        cur.target_npc_id === target_npc_id &&
        this.npcFollow.clear(playerId, npcId)
      ) {
        this.logger.log(
          `follow arrived player=${playerId} npc=${npcId} target=${target_npc_id}`,
        );
        client.emit(
          'npc_state_update',
          this.buildStatePayload(playerId, npcId),
        );
      }
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

  @SubscribeMessage('request_autoplay_next')
  async handleRequestAutoplayNext(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() payload: unknown,
  ) {
    const parsed = requestAutoplayNextPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new WsException(parsed.error.message);
    }

    const playerId = this.requirePlayerId(client);
    const {
      npcId,
      turnIndex,
      maxTurns,
      chapterSpeakCap,
      priorSays,
      sawTargetExchange,
      targetChapter,
      targetExchange,
      targetEnding,
      styleId,
      goalTitle,
      accelerate,
      epilogue,
      epilogueMode,
      epiloguePlayerRole,
      epilogueAddressAs,
      breakWallNpcIds,
      mainBreakWallNpcIds,
      nearbyNpcIds,
    } = parsed.data;

    return this.packService.runWithPlayerAsync(playerId, async () => {
      await this.conversationService.ensureSession(playerId, npcId);
      try {
        if (!this.autoPlayAgent.isAvailable()) {
          client.emit('autoplay_next', {
            npcId,
            done: true,
            reason: '',
            source: 'mock',
            error: '自动演绎需要配置 API Key（当前为 MOCK 模式）',
          });
          return;
        }
        const isEpilogue = epilogue === true;
        const next = await this.autoPlayAgent.proposeNext({
          playerId,
          npcId,
          turnIndex,
          maxTurns,
          chapterSpeakCap,
          priorSays,
          sawTargetExchange,
          targetChapter,
          targetExchange,
          targetEnding,
          styleId,
          goalTitle,
          accelerate: isEpilogue ? false : accelerate,
          epilogue: isEpilogue,
          epilogueMode,
          epiloguePlayerRole,
          epilogueAddressAs,
          breakWallNpcIds,
          mainBreakWallNpcIds,
          nearbyNpcIds,
        });

        const lines = normalizeAutoPlayBeatLines(next);
        const hasPlayer = lines.some((l) => l.speaker_kind === 'player');

        // AP-1：纯 NPC 拍 — 服务端落档，客户端不必再 player_chat
        if (!next.done && lines.length > 0 && !hasPlayer) {
          const pack = this.packService.getPack();
          const enriched: Array<{
            speaker_kind: 'player' | 'npc';
            speaker_id: string;
            speaker_name?: string;
            text: string;
          }> = [];

          for (const line of lines) {
            let text = line.text;
            const chapterState = this.worldProgress.getChapter(playerId);
            const safety = scanNpcReplySafety(text, {
              pack,
              chapterState,
              npcId: line.speaker_id,
              autoPlay: true,
            });
            if (!safety.ok) {
              text = pickSafetyFallback();
              this.logger.warn(
                `autoplay beat safety rewrite npc=${line.speaker_id} reasons=${safety.reasons.map((r) => r.code).join(',')}`,
              );
            }
            await this.conversationService.appendAutoplayNpcLine(
              playerId,
              npcId,
              line.speaker_id,
              text,
            );
            // AP-5：杀青禁写 flag / 结局相关规则副作用
            if (!isEpilogue) {
              const flagSets = evaluateNpcReplyFlags(
                this.worldProgress.getChapter(playerId),
                text,
                this.worldProgress.getFlags(playerId),
                pack.triggers,
              );
              if (flagSets.length > 0) {
                await this.worldProgress.setFlags(playerId, flagSets);
              }
            }
            const name =
              this.npcService.getDefinition(line.speaker_id)?.name ??
              line.speaker_id;
            enriched.push({
              speaker_kind: 'npc',
              speaker_id: line.speaker_id,
              speaker_name: name,
              text,
            });
          }

          const progressNpcId = getDefaultNpcId(pack);
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

          client.emit('autoplay_next', {
            npcId,
            lines: enriched,
            applied: true,
            done: next.done,
            reason: next.reason,
            source: next.source,
          });
          return;
        }

        // 含玩家句：客户端走 player_chat（升章/结局规则吃玩家台词）
        client.emit('autoplay_next', {
          npcId,
          say: next.say,
          lines: lines.map((l) => ({
            speaker_kind: l.speaker_kind,
            speaker_id: l.speaker_id,
            speaker_name:
              l.speaker_kind === 'npc'
                ? (this.npcService.getDefinition(l.speaker_id)?.name ??
                  l.speaker_id)
                : undefined,
            text: l.text,
          })),
          applied: false,
          done: next.done,
          reason: next.reason,
          source: next.source,
        });
      } catch (err) {
        this.logger.error(err);
        client.emit('autoplay_next', {
          npcId,
          done: true,
          reason: '',
          source: 'mock',
          error: err instanceof Error ? err.message : '自动演下一拍失败',
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
    const {
      npcId,
      message,
      nearbyNpcIds,
      whisper,
      autoPlay,
      epilogue,
      breakWall,
      breakWallAddress,
      labPeerAgents,
    } = parsed.data;
    const clientWhisper = whisper === true;
    const autoWhisper = !clientWhisper && detectWhisperIntent(message);
    const isWhisper = clientWhisper || autoWhisper;
    const whisperSource = clientWhisper
      ? 'client'
      : autoWhisper
        ? 'auto'
        : undefined;
    const isAutoPlay = autoPlay === true;
    const isEpilogue = epilogue === true;
    const isLabPeer = labPeerAgents === true && !isWhisper;

    return this.packService.runWithPlayerAsync(playerId, async () => {
      await this.conversationService.ensureSession(playerId, npcId);
      const msgPreview =
        message.length > 48 ? `${message.slice(0, 48)}…` : message;
      this.logger.log(
        `player_chat player=${playerId} npc=${npcId} whisper=${isWhisper}${whisperSource ? `(${whisperSource})` : ''}${isAutoPlay ? ' autoPlay' : ''}${isEpilogue ? ' epilogue' : ''}${isLabPeer ? ' labPeer' : ''} msg="${msgPreview}" nearby=${(nearbyNpcIds ?? []).join(',') || '-'}`,
      );

      // 生产默认不回退 .env Key：无玩家配置则直接提示，避免 MOCK / 烧服主额度
      if (this.llmService.isMockMode()) {
        const tip =
          '请在设置中配置 LLM API Key（设置 → AI API），否则无法对话。';
        this.logger.warn(
          `player_chat blocked: no LLM credentials player=${playerId}`,
        );
        client.emit('npc_error', { npcId, message: tip });
        client.emit('npc_stream', { npcId, chunk: tip, replace: true });
        client.emit('npc_stream', { npcId, chunk: '', done: true });
        return;
      }

      try {
        // 导演：whisper / MA-Lab / 杀青跳过 LLM 排场外的复杂调度；杀青仍走主回复
        const directorDecision = isWhisper
          ? this.director.skippedWhisperDecision(npcId)
          : isLabPeer
            ? this.director.labPeerDecision(npcId)
            : await this.director.decide(
                await this.director.buildInput(
                  playerId,
                  npcId,
                  message,
                  nearbyNpcIds ?? [],
                ),
              );
        const shouldTryExchange =
          !isLabPeer &&
          !isEpilogue &&
          (directorDecision.fallback !== false ||
            directorDecision.mode === 'reply_then_exchange');
        this.logger.log(
          `director mode=${directorDecision.mode} fallback=${String(directorDecision.fallback)} speakers=[${directorDecision.speakers.join(',')}] reason="${directorDecision.reason}"`,
        );

        const result = await this.agentHarness.run(playerId, npcId, message, {
          director: directorDecision,
          whisperSource,
          autoPlay: isAutoPlay,
          labPeer: isLabPeer,
          epilogue: isEpilogue,
          breakWall: breakWall === true,
          breakWallAddress: breakWallAddress?.trim() || undefined,
        });

        let fullReply = '';
        for await (const chunk of result.stream) {
          if (chunk.text) {
            fullReply += chunk.text;
            client.emit('npc_stream', { npcId, chunk: chunk.text });
          }
        }
        client.emit('npc_stream', { npcId, chunk: '', done: true });

        // F：主回复厚扫描；不过则替换落档文案并通知客户端 replace
        const chapterState = this.worldProgress.getChapter(playerId);
        const safety = scanNpcReplySafety(fullReply, {
          pack: this.packService.getPack(),
          chapterState,
          npcId,
          autoPlay: isAutoPlay,
        });
        let safetyRewritten = false;
        if (!safety.ok) {
          const safeText = pickSafetyFallback();
          this.logger.warn(
            `safety rewrite player=${playerId} npc=${npcId}${isAutoPlay ? ' autoPlay' : ''} reasons=${safety.reasons.map((r) => r.code).join(',')}`,
          );
          fullReply = safeText;
          safetyRewritten = true;
          client.emit('npc_stream', {
            npcId,
            chunk: safeText,
            replace: true,
          });
          client.emit('npc_stream', { npcId, chunk: '', done: true });
        }
        this.agentTrace.appendSafety(playerId, npcId, {
          ok: safety.ok,
          rewritten: safetyRewritten,
          reasons: safety.reasons,
          traceId: result.traceId,
        });

        await this.agentHarness.recordAssistantReply(
          playerId,
          npcId,
          message,
          fullReply,
          { whisper: isWhisper, autoPlay: isAutoPlay, epilogue: isEpilogue },
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
        // MA-Lab：跳过 Pack exchange/aside，改走受限平级 tick + 进度推送
        if (isLabPeer) {
          const peer = await this.labPeer.runPeerTick({
            playerId,
            chatNpcId: npcId,
            nearbyNpcIds: nearbyNpcIds ?? [],
            playerMessage: message,
            assistantReply: fullReply,
            onProgress: (progress) => {
              client.emit('lab_progress', {
                chatNpcId: npcId,
                progress,
              });
            },
            onLine: async (line) => {
              await this.conversationService.appendLabPeerToSceneLog(
                playerId,
                line,
              );
              client.emit('lab_peer_line', line);
            },
          });
          this.agentTrace.appendLab(playerId, npcId, {
            peer_agents: true,
            stop_reason: peer.progress.stopReason,
            session_peer_lines: peer.progress.sessionPeerLines,
            round_peer_lines: peer.progress.roundPeerLines,
            traceId: result.traceId,
          });
        } else if (labPeerAgents === true && isWhisper) {
          const progress = this.labPeer
            .getMonitor(playerId)
            .abort('whisper');
          client.emit('lab_progress', {
            chatNpcId: npcId,
            progress,
          });
        } else if (!isWhisper && shouldTryExchange) {
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
              preferredSpeakerIds:
                directorDecision.mode === 'reply_then_exchange'
                  ? directorDecision.speakers
                  : undefined,
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

        // G：Pack endings 运行时结算（杀青禁写）
        if (!isEpilogue) {
          const endingHit = evaluateEndingSettlement({
            pack: this.packService.getPack(),
            chapterState: this.worldProgress.getChapter(playerId),
            flags: this.worldProgress.getFlags(playerId),
            playerMessage: message,
          });
          if (endingHit) {
            const cleared = await this.worldProgress.clearFlags(
              playerId,
              endingHit.clearFlags,
            );
            const setNames = await this.worldProgress.setFlags(
              playerId,
              endingHit.setFlags,
            );
            this.agentTrace.appendEnding(playerId, npcId, {
              ending_id: endingHit.endingId,
              display_name: endingHit.displayName,
              flags_set: endingHit.setFlags.filter((f) =>
                setNames.includes(f.name),
              ),
              flags_cleared: cleared,
              traceId: result.traceId,
            });
            client.emit('ending_reached', {
              endingId: endingHit.endingId,
              displayName: endingHit.displayName,
              notes: endingHit.notes,
              flagsSet: setNames,
              flagsCleared: cleared,
            });
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
            this.logger.log(
              `ending_reached player=${playerId} ${endingHit.endingId}`,
            );
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

      this.npcFollow.clearPlayer(playerId);
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
        this.labPeer.resetSession(playerId);
        this.npcFollow.clearPlayer(playerId);
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
