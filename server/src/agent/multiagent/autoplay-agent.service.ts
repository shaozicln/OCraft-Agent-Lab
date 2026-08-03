import { Injectable, Logger } from '@nestjs/common';
import {
  autoPlayGoalSchema,
  getAutoPlayStyleMaxSpeakers,
  getAutoPlayStylePreset,
  getChapterRankMap,
  getPackPlayablePlayerId,
  isPackPlayablePlayerPresent,
  mockProposeAutoPlayNext,
  normalizeAutoPlayBeatLines,
  parseAutoPlayNextJson,
  type AutoPlayBeatLine,
  type AutoPlayGoal,
  type AutoPlayNextProposal,
  type LlmMessage,
} from '@ocraft/shared';
import { LlmService } from '../core/llm.service';
import { DirectorService } from '../core/director.service';
import { PackService } from '../../story/pack.service';
import { WorldProgressService } from '../../story/world-progress.service';
import { ConversationService } from '../../game/conversation.service';
import { NpcService } from '../../npc/npc.service';
import { listAvailableExchangeEventIds } from '../rules/npc-exchange';
import {
  listReadyChapterAdvances,
  type ReadyChapterAdvance,
} from '../rules/chapter-transition';
import {
  listReadyEndingHints,
  type ReadyEndingHint,
} from '../rules/ending-settle';
import {
  PUBLIC_SCENE_LINE_LIMIT,
  formatSceneUtteranceLines,
} from '../memory/scene-working-memory';

function messageIncludesAny(message: string, triggers: string[]): boolean {
  if (triggers.length === 0) return true;
  const msg = message.toLowerCase();
  return triggers.some((t) => msg.includes(t.toLowerCase()));
}

/** 加速保底：若模型没带上触发词，把关键词嵌进口语句 */
function ensureSayHitsTriggers(say: string, triggers: string[]): string {
  const usable = triggers.map((t) => t.trim()).filter(Boolean);
  if (usable.length === 0) return say;
  if (messageIncludesAny(say, usable)) return say;
  const pick = usable[0]!;
  const base = say.replace(/[。！？…\s]*$/u, '').trim() || '对了';
  return `${base}，听说${pick}的事？`.slice(0, 500);
}

function withSyncedSay(proposal: AutoPlayNextProposal): AutoPlayNextProposal {
  const lines = normalizeAutoPlayBeatLines(proposal);
  const playerSay =
    lines.find((l) => l.speaker_kind === 'player')?.text ?? proposal.say;
  return { ...proposal, lines, say: playerSay };
}

function patchPlayerLineTriggers(
  proposal: AutoPlayNextProposal,
  triggers: string[],
): AutoPlayNextProposal {
  const lines = normalizeAutoPlayBeatLines(proposal);
  if (lines.length === 0) {
    const pick = triggers[0]!;
    return withSyncedSay({
      say: `对了，我想问问${pick}的事`,
      lines: [
        {
          speaker_kind: 'player',
          speaker_id: 'player',
          text: `对了，我想问问${pick}的事`,
        },
      ],
      done: false,
      reason: '加速保底触发句',
      source: proposal.source,
    });
  }
  let patched = false;
  const nextLines = lines.map((l) => {
    if (l.speaker_kind !== 'player') return l;
    const after = ensureSayHitsTriggers(l.text, triggers);
    if (after !== l.text) patched = true;
    return { ...l, text: after };
  });
  const hasPlayer = nextLines.some((l) => l.speaker_kind === 'player');
  if (!hasPlayer) {
    const pick = triggers[0]!;
    nextLines.unshift({
      speaker_kind: 'player',
      speaker_id: 'player',
      text: ensureSayHitsTriggers(`对了，我想问问${pick}的事`, triggers),
    });
    patched = true;
  }
  return withSyncedSay({
    ...proposal,
    lines: nextLines,
    reason: patched
      ? `${proposal.reason || '加速'}·已嵌入升章/结局触发词`
      : proposal.reason,
  });
}

