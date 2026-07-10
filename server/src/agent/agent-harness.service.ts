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
import { StoryFlagService } from '../story/story-flag.service';
import { PackService } from '../story/pack.service';
import {
  evaluateChapterTransition,
  evaluateNpcReplyFlags,
} from './chapter-transition';

export interface AgentRunResult {
  toolCalls: ToolCallResult[];
  finalState: NpcRuntimeState;
  animation: string;
  stream: AsyncGenerator<{ text: string; done?: boolean }>;
}

@Injectable()
export class AgentHarnessService {
  private readonly logger = new Logger(AgentHarnessService.name);

  constructor(
    private readonly npcService: NpcService,
    private readonly ragService: RagService,
    private readonly llmService: LlmService,
    private readonly conversationService: ConversationService,
    private readonly storyFlagService: StoryFlagService,
    private readonly packService: PackService,
  ) {}

  async run(
    playerId: string,
    npcId: string,
    playerMessage: string,
  ): Promise<AgentRunResult> {
    const pack = this.packService.getPack();
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

    const flags = this.storyFlagService.getFlags(playerId, npcId);
    const transition = evaluateChapterTransition({
      chapterState,
      playerMessage,
      runtimeState: postToolState,
      flags,
      triggers: pack.triggers,
    });

    if (transition.flagsToSet.length > 0) {
      await this.storyFlagService.setFlags(
        playerId,
        npcId,
        transition.flagsToSet,
      );
    }

    if (transition.chapterState !== chapterState) {
      chapterState = await this.conversationService.setChapterState(
        playerId,
        npcId,
        transition.chapterState,
      );
      this.logger.log(
        `Chapter advanced player=${playerId} npc=${npcId} → ${chapterState}`,
      );
    }

    const storyFlags = this.storyFlagService.getFlags(playerId, npcId);
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
      storyFlags,
    });
    const replyInstruction = pack.prompts.reply_instruction;
    const systemContent = `${systemPrompt}\n\n【相关长期记忆】\n${memoryContext}\n\n${replyInstruction}`;

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
      `Agent run player=${playerId} npc=${npcId} pack=${pack.header.world_id}/${pack.version_dir} chapter=${chapterState} flags=${Object.keys(storyFlags).join(',') || '-'} ragHits=${ragHits.length} tools=${toolCalls.length} mock=${this.llmService.isMockMode()}`,
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

    const chapterState = this.conversationService.getChapterState(
      playerId,
      npcId,
    );
    const flags = this.storyFlagService.getFlags(playerId, npcId);
    const replyFlags = evaluateNpcReplyFlags(
      chapterState,
      assistantReply,
      flags,
      this.packService.getPack().triggers,
    );
    if (replyFlags.length > 0) {
      await this.storyFlagService.setFlags(playerId, npcId, replyFlags);
    }
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
    const numeric = this.packService.getPack().world.numeric_tools;

    const fatigueUp = numeric.fatigue_increase.triggers.some((t) =>
      msg.includes(t.toLowerCase()),
    );
    const interest = interestTriggers.some((t) =>
      msg.includes(t.toLowerCase()),
    );

    if (fatigueUp) {
      const fatigueArgs = updateFatigueSchema.parse({
        delta: numeric.fatigue_increase.delta,
        reason: numeric.fatigue_increase.reason,
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
        delta: numeric.interest_hit.affinity_delta,
        reason: numeric.interest_hit.affinity_reason,
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
        delta: numeric.interest_hit.fatigue_delta,
        reason: numeric.interest_hit.fatigue_reason,
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

  private resolveAnimation(
    _playerId: string,
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

    const msg = message.toLowerCase();
    const interestTriggers = this.npcService.getInterestTriggers(npcId);
    const interestHit = interestTriggers.some((t) =>
      msg.includes(t.toLowerCase()),
    );

    const rules = this.packService.getPack().world.animation_rules;
    for (const rule of rules) {
      if (!rule.enabled) continue;
      const when = rule.when;

      if (
        when.fatigue_delta_gt !== undefined &&
        !(fatigueDelta > when.fatigue_delta_gt)
      ) {
        continue;
      }
      if (
        when.fatigue_delta_lt !== undefined &&
        !(fatigueDelta < when.fatigue_delta_lt)
      ) {
        continue;
      }
      if (when.message_triggers !== undefined) {
        const hit = when.message_triggers.some((t) =>
          msg.includes(t.toLowerCase()),
        );
        if (!hit) continue;
      }
      if (when.interest_hit !== undefined && when.interest_hit !== interestHit) {
        continue;
      }
      if (
        when.current_status !== undefined &&
        state.current_status !== when.current_status
      ) {
        continue;
      }

      return rule.animation;
    }

    return state.current_status;
  }
}
