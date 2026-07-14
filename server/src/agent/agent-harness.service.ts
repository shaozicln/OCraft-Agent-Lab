import { Injectable, Logger } from '@nestjs/common';
import type OpenAI from 'openai';
import {
  LlmMessage,
  NpcRuntimeState,
  ToolCallResult,
  UpdateAffinityArgs,
  UpdateFatigueArgs,
  updateAffinitySchema,
  updateFatigueSchema,
} from '@ocraft/shared';
import { randomUUID } from 'crypto';
import { LlmService } from './llm.service';
import { RagService } from './rag.service';
import { AgentTraceService } from './agent-trace.service';
import { NpcService } from '../npc/npc.service';
import { ConversationService } from '../game/conversation.service';
import { StoryFlagService } from '../story/story-flag.service';
import { PackService } from '../story/pack.service';
import {
  evaluateChapterTransition,
  evaluateNpcReplyFlags,
} from './chapter-transition';
import { buildNpcToolDefinitions } from './npc-tool-defs';

export interface AgentRunResult {
  toolCalls: ToolCallResult[];
  finalState: NpcRuntimeState;
  animation: string;
  stream: AsyncGenerator<{ text: string; done?: boolean }>;
  traceId: string;
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
    private readonly agentTrace: AgentTraceService,
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
    const chapterBefore = chapterState;

    const preState = this.npcService.getRuntimeState(playerId, npcId);
    const storyFlagsBefore = this.storyFlagService.getFlags(playerId, npcId);
    const ragHits = this.ragService.retrieve(
      npcId,
      playerMessage,
      chapterState,
    );
    const memoryContext = this.ragService.formatMemoriesForPrompt(ragHits);

    const systemPrompt = this.npcService.buildSystemPrompt(npcId, {
      chapterState,
      affinity: preState.affinity,
      fatigue: preState.fatigue,
      currentStatus: preState.current_status,
      storyFlags: storyFlagsBefore,
    });
    const toolPolicy = [
      '【工具】你可以通过 function calling 调用 updateFatigue / updateAffinity 改变数值。',
      '不要在回复正文里伪造工具 JSON；需要改数值时请发起 tool call。',
      '无关闲聊可不调用工具。',
    ].join('');
    const systemContent = `${systemPrompt}\n\n【相关长期记忆】\n${memoryContext}\n\n${pack.prompts.reply_instruction}\n\n${toolPolicy}`;