@Injectable()
export class AutoPlayAgentService {
  private readonly logger = new Logger(AutoPlayAgentService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly packService: PackService,
    private readonly worldProgress: WorldProgressService,
    private readonly conversationService: ConversationService,
    private readonly npcService: NpcService,
    private readonly director: DirectorService,
  ) {}

  /** 无 API Key（MOCK）时禁用自动演 */
  isAvailable(): boolean {
    return !this.llmService.isMockMode();
  }

  async proposeNext(opts: {
    playerId: string;
    npcId: string;
    turnIndex: number;
    maxTurns?: number;
    chapterSpeakCap?: number;
    priorSays?: string[];
    sawTargetExchange?: boolean;
    targetChapter?: string;
    targetExchange?: string;
    targetEnding?: string;
    styleId?: string;
    goalTitle?: string;
    accelerate?: boolean;
    nearbyNpcIds?: string[];
  }): Promise<AutoPlayNextProposal> {
    if (!this.isAvailable()) {
      throw new Error('自动演绎需要配置 API Key（当前为 MOCK 模式）');
    }

    const pack = this.packService.getPack();
    await this.worldProgress.ensureHydrated(opts.playerId);
    await this.conversationService.ensureSceneLogReady(opts.playerId);

    const cap = opts.chapterSpeakCap ?? opts.maxTurns ?? 100;
    const goal: AutoPlayGoal = autoPlayGoalSchema.parse({
      id: 'session',
      title: opts.goalTitle?.trim() || '自动演',
      world_id: pack.header.world_id,
      pack_version_id: pack.version_dir,
      npc_id: opts.npcId,
      target_chapter: opts.targetChapter,
      target_exchange: opts.targetExchange,
      target_ending: opts.targetEnding,
      chapter_speak_cap: cap,
      max_turns: cap,
      wait_ms: 800,
      style_id: opts.styleId ?? 'direct',
      takeover_mode: 'allow',
      accelerate: opts.accelerate === true,
    });

    const chapterId = this.worldProgress.getChapter(opts.playerId);
    const chapterMeta = pack.world.chapters.find((c) => c.id === chapterId);
    const chapterLabel =
      chapterMeta?.hud_label || chapterMeta?.display_name || chapterId;
    const flags = this.worldProgress.getFlags(opts.playerId);
    const flagNames = Object.keys(flags);
    const runtime = this.npcService.getRuntimeState(opts.playerId, opts.npcId);
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
    const style = getAutoPlayStylePreset(goal.style_id);
    const maxSpeakers = getAutoPlayStyleMaxSpeakers(goal.style_id);

    const cast = await this.director.buildCast(
      opts.playerId,
      opts.npcId,
      opts.nearbyNpcIds ?? [],
    );
    const castIds = cast.map((c) => c.npc_id);

    const readyAdvances = listReadyChapterAdvances({
      chapterState: chapterId,
      runtimeState: runtime,
      flags,
      triggers: pack.triggers,
    });
    const readyEndings = listReadyEndingHints({
      pack,
      chapterState: chapterId,
      flags,
      targetEndingId: goal.target_ending,
    });

    const accelerate = opts.accelerate === true;
    const acceleratePlan = this.pickAcceleratePlan({
      accelerate,
      readyAdvances,
      readyEndings,
      preferToChapter: goal.target_chapter,
      preferEndingId: goal.target_ending,
    });

    const rankMap = getChapterRankMap(pack);
    const playablePresent = isPackPlayablePlayerPresent(pack, {
      chapterState: chapterId,
      flags,
      rankMap,
    });
    const playableId = getPackPlayablePlayerId(pack);

    // AP-2：仅当可演出玩家位已出场，且有升章/结局门槛（或加速）时，本拍才强制玩家句
    const requirePlayerLine =
      playablePresent &&
      (accelerate ||
        readyAdvances.length > 0 ||
        readyEndings.length > 0);

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
      styleHint: accelerate
        ? '风格：直给推进（加速中，少铺垫）。'
        : style.prompt_hint,
      accelerate,
      acceleratePlan,
      cast,
      castIds,
      maxSpeakers,
      requirePlayerLine,
      playablePresent,
      playableId,
    };

