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
  listConversationArchivesPayloadSchema,
  loadConversationArchivePayloadSchema,
  playerChatPayloadSchema,
  requestNpcStatePayloadSchema,
  saveConversationPayloadSchema,
} from '@ocraft/shared';
import { AuthService } from '../auth/auth.service';
import { AgentHarnessService } from '../agent/agent-harness.service';
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
  server: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly agentHarness: AgentHarnessService,
    private readonly conversationService: ConversationService,
    private readonly npcService: NpcService,
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
    };
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
    await this.conversationService.ensureSession(playerId, npcId);

    client.emit(
      'npc_state_update',
      this.buildStatePayload(playerId, npcId),
    );
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
    const { npcId, message } = parsed.data;
    await this.conversationService.ensureSession(playerId, npcId);
    this.logger.log(
      `player_chat player=${playerId} npc=${npcId} msg="${message}"`,
    );

    try {
      const result = await this.agentHarness.run(playerId, npcId, message);

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
      );

      client.emit('npc_state_update', {
        ...this.buildStatePayload(playerId, npcId, result.animation),
        toolCalls: result.toolCalls,
      });
    } catch (err) {
      this.logger.error(err);
      client.emit('npc_error', {
        npcId,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
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
    await this.conversationService.ensureSession(playerId, npcId);
    const runtime = this.npcService.getRuntimeState(playerId, npcId);
    const result = await this.conversationService.saveSnapshot(
      playerId,
      npcId,
      runtime,
    );

    if (!result) {
      throw new WsException('没有可存档的对话');
    }

    client.emit('conversation_saved', {
      npcId,
      filename: result.filename,
      snapshotIndex: result.snapshotIndex,
      savedAt: result.savedAt,
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
    const archives = await this.conversationService.listArchives(
      playerId,
      npcId,
    );
    client.emit('conversation_archives_list', {
      npcId,
      archives,
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
    const restored = await this.conversationService.restoreSnapshot(
      playerId,
      npcId,
      filename,
      snapshotIndex,
    );

    this.npcService.updateRuntimeState(playerId, npcId, restored.npcState);

    client.emit('conversation_loaded', {
      npcId,
      filename: restored.filename,
      snapshotIndex: restored.snapshotIndex,
      messages: restored.messages,
      npc_state: {
        ...restored.npcState,
        chapter_state: restored.chapterState,
      },
    });

    client.emit(
      'npc_state_update',
      this.buildStatePayload(
        playerId,
        npcId,
        restored.npcState.current_status,
      ),
    );
  }
}
