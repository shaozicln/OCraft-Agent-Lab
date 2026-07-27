import { Injectable, Logger } from '@nestjs/common';
import {
  LabProgressMonitor,
  getChapterRankMap,
  isNpcPresent,
  type LabProgressSnapshot,
  type LabPeerLineEvent,
  type LlmMessage,
} from '@ocraft/shared';
import { LlmService } from './llm.service';
import { looksLikeAiSlop } from './reply-guard';
import { NpcService } from '../npc/npc.service';
import { PackService } from '../story/pack.service';
import { WorldProgressService } from '../story/world-progress.service';
import { ConversationService } from '../game/conversation.service';

const PEER_FALLBACKS = [
  '……我也听到了。',
  '嗯，你们继续说。',
  '（低声）别吵。',
];

export type LabPeerTickResult = {
  lines: LabPeerLineEvent[];
  progress: LabProgressSnapshot;
};

/**
 * MA-Lab：平级 tick（无导演统筹）。
 * 预算与进度由 LabProgressMonitor 管；禁止写章由 harness labPeer 门控。
 */
@Injectable()
export class LabPeerService {
  private readonly logger = new Logger(LabPeerService.name);
  private readonly monitors = new Map<string, LabProgressMonitor>();

  constructor(
    private readonly packService: PackService,
    private readonly worldProgress: WorldProgressService,
    private readonly npcService: NpcService,
    private readonly llmService: LlmService,
    private readonly conversationService: ConversationService,
  ) {}

  getMonitor(playerId: string): LabProgressMonitor {
    let m = this.monitors.get(playerId);
    if (!m) {
      m = new LabProgressMonitor();
      this.monitors.set(playerId, m);
      return m;
    }
    return m;
  }

  resetSession(playerId: string): void {
    this.getMonitor(playerId).resetSession();
  }

  async listCandidates(opts: {
    playerId: string;
    chatNpcId: string;
    nearbyNpcIds: string[];
  }): Promise<string[]> {
    const { playerId, chatNpcId } = opts;
    const pack = this.packService.getPack();
    await this.worldProgress.ensureHydrated(playerId);
    await this.conversationService.ensureNpcSelectionHydrated(playerId);
    const chapterState = this.worldProgress.getChapter(playerId);
    const flags = this.worldProgress.getFlags(playerId);
    const rankMap = getChapterRankMap(pack);
    const selected = this.conversationService.getNpcSelection(playerId);

    return [
      ...new Set(
        (opts.nearbyNpcIds ?? []).filter((id) => id && id !== chatNpcId),
      ),
    ].filter((id) => {
      const def = pack.npcs.find((n) => n.npc_id === id);
      if (!def) return false;
      if (
        selected !== null &&
        !selected.includes(id)
      ) {
        return false;
      }
      return isNpcPresent({
        appear_from_chapter: def.appear_from_chapter,
        appear_require_flags: def.appear_require_flags,
        chapterState,
        flags,
        rankMap,
      });
    });
  }