    let proposal: AutoPlayNextProposal;
    try {
      const messages = this.buildPrompt(input);
      const raw = await this.llmService.complete(messages, {
        temperature: accelerate ? 0.35 : 0.55,
        maxTokens: 420,
        json: true,
      });
      const parsed = parseAutoPlayNextJson(raw);
      if (parsed) {
        proposal = this.sanitizeProposal(parsed, {
          castIds,
          maxSpeakers,
          requirePlayerLine,
          focusNpcId: opts.npcId,
          playablePresent,
          playableId,
        });
      } else {
        this.logger.warn('autoplay propose: invalid JSON, fallback heuristic');
        proposal = mockProposeAutoPlayNext(input);
      }
    } catch (err) {
      this.logger.warn(
        `autoplay propose failed: ${err instanceof Error ? err.message : err}`,
      );
      proposal = mockProposeAutoPlayNext(input);
    }

    proposal = withSyncedSay(proposal);

    if (
      playablePresent &&
      accelerate &&
      acceleratePlan.mustInclude.length > 0 &&
      !proposal.done
    ) {
      proposal = patchPlayerLineTriggers(proposal, acceleratePlan.mustInclude);
    } else if (
      requirePlayerLine &&
      !proposal.done &&
      !normalizeAutoPlayBeatLines(proposal).some(
        (l) => l.speaker_kind === 'player',
      )
    ) {
      proposal = withSyncedSay({
        ...proposal,
        lines: [
          {
            speaker_kind: 'player',
            speaker_id: playableId,
            text: `对了，${focusNpcName}，我们接着说刚才的事。`,
          },
          ...normalizeAutoPlayBeatLines(proposal).filter(
            (l) => l.speaker_kind === 'npc',
          ),
        ],
        reason: `${proposal.reason || '排场'}·补玩家句以命中 Pack 门槛`,
      });
    }

    // 无可演出玩家位 / 未出场：剥掉玩家句，改走纯 NPC
    if (!playablePresent && !proposal.done) {
      const onlyNpc = normalizeAutoPlayBeatLines(proposal).filter(
        (l) => l.speaker_kind === 'npc',
      );
      if (onlyNpc.length === 0) {
        onlyNpc.push({
          speaker_kind: 'npc',
          speaker_id: opts.npcId,
          text: '……刚才那事，你们怎么看？',
        });
      }
      proposal = withSyncedSay({
        ...proposal,
        lines: onlyNpc,
        say: undefined,
        reason: `${proposal.reason || '排场'}·无玩家演出位`,
      });
    }

