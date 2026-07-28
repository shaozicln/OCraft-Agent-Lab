import { Injectable, Logger } from '@nestjs/common';
import type {
  LlmMessage,
  NpcExchangeEvent,
  PackExchangeEvent,
} from '@ocraft/shared';
import { LlmService } from '../core/llm.service';
import { AgentTraceService } from '../observability/agent-trace.service';
import { evaluateExchangeEvents } from '../rules/npc-exchange';
import { looksLikeAiSlop } from '../safety/reply-guard';
import { NpcService } from '../../npc/npc.service';
import { WorldProgressService } from '../../story/world-progress.service';
import { PackService } from '../../story/pack.service';

@Injectable()
export class NpcExchangeService {
  private readonly logger = new Logger(NpcExchangeService.name);

  constructor(
    private readonly packService: PackService,
    private readonly worldProgress: WorldProgressService,
    private readonly npcService: NpcService,
    private readonly llmService: LlmService,
    private readonly agentTrace: AgentTraceService,
  ) {}

  /**
   * 主对话结束后尝试触发关系事件互聊。
   * 进度取 world_progress（L2）；失败不抛，返回 null。
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
      await this.worldProgress.ensureHydrated(playerId);
      const chapterState = this.worldProgress.getChapter(playerId);
      const flags = this.worldProgress.getFlags(playerId);

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
        const text = await this.generateLineWithGuard({
          playerId,
          event,
          speakerId,
          otherId,
          speakerIndex: i,
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
        await this.worldProgress.setFlags(
          playerId,
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

  private resolveFallback(
    event: PackExchangeEvent,
    speakerIndex: number,
    speakerName: string,
    otherName: string,
  ): string {
    const fromPack = event.fallback_lines?.[speakerIndex]?.trim();
    if (fromPack) return fromPack;
    const generics = [
      `${otherName}……你也听到那些传闻了？`,
      `……嗯。先别声张。`,
    ];
    return generics[speakerIndex % generics.length] ?? `${speakerName}：……`;
  }

  private async generateLineWithGuard(opts: {
    playerId: string;
    event: PackExchangeEvent;
    speakerId: string;
    otherId: string;
    speakerIndex: number;
    chapterState: string;
    playerMessage: string;
    assistantReply: string;
    priorLines: NpcExchangeEvent['lines'];
  }): Promise<string> {
    const pack = this.packService.getPack();
    const speakerName =
      pack.npcs.find((n) => n.npc_id === opts.speakerId)?.name ??
      opts.speakerId;
    const otherName =
      pack.npcs.find((n) => n.npc_id === opts.otherId)?.name ?? opts.otherId;

    let text = await this.generateLine({ ...opts, forceRewrite: false });
    if (looksLikeAiSlop(text)) {
      this.logger.warn(
        `Exchange AI-slop retry event=${opts.event.id} speaker=${opts.speakerId}`,
      );
      text = await this.generateLine({ ...opts, forceRewrite: true });
    }
    if (looksLikeAiSlop(text)) {
      text = this.resolveFallback(
        opts.event,
        opts.speakerIndex,
        speakerName,
        otherName,
      );
      this.logger.warn(
        `Exchange fallback event=${opts.event.id} speaker=${opts.speakerId}`,
      );
    }
    return text.trim();
  }

  private async generateLine(opts: {
    playerId: string;
    event: PackExchangeEvent;
    speakerId: string;
    otherId: string;
    speakerIndex: number;
    chapterState: string;
    playerMessage: string;
    assistantReply: string;
    priorLines: NpcExchangeEvent['lines'];
    forceRewrite?: boolean;
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
      forceRewrite,
    } = opts;
    const pack = this.packService.getPack();
    const otherName =
      pack.npcs.find((n) => n.npc_id === otherId)?.name ?? otherId;
    const speakerName =
      pack.npcs.find((n) => n.npc_id === speakerId)?.name ?? speakerId;

    const preState = this.npcService.getRuntimeState(playerId, speakerId);
    const storyFlags = this.worldProgress.getFlags(playerId);
    const basePrompt = this.npcService.buildSystemPrompt(speakerId, {
      chapterState,
      affinity: preState.affinity,
      fatigue: preState.fatigue,
      currentStatus: preState.current_status,
      storyFlags,
    });

    const beatHint =
      event.beat_hints[opts.speakerIndex] ??
      event.beat_hints[0] ??
      '';
    const beat = beatHint
      ? `【本段应触及】\n- ${beatHint}`
      : event.beat_hints.length > 0
        ? `【本段应触及】\n${event.beat_hints.map((h) => `- ${h}`).join('\n')}`
        : '';

    const exchangePolicy = [
      '【互聊模式·旁听戏】',
      `你正在对「${otherName}」说话，不是对玩家沈檐。`,
      '只说 1～2 句口语短对白；禁止替对方说话；禁止总结剧情；禁止宣布升章或改结局。',
      '严禁自称 AI / 语言模型 / 助手；不要输出工具调用或 JSON。',
      '禁止说：游戏、存档、模拟、结局、世界是假的（除非对方先说且你只含糊带过）。',
      forceRewrite
        ? '上一稿不合格（像讲解或AI腔），请完全重写成角色口语短句。'
        : '',
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
      temperature: forceRewrite ? 0.25 : 0.4,
      maxTokens: 100,
    });
  }
}
