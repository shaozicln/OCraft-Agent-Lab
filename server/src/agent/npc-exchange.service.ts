import { Injectable, Logger } from '@nestjs/common';
import type {
  LlmMessage,
  NpcExchangeEvent,
  PackExchangeEvent,
} from '@ocraft/shared';
import { getDefaultNpcId } from '@ocraft/shared';
import { LlmService } from './llm.service';
import { AgentTraceService } from './agent-trace.service';
import { evaluateExchangeEvents } from './npc-exchange';
import { NpcService } from '../npc/npc.service';
import { ConversationService } from '../game/conversation.service';
import { StoryFlagService } from '../story/story-flag.service';
import { PackService } from '../story/pack.service';

@Injectable()
export class NpcExchangeService {
  private readonly logger = new Logger(NpcExchangeService.name);

  constructor(
    private readonly packService: PackService,
    private readonly conversationService: ConversationService,
    private readonly storyFlagService: StoryFlagService,
    private readonly npcService: NpcService,
    private readonly llmService: LlmService,
    private readonly agentTrace: AgentTraceService,
  ) {}

  /**
   * 主对话结束后尝试触发关系事件互聊。
   * 进度取 default_npc 的章/flags；失败不抛，返回 null。
   */
  async tryRunAfterChat(opts: {
    playerId: string;
    chatNpcId: string;
    playerMessage: string;
    assistantReply: string;
    traceId?: string;
  }): Promise<NpcExchangeEvent | null> {
    const { playerId, chatNpcId, playerMessage, assistantReply, traceId } =
      opts;

    try {
      const pack = this.packService.getPack();
      const progressNpcId = getDefaultNpcId(pack);
      const chapterState = this.conversationService.getChapterState(
        playerId,
        progressNpcId,
      );
      const flags = this.storyFlagService.getFlags(playerId, progressNpcId);

      const event = evaluateExchangeEvents(
        chapterState,
        flags,
        pack.triggers,
      );
      if (!event) return null;

      this.logger.log(
        `Exchange match player=${playerId} event=${event.id} chapter=${chapterState}`,
      );

      const lines: NpcExchangeEvent['lines'] = [];
      const [speakerA, speakerB] = event.speakers;

      for (let i = 0; i < event.speakers.length; i++) {
        const speakerId = event.speakers[i];
        const otherId = i === 0 ? speakerB : speakerA;
        const text = await this.generateLine({
          playerId,
          event,
          speakerId,
          otherId,
          chapterState,
          playerMessage,
          assistantReply,
          priorLines: lines,
        });
        if (!text.trim()) {
          this.logger.warn(
            `Exchange line empty event=${event.id} speaker=${speakerId}; abort`,
          );
          return null;
        }
        const name =
          pack.npcs.find((n) => n.npc_id === speakerId)?.name ?? speakerId;
        lines.push({ npcId: speakerId, name, text: text.trim() });
      }

      if (event.set_flags.length > 0) {
        await this.storyFlagService.setFlags(
          playerId,
          progressNpcId,
          event.set_flags.map((f) => ({ name: f.name, value: f.value })),
        );
      }

      const payload: NpcExchangeEvent = {
        eventId: event.id,
        chatNpcId,
        lines,
      };

      this.agentTrace.appendExchange(playerId, chatNpcId, {
        event_id: event.id,
        lines: lines.map((l) => ({
          npc_id: l.npcId,
          name: l.name,
          text: l.text,
        })),
        traceId,
      });

      this.logger.log(
        `Exchange done player=${playerId} event=${event.id} lines=${lines.length} mock=${this.llmService.isMockMode()}`,
      );

      return payload;
    } catch (err) {
      this.logger.error(
        `Exchange failed player=${opts.playerId}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private async generateLine(opts: {
    playerId: string;
    event: PackExchangeEvent;
    speakerId: string;
    otherId: string;
    chapterState: string;
    playerMessage: string;
    assistantReply: string;
    priorLines: NpcExchangeEvent['lines'];
  }): Promise<string> {
    const {
      playerId,
      event,
      speakerId,
      otherId,
      chapterState,
      playerMessage,
      assistantReply,
      priorLines,
    } = opts;
    const pack = this.packService.getPack();
    const otherName =
      pack.npcs.find((n) => n.npc_id === otherId)?.name ?? otherId;
    const speakerName =
      pack.npcs.find((n) => n.npc_id === speakerId)?.name ?? speakerId;

    const preState = this.npcService.getRuntimeState(playerId, speakerId);
    const storyFlags = this.storyFlagService.getFlags(playerId, speakerId);
    const basePrompt = this.npcService.buildSystemPrompt(speakerId, {
      chapterState,
      affinity: preState.affinity,
      fatigue: preState.fatigue,
      currentStatus: preState.current_status,
      storyFlags,
    });

    const beat =
      event.beat_hints.length > 0
        ? `【本段应触及】\n${event.beat_hints.map((h) => `- ${h}`).join('\n')}`
        : '';

    const exchangePolicy = [
      '【互聊模式·旁听戏】',
      `你正在对「${otherName}」说话，不是对玩家沈檐。`,
      '只说 1～2 句口语短对白；禁止替对方说话；禁止总结剧情；禁止宣布升章或改结局。',
      '不要输出工具调用或 JSON。',
      beat,
    ]
      .filter(Boolean)
      .join('\n');

    const prior =
      priorLines.length > 0
        ? priorLines.map((l) => `${l.name}：${l.text}`).join('\n')
        : '（尚未开口）';

    const userContent = [
      `玩家刚才对场景说：「${playerMessage}」`,
      `（刚才有人对玩家的回复摘要：「${assistantReply.slice(0, 120)}${assistantReply.length > 120 ? '…' : ''}」）`,
      `已发生的互聊：\n${prior}`,
      `请以「${speakerName}」身份对「${otherName}」说下一句。`,
    ].join('\n\n');

    const messages: LlmMessage[] = [
      { role: 'system', content: `${basePrompt}\n\n${exchangePolicy}` },
      { role: 'user', content: userContent },
    ];

    return this.llmService.complete(messages, {
      temperature: 0.4,
      maxTokens: 120,
    });
  }
}
