import { Injectable, Logger } from '@nestjs/common';
import {
  FEEL_DEMO_AUTO_GOAL,
  mockProposeAutoPlayNext,
  parseAutoPlayNextJson,
  type AutoPlayGoal,
  type AutoPlayNextProposal,
  type LlmMessage,
} from '@ocraft/shared';
import { LlmService } from '../core/llm.service';
import { PackService } from '../../story/pack.service';
import { WorldProgressService } from '../../story/world-progress.service';
import { ConversationService } from '../../game/conversation.service';
import { NpcService } from '../../npc/npc.service';
import { listAvailableExchangeEventIds } from '../rules/npc-exchange';
import {
  PUBLIC_SCENE_LINE_LIMIT,
  formatSceneUtteranceLines,
} from '../memory/scene-working-memory';

@Injectable()
export class AutoPlayAgentService {
  private readonly logger = new Logger(AutoPlayAgentService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly packService: PackService,
    private readonly worldProgress: WorldProgressService,
    private readonly conversationService: ConversationService,
    private readonly npcService: NpcService,
  ) {}

  async proposeNext(opts: {
    playerId: string;
    npcId: string;
    turnIndex: number;
    maxTurns?: number;
    priorSays?: string[];
    sawTargetExchange?: boolean;
    targetChapter?: string;
    targetExchange?: string;
  }): Promise<AutoPlayNextProposal> {
    const pack = this.packService.getPack();
    await this.worldProgress.ensureHydrated(opts.playerId);
    await this.conversationService.ensureSceneLogReady(opts.playerId);

    const goal: AutoPlayGoal = {
      ...FEEL_DEMO_AUTO_GOAL,
      npc_id: opts.npcId,
      max_turns: opts.maxTurns ?? FEEL_DEMO_AUTO_GOAL.max_turns,
      target_chapter:
        opts.targetChapter ?? FEEL_DEMO_AUTO_GOAL.target_chapter,
      target_exchange:
        opts.targetExchange ?? FEEL_DEMO_AUTO_GOAL.target_exchange,
    };

    const chapterId = this.worldProgress.getChapter(opts.playerId);
    const chapterMeta = pack.world.chapters.find((c) => c.id === chapterId);
    const chapterLabel =
      chapterMeta?.hud_label || chapterMeta?.display_name || chapterId;
    const flags = this.worldProgress.getFlags(opts.playerId);
    const flagNames = Object.keys(flags);
    const availableEvents = listAvailableExchangeEventIds(
      chapterId,
      flags,
      pack.triggers,
    );
    const recentLines = formatSceneUtteranceLines(
      this.conversationService
        .getPublicSceneLog(opts.playerId)
        .slice(-PUBLIC_SCENE_LINE_LIMIT),
    );
    const focusNpcName =
      this.npcService.getDefinition(opts.npcId)?.name ?? opts.npcId;

    const input = {
      goal,
      turnIndex: opts.turnIndex,
      chapterId,
      chapterLabel,
      flagNames,
      availableEvents,
      recentLines,
      priorSays: opts.priorSays ?? [],
      focusNpcName,
      sawTargetExchange: opts.sawTargetExchange === true,
    };

    if (this.llmService.isMockMode()) {
      return mockProposeAutoPlayNext(input);
    }

    try {
      const messages = this.buildPrompt(input);
      const raw = await this.llmService.complete(messages, {
        temperature: 0.55,
        maxTokens: 220,
        json: true,
      });
      const parsed = parseAutoPlayNextJson(raw);
      if (parsed) {
        this.logger.log(
          `autoplay next player=${opts.playerId} turn=${opts.turnIndex} done=${parsed.done} say="${parsed.say ?? ''}" reason="${parsed.reason}"`,
        );
        return parsed;
      }
      this.logger.warn('autoplay propose: invalid JSON, fallback mock');
    } catch (err) {
      this.logger.warn(
        `autoplay propose failed: ${err instanceof Error ? err.message : err}`,
      );
    }
    return mockProposeAutoPlayNext(input);
  }

  private buildPrompt(input: {
    goal: AutoPlayGoal;
    turnIndex: number;
    chapterId: string;
    chapterLabel: string;
    flagNames: string[];
    availableEvents: string[];
    recentLines: string[];
    priorSays: string[];
    focusNpcName: string;
    sawTargetExchange: boolean;
  }): LlmMessage[] {
    const goalBits = [
      input.goal.target_chapter
        ? `目标章 ${input.goal.target_chapter}`
        : null,
      input.goal.target_exchange
        ? `目标互聊 ${input.goal.target_exchange}`
        : null,
    ]
      .filter(Boolean)
      .join('；');

    return [
      {
        role: 'system',
        content: [
          '你是自动演「假玩家」编剧助手，配合场景导演推进剧情。',
          '职责：根据当前章、旗标、可尝试戏码与近期对白，写下一句玩家会说的短口语。',
          '禁止：改章节、发明 Pack 外事件、剧透未解锁内容、自称 AI、对系统说话。',
          '若目标已达成或无需再代发，设 done=true 且可省略 say。',
          '否则 done=false 且必须给 say（≤40 字，像真人玩家）。',
          '只输出 JSON：{"say":"...","done":false,"reason":"..."}',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `【焦点 NPC】${input.focusNpcName}`,
          `【当前章节】${input.chapterLabel}（${input.chapterId}）`,
          `【旗标】${input.flagNames.join(', ') || '（无）'}`,
          `【可尝试戏码 id】${input.availableEvents.join(', ') || '（无）'}`,
          `【自动演目标】${goalBits || '自然推进对话'}`,
          `【目标互聊已见】${input.sawTargetExchange ? '是' : '否'}`,
          `【拍序】${input.turnIndex + 1}/${input.goal.max_turns}`,
          `【本局已代发】\n${input.priorSays.map((s, i) => `${i + 1}. ${s}`).join('\n') || '（无）'}`,
          `【近期对白】\n${input.recentLines.join('\n') || '（尚无）'}`,
          '请给出下一拍决策 JSON。',
        ].join('\n\n'),
      },
    ];
  }
}