  /**
   * 玩家一句后的平级 tick：附近 NPC 轮流短接话，受 round/session 预算约束。
   */
  async runPeerTick(opts: {
    playerId: string;
    chatNpcId: string;
    nearbyNpcIds: string[];
    playerMessage: string;
    assistantReply: string;
    onProgress?: (progress: LabProgressSnapshot) => void | Promise<void>;
    onLine?: (line: LabPeerLineEvent) => void | Promise<void>;
  }): Promise<LabPeerTickResult> {
    const {
      playerId,
      chatNpcId,
      playerMessage,
      assistantReply,
    } = opts;
    const monitor = this.getMonitor(playerId);
    const candidates = await this.listCandidates(opts);
    let progress = monitor.beginRound(candidates.length);
    await opts.onProgress?.(progress);

    const lines: LabPeerLineEvent[] = [];
    if (progress.status !== 'running') {
      return { lines, progress };
    }

    const pack = this.packService.getPack();
    const chapterState = this.worldProgress.getChapter(playerId);
    const chatName =
      pack.npcs.find((n) => n.npc_id === chatNpcId)?.name ?? chatNpcId;
    const queue = [...candidates];

    while (monitor.canSpeakMore(queue.length) && queue.length > 0) {
      const speakerId = queue.shift()!;
      const speakerName =
        pack.npcs.find((n) => n.npc_id === speakerId)?.name ?? speakerId;

      let text = await this.generatePeerLine({
        playerId,
        speakerId,
        speakerName,
        chatName,
        chapterState,
        playerMessage,
        assistantReply,
        priorPeerTexts: lines.map((l) => `${l.name}：${l.text}`),
        forceRewrite: false,
      });
      if (looksLikeAiSlop(text)) {
        text = await this.generatePeerLine({
          playerId,
          speakerId,
          speakerName,
          chatName,
          chapterState,
          playerMessage,
          assistantReply,
          priorPeerTexts: lines.map((l) => `${l.name}：${l.text}`),
          forceRewrite: true,
        });
      }
      if (looksLikeAiSlop(text) || !text.trim()) {
        text =
          PEER_FALLBACKS[Math.floor(Math.random() * PEER_FALLBACKS.length)]!;
      }

      const line: LabPeerLineEvent = {
        chatNpcId,
        npcId: speakerId,
        name: speakerName,
        text: text.trim(),
        roundIndex: monitor.roundIndex,
      };
      lines.push(line);
      await opts.onLine?.(line);
      progress = monitor.recordUtterance(speakerId, queue.length);
      await opts.onProgress?.(progress);
    }

    if (monitor.status === 'running') {
      progress = monitor.complete('complete');
      await opts.onProgress?.(progress);
    }

    this.logger.log(
      `lab.peer tick player=${playerId} round=${monitor.roundIndex} lines=${lines.length} stop=${progress.stopReason ?? '-'} session=${monitor.sessionPeerLines}/${monitor.sessionPeerLineCap}`,
    );

    return { lines, progress };
  }

  private async generatePeerLine(opts: {
    playerId: string;
    speakerId: string;
    speakerName: string;
    chatName: string;
    chapterState: string;
    playerMessage: string;
    assistantReply: string;
    priorPeerTexts: string[];
    forceRewrite: boolean;
  }): Promise<string> {
    const preState = this.npcService.getRuntimeState(
      opts.playerId,
      opts.speakerId,
    );
    const storyFlags = this.worldProgress.getFlags(opts.playerId);
    const basePrompt = this.npcService.buildSystemPrompt(opts.speakerId, {
      chapterState: opts.chapterState,
      affinity: preState.affinity,
      fatigue: preState.fatigue,
      currentStatus: preState.current_status,
      storyFlags,
    });

    const policy = [
      '【实验室·平级短接话】',
      `你是「${opts.speakerName}」，与「${opts.chatName}」同场。无导演统筹，你自主接一句。`,
      '只说一句很短口语（不超过 28 字）；可接玩家或刚说完的人；不要抢戏、不要总结剧情。',
      '禁止自称 AI；禁止工具/JSON；禁止游戏/存档/升章元叙事；禁止宣布章节变化。',
      opts.forceRewrite
        ? '上一稿像说明书；请改成更像随口接一句。'
        : '',
    ]
      .filter(Boolean)
      .join('');

    const prior =
      opts.priorPeerTexts.length > 0
        ? `\n【本轮已有平级句】\n${opts.priorPeerTexts.join('\n')}`
        : '';

    const messages: LlmMessage[] = [
      { role: 'system', content: `${basePrompt}\n\n${policy}` },
      {
        role: 'user',
        content: [
          `玩家对「${opts.chatName}」说：${opts.playerMessage}`,
          `「${opts.chatName}」答：${opts.assistantReply}`,
          prior,
          '请你插一句：',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ];

    return this.llmService.complete(messages, {
      temperature: opts.forceRewrite ? 0.3 : 0.55,
      maxTokens: 64,
    });
  }
}
