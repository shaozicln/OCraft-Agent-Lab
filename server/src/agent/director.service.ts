import { Injectable, Logger } from '@nestjs/common';
import {
  getChapterRankMap,
  isNpcPresent,
  type LlmMessage,
  type PackNpc,
  type SceneUtterance,
} from '@ocraft/shared';
import { LlmService } from './llm.service';
import { PackService } from '../story/pack.service';
import { WorldProgressService } from '../story/world-progress.service';
import { ConversationService } from '../game/conversation.service';
import type {
  CastMember,
  DirectorDecision,
  DirectorInput,
} from './director.types';

const RECENT_LINE_LIMIT = 5;
const BLURB_MAX_LEN = 40;
const REASON_MAX_LEN = 60;

@Injectable()
export class DirectorService {
  private readonly logger = new Logger(DirectorService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly packService: PackService,
    private readonly worldProgress: WorldProgressService,
    private readonly conversationService: ConversationService,
  ) {}

  async buildCast(
    playerId: string,
    chatNpcId: string,
    nearbyNpcIds: string[],
  ): Promise<CastMember[]> {
    await this.conversationService.ensureNpcSelectionHydrated(playerId);
    await this.worldProgress.ensureHydrated(playerId);

    const pack = this.packService.getPack();
    const chapterState = this.worldProgress.getChapter(playerId);
    const flags = this.worldProgress.getFlags(playerId);
    const rankMap = getChapterRankMap(pack);
    const selected = this.conversationService.getNpcSelection(playerId);

    const ids = [
      ...new Set([chatNpcId, ...(nearbyNpcIds ?? [])].filter(Boolean)),
    ];

    const cast: CastMember[] = [];
    for (const id of ids) {
      const def = pack.npcs.find((n) => n.npc_id === id);
      if (!def) continue;
      if (
        !isNpcPresent({
          appear_from_chapter: def.appear_from_chapter,
          appear_require_flags: def.appear_require_flags,
          chapterState,
          flags,
          rankMap,
        })
      ) {
        continue;
      }
      if (selected !== null && !selected.includes(id)) continue;
      cast.push({
        npc_id: id,
        display_name: def.name,
        blurb: this.blurbFromNpc(def),
      });
    }
    return cast;
  }

  async buildInput(
    playerId: string,
    chatNpcId: string,
    playerMessage: string,
    nearbyNpcIds: string[],
  ): Promise<DirectorInput> {
    const cast = await this.buildCast(playerId, chatNpcId, nearbyNpcIds);
    const pack = this.packService.getPack();
    const chapterId = this.worldProgress.getChapter(playerId);
    const chapterMeta = pack.world.chapters.find((c) => c.id === chapterId);
    const chapterLabel =
      chapterMeta?.hud_label || chapterMeta?.display_name || chapterId;
    const flagNames = Object.keys(this.worldProgress.getFlags(playerId));
    const recentLines = this.formatRecentLines(
      this.conversationService
        .getPublicSceneLog(playerId)
        .slice(-RECENT_LINE_LIMIT),
    );

    return {
      playerId,
      chatNpcId,
      playerMessage,
      cast,
      chapterId,
      chapterLabel,
      flagNames,
      recentLines,
    };
  }

  buildPrompt(input: DirectorInput): LlmMessage[] {
    const castBlock = input.cast
      .map((c) => `- ${c.npc_id}（${c.display_name}）：${c.blurb}`)
      .join('\n');
    const recentBlock =
      input.recentLines.length > 0
        ? input.recentLines.join('\n')
        : '（尚无近期对白）';
    const flagBlock =
      input.flagNames.length > 0
        ? input.flagNames.join(', ')
        : '（无）';

    return [
      {
        role: 'system',
        content: [
          '你是场景调度导演，不是编剧。',
          '职责：根据场上 cast 与近期对白，决定焦点 NPC 回完玩家后是否开放「其他 NPC 接话/互聊」路径。',
          '你只能输出 JSON，不能改章节、不能发明 Pack 未定义的事件。',
          'mode 仅两档：reply_player（专注一对一）| reply_then_exchange（允许尝试群戏）。',
          'speakers 必须是 cast 中的 npc_id；reply_player 时建议 [focus]。',
          '输出格式：{"mode":"...","speakers":["..."],"reason":"..."}',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `【当前章节】${input.chapterLabel}（${input.chapterId}）`,
          `【已置 flag 名】${flagBlock}`,
          `【焦点 NPC】${input.chatNpcId}`,
          `【玩家本句】${input.playerMessage}`,
          `【上场 cast】\n${castBlock || '（空）'}`,
          `【近期对白】\n${recentBlock}`,
        ].join('\n\n'),
      },
    ];
  }

