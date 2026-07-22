import { Injectable, Logger } from '@nestjs/common';
import {
  getChapterRankMap,
  isNpcPresent,
  type LlmMessage,
  type NpcAsideEvent,
} from '@ocraft/shared';
import { LlmService } from './llm.service';
import { looksLikeAiSlop } from './reply-guard';
import { NpcService } from '../npc/npc.service';
import { PackService } from '../story/pack.service';
import { WorldProgressService } from '../story/world-progress.service';

const ASIDE_PROBABILITY = 0.42;
/** 两次短接话之间至少隔几轮主对话 */
const ASIDE_MIN_CHATS_GAP = 2;
const ASIDE_FALLBACKS = [
  '……你们继续，我听着。',
  '嗯？我好像也……算了。',
  '（轻声）别太大声。',
];

@Injectable()
export class NpcAsideService {
  private readonly logger = new Logger(NpcAsideService.name);
  /** playerId → 距上次 aside 又聊了几轮 */
  private readonly chatsSinceAside = new Map<string, number>();

  constructor(
    private readonly packService: PackService,
    private readonly worldProgress: WorldProgressService,
    private readonly npcService: NpcService,
    private readonly llmService: LlmService,
  ) {}

  /**
   * 主对话结束且未触发完整 exchange 时：附近另一人可能短插一句。
   * 失败不抛，返回 null。
   */
  async tryNearbyAside(opts: {
    playerId: string;
    chatNpcId: string;
    nearbyNpcIds: string[];
    playerMessage: string;
    assistantReply: string;
  }): Promise<NpcAsideEvent | null> {
    const { playerId, chatNpcId, playerMessage, assistantReply } = opts;

    try {
      const since = this.chatsSinceAside.get(playerId) ?? ASIDE_MIN_CHATS_GAP;
      if (since < ASIDE_MIN_CHATS_GAP) {
        this.chatsSinceAside.set(playerId, since + 1);
        return null;
      }

      const pack = this.packService.getPack();
      await this.worldProgress.ensureHydrated(playerId);
      const chapterState = this.worldProgress.getChapter(playerId);
      const flags = this.worldProgress.getFlags(playerId);
      const rankMap = getChapterRankMap(pack);

      const candidates = [
        ...new Set(
          (opts.nearbyNpcIds ?? []).filter(
            (id) => id && id !== chatNpcId,
          ),
        ),
      ].filter((id) => {
        const def = pack.npcs.find((n) => n.npc_id === id);
        if (!def) return false;
        return isNpcPresent({
          appear_from_chapter: def.appear_from_chapter,
          appear_require_flags: def.appear_require_flags,
          chapterState,
          flags,
          rankMap,
        });
      });

      if (candidates.length === 0) {
        this.chatsSinceAside.set(playerId, since + 1);
        return null;
      }

      if (Math.random() > ASIDE_PROBABILITY) {
        this.chatsSinceAside.set(playerId, since + 1);
        return null;
      }

      const speakerId =
        candidates[Math.floor(Math.random() * candidates.length)]!;
      const speakerName =
        pack.npcs.find((n) => n.npc_id === speakerId)?.name ?? speakerId;
      const chatName =
        pack.npcs.find((n) => n.npc_id === chatNpcId)?.name ?? chatNpcId;

      let text = await this.generateAside({
        playerId,
        speakerId,
        speakerName,
        chatName,
        chapterState,
        playerMessage,
        assistantReply,
        forceRewrite: false,
      });
      if (looksLikeAiSlop(text)) {
        text = await this.generateAside({
          playerId,
          speakerId,
          speakerName,
          chatName,
          chapterState,
          playerMessage,
          assistantReply,
          forceRewrite: true,
        });
      }
      if (looksLikeAiSlop(text) || !text.trim()) {
        text =
          ASIDE_FALLBACKS[
            Math.floor(Math.random() * ASIDE_FALLBACKS.length)
          ]!;
      }

      this.chatsSinceAside.set(playerId, 0);
      this.logger.log(
        `Aside player=${playerId} speaker=${speakerId} chat=${chatNpcId} mock=${this.llmService.isMockMode()}`,
      );

      return {
        chatNpcId,
        npcId: speakerId,
        name: speakerName,
        text: text.trim(),
      };
    } catch (err) {
      this.logger.error(
        `Aside failed player=${opts.playerId}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return null;
    }
  }

  private async generateAside(opts: {
    playerId: string;
    speakerId: string;
    speakerName: string;
    chatName: string;
    chapterState: string;
    playerMessage: string;
    assistantReply: string;
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
      '【同场短接话】',
      `你是「${opts.speakerName}」，站在旁边听到玩家与「${opts.chatName}」的对话。`,
      '只插一句很短的口语（不超过 25 字为宜）；像随口接一句，不要抢戏、不要总结剧情。',
      '可以对着空气/对玩家/对对话方轻声说；禁止自称 AI；禁止工具/JSON；禁止游戏/存档/模拟元叙事。',
      opts.forceRewrite
        ? '上一稿不合格，请重写成一句更短的角色口语。'
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const userContent = [
      `玩家对「${opts.chatName}」说：「${opts.playerMessage}」`,
      `「${opts.chatName}」刚答：「${opts.assistantReply.slice(0, 100)}${
        opts.assistantReply.length > 100 ? '…' : ''
      }」`,
      `请以「${opts.speakerName}」插一句短接话。`,
    ].join('\n\n');

    const messages: LlmMessage[] = [
      { role: 'system', content: `${basePrompt}\n\n${policy}` },
      { role: 'user', content: userContent },
    ];

    return this.llmService.complete(messages, {
      temperature: opts.forceRewrite ? 0.3 : 0.55,
      maxTokens: 60,
    });
  }
}