    const dialogMessages = this.conversationService.buildDialogMessages(
      playerId,
      npcId,
      systemContent,
      playerMessage,
    );

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[dev prompt] ${JSON.stringify(dialogMessages, null, 2)}`);
    }

    const openaiMessages = this.toOpenAiMessages(dialogMessages);
    const tools = buildNpcToolDefinitions(pack);
    const fc = await this.llmService.chatWithTools(openaiMessages, tools, {
      temperature: 0.35,
    });

    for (const tc of fc.toolCalls) {
      try {
        this.executeToolCall(playerId, npcId, tc.name, tc.arguments, toolCalls);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`tool ${tc.name} rejected: ${msg}`);
        toolCalls.push({
          tool: tc.name,
          args: {},
          observation: `工具调用失败：${msg}`,
        });
      }
    }

    let postToolState = this.npcService.getRuntimeState(playerId, npcId);

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

    postToolState = this.npcService.getRuntimeState(playerId, npcId);
    const storyFlags = this.storyFlagService.getFlags(playerId, npcId);
    const systemAfter = this.npcService.buildSystemPrompt(npcId, {
      chapterState,
      affinity: postToolState.affinity,
      fatigue: postToolState.fatigue,
      currentStatus: postToolState.current_status,
      storyFlags,
    });
    const toolObs =
      toolCalls.length > 0
        ? `\n\n【本轮已执行工具】\n${toolCalls.map((t) => `- ${t.tool}: ${t.observation}`).join('\n')}`
        : '';
    const replySystem = `${systemAfter}\n\n【相关长期记忆】\n${memoryContext}\n\n${pack.prompts.reply_instruction}${toolObs}\n\n请用角色口吻直接回复玩家，不要再输出工具调用。`;

    const replyMessages = this.conversationService.buildDialogMessages(
      playerId,
      npcId,
      replySystem,
      playerMessage,
    );

    const animation = this.resolveAnimation(
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
    const stream = this.llmService.streamChat(replyMessages, { toolCalls });

    const traceId = randomUUID();
    this.agentTrace.record({
      id: traceId,
      at: new Date().toISOString(),
      player_id: playerId,
      npc_id: npcId,
      world_id: pack.header.world_id,
      pack_version_id: pack.version_dir,
      player_message: playerMessage,
      mock: this.llmService.isMockMode(),
      runtime_before: {
        affinity: preState.affinity,
        fatigue: preState.fatigue,
        current_status: preState.current_status,
      },
      runtime_after: {
        affinity: finalState.affinity,
        fatigue: finalState.fatigue,
        current_status: finalState.current_status,
      },
      tools: toolCalls,
      transition: {
        chapter_before: chapterBefore,
        chapter_after: chapterState,
        flags_set: transition.flagsToSet,
        matched_rule_ids: transition.matchedRuleIds,
      },
      rag_hits: ragHits.map((h) => ({
        memory_id: h.memory.id,
        score: h.score,
      })),
      animation,
    });

    this.logger.log(
      `Agent run player=${playerId} npc=${npcId} pack=${pack.header.world_id}/${pack.version_dir} chapter=${chapterState} flags=${Object.keys(storyFlags).join(',') || '-'} ragHits=${ragHits.length} tools=${toolCalls.map((t) => t.tool).join(',') || '-'} mock=${this.llmService.isMockMode()} trace=${traceId}`,
    );

    return { toolCalls, finalState, animation, stream, traceId };
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
      this.agentTrace.appendReplyFlags(playerId, npcId, replyFlags);
    }
  }

  private toOpenAiMessages(
    messages: LlmMessage[],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  private executeToolCall(
    playerId: string,
    npcId: string,
    name: string,
    rawArgs: string,
    toolCalls: ToolCallResult[],
  ) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawArgs || '{}');
    } catch {
      throw new Error('参数不是合法 JSON');
    }

    let state = this.npcService.getRuntimeState(playerId, npcId);

    if (name === 'updateFatigue') {
      const args = updateFatigueSchema.parse(parsed);
      state = this.npcService.updateRuntimeState(playerId, npcId, {
        fatigue: state.fatigue + args.delta,
      });
      toolCalls.push({
        tool: 'updateFatigue',
        args,
        observation: `疲惫 ${args.delta >= 0 ? '+' : ''}${args.delta} → ${state.fatigue}${args.reason ? `（${args.reason}）` : ''}`,
      });
      return;
    }

    if (name === 'updateAffinity') {
      const args = updateAffinitySchema.parse(parsed);
      state = this.npcService.updateRuntimeState(playerId, npcId, {
        affinity: state.affinity + args.delta,
      });
      toolCalls.push({
        tool: 'updateAffinity',
        args,
        observation: `好感 ${args.delta >= 0 ? '+' : ''}${args.delta} → ${state.affinity}${args.reason ? `（${args.reason}）` : ''}`,
      });
      return;
    }

    throw new Error(`未知或不允许的工具: ${name}`);
  }

  private resolveAnimation(
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

    const affinityDelta = toolCalls
      .filter((t) => t.tool === 'updateAffinity')
      .reduce(
        (sum, t) => sum + Number((t.args as UpdateAffinityArgs).delta ?? 0),
        0,
      );
    /** 正好感 tool ≈ 原 interest_hit */
    const interestHit = affinityDelta > 0;

    const msg = message.toLowerCase();
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