  parseAndValidate(
    raw: string,
    cast: CastMember[],
    focusNpcId: string,
  ): DirectorDecision {
    const castIds = cast.map((c) => c.npc_id);

    if (cast.length === 0) {
      return {
        mode: 'reply_player',
        speakers: [focusNpcId],
        reason: 'cast 为空',
        fallback: 'invalid_cast',
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.fallbackDecision('parse_error', cast, focusNpcId);
    }

    if (!parsed || typeof parsed !== 'object') {
      return this.fallbackDecision('parse_error', cast, focusNpcId);
    }

    const obj = parsed as Record<string, unknown>;
    const mode = obj.mode;
    if (mode !== 'reply_player' && mode !== 'reply_then_exchange') {
      return this.fallbackDecision('parse_error', cast, focusNpcId);
    }

    // speakers 必须存在且全为 string；任一条不在 cast → invalid_cast（不静默丢弃）
    if (!Array.isArray(obj.speakers)) {
      return this.fallbackDecision('parse_error', cast, focusNpcId);
    }
    if (obj.speakers.some((s) => typeof s !== 'string')) {
      return this.fallbackDecision('parse_error', cast, focusNpcId);
    }
    const speakers = obj.speakers as string[];
    if (speakers.some((s) => !castIds.includes(s))) {
      return this.fallbackDecision('invalid_cast', cast, focusNpcId);
    }

    const reason =
      typeof obj.reason === 'string'
        ? obj.reason.trim().slice(0, REASON_MAX_LEN)
        : '';

    if (mode === 'reply_player') {
      // speakers 可为空或可忽略：归一到 [focus]；若给了 speakers 则必须 ⊆ cast（已验）
      const normalized =
        speakers.length === 0 || !speakers.includes(focusNpcId)
          ? [focusNpcId]
          : speakers;
      return {
        mode,
        speakers: normalized,
        reason: reason || '一对一专注',
        fallback: false,
      };
    }

    // reply_then_exchange：speakers 非空且 ⊆ cast
    if (speakers.length === 0) {
      return this.fallbackDecision('invalid_cast', cast, focusNpcId);
    }

    return {
      mode,
      speakers,
      reason: reason || '开放群戏路径',
      fallback: false,
    };
  }

  async decide(input: DirectorInput): Promise<DirectorDecision> {
    if (this.llmService.isMockMode()) {
      return this.mockDecide(input);
    }

    try {
      const messages = this.buildPrompt(input);
      const raw = await this.llmService.complete(messages, {
        json: true,
        model: process.env.DIRECTOR_MODEL,
        temperature: 0.3,
        maxTokens: 200,
      });
      const decision = this.parseAndValidate(
        raw,
        input.cast,
        input.chatNpcId,
      );
      this.logger.log(
        `director decide player=${input.playerId} mode=${decision.mode} fallback=${String(decision.fallback)} speakers=[${decision.speakers.join(',')}]`,
      );
      return decision;
    } catch (err) {
      this.logger.warn(
        `director llm_error player=${input.playerId}: ${err instanceof Error ? err.message : err}`,
      );
      return this.fallbackDecision('llm_error', input.cast, input.chatNpcId);
    }
  }

  skippedWhisperDecision(chatNpcId: string): DirectorDecision {
    return {
      mode: 'reply_player',
      speakers: [chatNpcId],
      reason: '悄悄话，跳过导演',
      fallback: 'skipped_whisper',
    };
  }

  mockDecide(input: DirectorInput): DirectorDecision {
    const castIds = input.cast.map((c) => c.npc_id);
    if (castIds.length <= 1) {
      return {
        mode: 'reply_player',
        speakers: [input.chatNpcId],
        reason: 'MOCK：仅一人在场',
        fallback: false,
      };
    }

    const speakerNames = new Set<string>();
    for (const line of input.recentLines) {
      if (line.startsWith('玩家：')) continue;
      const name = line.split('：')[0]?.trim();
      if (name) speakerNames.add(name);
    }
    if (speakerNames.size >= 2) {
      return {
        mode: 'reply_then_exchange',
        speakers: castIds,
        reason: 'MOCK：近期多 NPC 对白',
        fallback: false,
      };
    }

    return {
      mode: 'reply_player',
      speakers: [input.chatNpcId],
      reason: 'MOCK：默认专注',
      fallback: false,
    };
  }

  private fallbackDecision(
    fallback: Exclude<DirectorDecision['fallback'], false>,
    cast: CastMember[],
    focusNpcId: string,
  ): DirectorDecision {
    const castIds = cast.map((c) => c.npc_id);
    return {
      mode: 'reply_then_exchange',
      speakers: castIds.length > 0 ? castIds : [focusNpcId],
      reason: `fallback:${fallback}`,
      fallback,
    };
  }

  private blurbFromNpc(npc: PackNpc): string {
    const firstLine =
      npc.system_prompt_template
        .split('\n')
        .map((l) => l.trim())
        .find(Boolean) ?? npc.name;
    if (firstLine.length <= BLURB_MAX_LEN) return firstLine;
    return `${firstLine.slice(0, BLURB_MAX_LEN - 1)}…`;
  }

  private formatRecentLines(utterances: SceneUtterance[]): string[] {
    return utterances.map((u) => {
      if (u.kind === 'player_to_npc') return `玩家：${u.text}`;
      if (u.kind === 'npc_to_player') {
        return `${u.speaker_name}：${u.text}`;
      }
      if (u.kind === 'npc_to_npc') {
        const target = u.addressee_name ?? '?';
        return `${u.speaker_name}→${target}：${u.text}`;
      }
      return `${u.speaker_name}：${u.text}`;
    });
  }
}
