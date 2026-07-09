import { Injectable, Logger } from '@nestjs/common';
import {
  LlmMessage,
  NpcRuntimeState,
  ToolCallResult,
  UpdateFatigueArgs,
  updateAffinitySchema,
  updateFatigueSchema,
} from '@ocraft/shared';
import { LlmService } from './llm.service';
import { RagService } from './rag.service';
import { NpcService } from '../npc/npc.service';
import { ConversationService } from '../game/conversation.service';
import { evaluateChapterTransition } from './chapter-transition';

export interface AgentRunResult {
  toolCalls: ToolCallResult[];
  finalState: NpcRuntimeState;
  animation: string;
  stream: AsyncGenerator<{ text: string; done?: boolean }>;
}

@Injectable()
export class AgentHarnessService {
  private readonly logger = new Logger(AgentHarnessService.name);

  private readonly fatigueIncreaseTriggers = [
    '加班', '开会', '汇报', '需求', '报告', '熬夜', 'bug', '工单', 'deadline',
  ];

  constructor(
    private readonly npcService: NpcService,
    private readonly ragService: RagService,
    private readonly llmService: LlmService,
    private readonly conversationService: ConversationService,
  ) {}

  async run(
    playerId: string,
    npcId: string,
    playerMessage: string,
  ): Promise<AgentRunResult> {
    const toolCalls: ToolCallResult[] = [];
    let chapterState = this.conversationService.getChapterState(
      playerId,
      npcId,
    );

    const postToolState = this.applyKeywordTools(
      playerId,
      npcId,
      playerMessage,
      toolCalls,
    );

    const nextChapter = evaluateChapterTransition({
      chapterState,
      playerMessage,
      runtimeState: postToolState,
    });
    if (nextChapter !== chapterState) {
      chapterState = await this.conversationService.setChapterState(
        playerId,
        npcId,
        nextChapter,
      );
      this.logger.log(
        `Chapter advanced player=${playerId} npc=${npcId} → ${chapterState}`,
      );
    }

    const ragHits = this.ragService.retrieve(
      npcId,
      playerMessage,
      chapterState,
    );
    const memoryContext = this.ragService.formatMemoriesForPrompt(ragHits);

    const runtimeForPrompt = postToolState;
    const systemPrompt = this.npcService.buildSystemPrompt(npcId, {
      chapterState,
      affinity: runtimeForPrompt.affinity,
      fatigue: runtimeForPrompt.fatigue,
      currentStatus: runtimeForPrompt.current_status,
    });
    const systemContent = `${systemPrompt}\n\n【相关长期记忆】\n${memoryContext}\n\n请用中文、口语化、符合人设地回复玩家。回复控制在 2-4 句话。`;

    const messages: LlmMessage[] =
      this.conversationService.buildDialogMessages(
        playerId,
        npcId,
        systemContent,
        playerMessage,
      );

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `[dev prompt] ${JSON.stringify(messages, null, 2)}`,
      );
    }

    const animation = this.resolveAnimation(
      playerId,
      npcId,
      playerMessage,
      postToolState,
      toolCalls,
    );
    if (animation !== postToolState.current_status) {
      this.npcService.updateRuntimeState(playerId, npcId, {
        current_status: animation,
      });
    }

    const finalState = this.npcService.getRuntimeState(playerId, npcId);
    const stream = this.llmService.streamChat(messages, { toolCalls });

    this.logger.log(
      `Agent run player=${playerId} npc=${npcId} chapter=${chapterState} ragHits=${ragHits.length} tools=${toolCalls.length} mock=${this.llmService.isMockMode()}`,
    );

    return { toolCalls, finalState, animation, stream };
  }

  async recordAssistantReply(
    playerId: string,
    npcId: string,
    userMessage: string,
    assistantReply: string,
  ) {
    await this.conversationService.appendTurn(playerId, npcId, 'user', userMessage);
    await this.conversationService.appendTurn(
      playerId,
      npcId,
      'assistant',
      assistantReply,
    );
  }

  private applyKeywordTools(
    playerId: string,
    npcId: string,
    message: string,
    toolCalls: ToolCallResult[],
  ): NpcRuntimeState {
    let state = this.npcService.getRuntimeState(playerId, npcId);
    const msg = message.toLowerCase();
    const interestTriggers = this.npcService.getInterestTriggers(npcId);

    const fatigueUp = this.fatigueIncreaseTriggers.some((t) =>
      msg.includes(t.toLowerCase()),
    );
    const interest = interestTriggers.some((t) =>
      msg.includes(t.toLowerCase()),
    );

    if (fatigueUp) {
      const fatigueArgs = updateFatigueSchema.parse({
        delta: 15,
        reason: '工作话题加重疲惫',
      });
      state = this.npcService.updateRuntimeState(playerId, npcId, {
        fatigue: state.fatigue + fatigueArgs.delta,
      });
      toolCalls.push({
        tool: 'updateFatigue',
        args: fatigueArgs,
        observation: `疲惫值 +${fatigueArgs.delta} → ${state.fatigue}`,
      });
    } else if (interest) {
      const affinityArgs = updateAffinitySchema.parse({
        delta: 10,
        reason: '共同兴趣',
      });
      state = this.npcService.updateRuntimeState(playerId, npcId, {
        affinity: state.affinity + affinityArgs.delta,
      });
      toolCalls.push({
        tool: 'updateAffinity',
        args: affinityArgs,
        observation: `好感度 +${affinityArgs.delta} → ${state.affinity}`,
      });

      const fatigueArgs = updateFatigueSchema.parse({
        delta: -15,
        reason: '提到兴趣话题',
      });
      state = this.npcService.updateRuntimeState(playerId, npcId, {
        fatigue: state.fatigue + fatigueArgs.delta,
      });
      toolCalls.push({
        tool: 'updateFatigue',
        args: fatigueArgs,
        observation: `疲惫值 ${fatigueArgs.delta} → ${state.fatigue}`,
      });
    }

    return state;
  }

  private matchesGameTopic(message: string, npcId: string): boolean {
    const msg = message.toLowerCase();
    return this.npcService.getInterestTriggers(npcId).some(
      (trigger) =>
        /游戏|steam|端游|开黑|网游/i.test(trigger) &&
        msg.includes(trigger.toLowerCase()),
    );
  }

  private resolveAnimation(
    playerId: string,
    npcId: string,
    message: string,
    state: NpcRuntimeState,
    toolCalls: ToolCallResult[],
  ): string {
    const fatigueDelta = toolCalls
      .filter((t) => t.tool === 'updateFatigue')
      .reduce(
        (sum, t) => sum + (t.args as UpdateFatigueArgs).delta,
        0,
      );

    if (fatigueDelta > 0) {
      return 'sleeping';
    }

    const msg = message.toLowerCase();
    const interestTriggers = this.npcService.getInterestTriggers(npcId);

    if (fatigueDelta < 0) {
      if (this.matchesGameTopic(message, npcId)) {
        return 'excited_talk';
      }
      return 'talk';
    }

    if (this.matchesGameTopic(message, npcId)) {
      return 'excited_talk';
    }
    if (
      interestTriggers.some(
        (t) =>
          !t.includes('游戏') &&
          msg.includes(t.toLowerCase()),
      )
    ) {
      return 'talk';
    }

    return state.current_status === 'sleeping' ? 'talk' : state.current_status;
  }
}