    const lines = normalizeAutoPlayBeatLines(proposal);
    this.logger.log(
      `autoplay next player=${opts.playerId} turn=${opts.turnIndex} accel=${accelerate} plan=${acceleratePlan.kind} done=${proposal.done} lines=${lines.length} say="${proposal.say ?? ''}" reason="${proposal.reason}"`,
    );
    return withSyncedSay(proposal);
  }

  private sanitizeProposal(
    proposal: AutoPlayNextProposal,
    opts: {
      castIds: string[];
      maxSpeakers: number;
      requirePlayerLine: boolean;
      focusNpcId: string;
      playablePresent: boolean;
      playableId: string;
    },
  ): AutoPlayNextProposal {
    const castSet = new Set(opts.castIds);
    let lines = normalizeAutoPlayBeatLines(proposal)
      .filter((l) => {
        if (l.speaker_kind === 'player') return opts.playablePresent;
        return castSet.has(l.speaker_id);
      })
      .map((l) =>
        l.speaker_kind === 'player'
          ? { ...l, speaker_id: opts.playableId }
          : l,
      );

    // 每拍人数上限：优先保留玩家句，再截 NPC
    if (lines.length > opts.maxSpeakers) {
      const player = lines.filter((l) => l.speaker_kind === 'player');
      const npcs = lines.filter((l) => l.speaker_kind === 'npc');
      const room = Math.max(0, opts.maxSpeakers - player.length);
      lines = [...player, ...npcs.slice(0, room)];
    }

    if (lines.length === 0 && !proposal.done) {
      lines = [
        {
          speaker_kind: opts.requirePlayerLine ? 'player' : 'npc',
          speaker_id: opts.requirePlayerLine
            ? opts.playableId
            : opts.focusNpcId,
          text: opts.requirePlayerLine
            ? '我们继续聊刚才的事吧。'
            : '……刚才那事，你们怎么看？',
        },
      ];
    }

    return withSyncedSay({ ...proposal, lines });
  }

  private pickAcceleratePlan(opts: {
    accelerate: boolean;
    readyAdvances: ReadyChapterAdvance[];
    readyEndings: ReadyEndingHint[];
    preferToChapter?: string;
    preferEndingId?: string;
  }): {
    kind: 'chapter' | 'ending' | 'none';
    label: string;
    mustInclude: string[];
  } {
    if (!opts.accelerate) {
      return { kind: 'none', label: '', mustInclude: [] };
    }

    if (opts.readyAdvances.length > 0) {
      const preferred =
        (opts.preferToChapter &&
          opts.readyAdvances.find(
            (a) => a.toChapter === opts.preferToChapter,
          )) ||
        opts.readyAdvances[0]!;
      const triggers = preferred.playerTriggers.filter(Boolean);
      return {
        kind: 'chapter',
        label: `${preferred.id}→${preferred.toChapter}${preferred.notes ? `（${preferred.notes}）` : ''}`,
        mustInclude: triggers,
      };
    }

    if (opts.readyEndings.length > 0) {
      const preferred =
        (opts.preferEndingId &&
          opts.readyEndings.find((e) => e.id === opts.preferEndingId)) ||
        opts.readyEndings[0]!;
      return {
        kind: 'ending',
        label: `${preferred.displayName}（${preferred.id}）`,
        mustInclude: preferred.playerTriggers.filter(Boolean),
      };
    }

    return { kind: 'none', label: '无可立即命中的升章/结局规则', mustInclude: [] };
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
    styleHint: string;
    accelerate: boolean;
    acceleratePlan: {
      kind: 'chapter' | 'ending' | 'none';
      label: string;
      mustInclude: string[];
    };
    cast: Array<{ npc_id: string; display_name: string; blurb: string }>;
    castIds: string[];
    maxSpeakers: number;
    requirePlayerLine: boolean;
    playablePresent: boolean;
    playableId: string;
  }): LlmMessage[] {
    const goalBits = [
      input.goal.target_chapter
        ? `章停/途经 ${input.goal.target_chapter}`
        : null,
      input.goal.target_exchange
        ? `目标互聊 ${input.goal.target_exchange}`
        : null,
      input.goal.target_ending
        ? `目标结局 ${input.goal.target_ending}`
        : null,
    ]
      .filter(Boolean)
      .join('；');

    const castBlock =
      input.cast
        .map((c) => `- ${c.npc_id}（${c.display_name}）：${c.blurb}`)
        .join('\n') || '（空）';

    const accelLines: string[] = [];
    if (input.accelerate) {
      accelLines.push(
        '【加速模式】少闲聊，本拍就要推动进度。加速优先于风格铺垫。',
      );
      if (
        input.acceleratePlan.kind === 'chapter' &&
        input.acceleratePlan.mustInclude.length > 0
      ) {
        accelLines.push(
          `【升章关键词·必须】若有玩家句，text 须自然包含下列至少一词（命中 Pack 规则 ${input.acceleratePlan.label}；禁止说「升章/触发/系统」）：${input.acceleratePlan.mustInclude.join(' / ')}`,
        );
      } else if (
        input.acceleratePlan.kind === 'ending' &&
        input.acceleratePlan.mustInclude.length > 0
      ) {
        accelLines.push(
          `【结局关键词·必须】玩家句须自然包含下列至少一词（推向 ${input.acceleratePlan.label}）：${input.acceleratePlan.mustInclude.join(' / ')}`,
        );
      } else if (input.acceleratePlan.kind === 'none') {
        accelLines.push(
          `【加速】${input.acceleratePlan.label || '当前没有可立即命中的升章词；尽量追问异常/钩子。'}`,
        );
      } else {
        accelLines.push(
          '【加速】当前升章规则无关键词门槛，直接推进关键话题即可。',
        );
      }
    }

    const playerRule = !input.playablePresent
      ? '【无可演出玩家位或未出场】禁止输出 player 句；只点 cast 里的 NPC。'
      : input.requirePlayerLine
        ? `【本拍必须含玩家句】lines 里至少一句 speaker_kind=player、speaker_id=${input.playableId}（Pack 升章/结局吃玩家台词）。`
        : `【本拍可不含玩家】可点玩家位 id=${input.playableId}，也可纯 NPC；不必先有玩家句。`;

    return [
      {
        role: 'system',
        content: [
          '你是自动演「场景导演 + 台词助理」，不是假玩家硬代打。',
          '职责：从 cast 与可选玩家演出位中点 1～N 个说话人，写出本拍台词（顺序演出）。',
          '禁止：改章节、发明 Pack 外事件、剧透未解锁、自称 AI、对系统说话。',
          `每拍最多 ${input.maxSpeakers} 句（风格上限）。`,
          `NPC 的 speaker_id 必须是 cast 中的 npc_id；玩家句 speaker_kind=player、speaker_id=${input.playableId}。`,
          playerRule,
          '若目标已达成或无需再演，设 done=true 且 lines 可空。',
          '否则 done=false 且 lines 非空；每句 ≤40 字，口语。',
          input.styleHint,
          ...accelLines,
          '只输出 JSON：{"lines":[{"speaker_kind":"npc|player","speaker_id":"...","text":"..."}],"done":false,"reason":"..."}',
          '兼容：也可额外给 say（等同单句玩家），但优先 lines。',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      {
        role: 'user',
        content: [
          `【焦点 NPC】${input.focusNpcName}（${input.goal.npc_id}）`,
          `【当前章节】${input.chapterLabel}（${input.chapterId}）`,
          `【旗标】${input.flagNames.join(', ') || '（无）'}`,
          `【可尝试戏码 id】${input.availableEvents.join(', ') || '（无）'}`,
          `【自动演目标】${goalBits || '推进到结局（或最终章）'}`,
          `【目标互聊已见】${input.sawTargetExchange ? '是' : '否'}`,
          `【加速】${input.accelerate ? `开 · ${input.acceleratePlan.kind}:${input.acceleratePlan.label || '-'}` : '关'}`,
          `【可演出玩家位】${input.playablePresent ? `已出场（${input.playableId}）` : '无/未出场'}`,
          `【必须玩家句】${input.requirePlayerLine ? '是' : '否'}`,
          `【拍序】总第 ${input.turnIndex + 1} 拍（章发言软顶 ${input.goal.chapter_speak_cap}）`,
          `【上场 cast】\n${castBlock}`,
          `【本局已有玩家句】\n${input.priorSays.map((s, i) => `${i + 1}. ${s}`).join('\n') || '（无）'}`,
          `【近期对白】\n${input.recentLines.join('\n') || '（尚无）'}`,
          '请给出本拍排场 JSON。',
        ].join('\n\n'),
      },
    ];
  }
}

export type { AutoPlayBeatLine };
