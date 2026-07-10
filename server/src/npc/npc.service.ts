import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  NpcDefinition,
  NpcPublicResponse,
  NpcRuntimeState,
  type PackNpc,
} from '@ocraft/shared';
import { PlayerStateRepository } from '../db/player-state.repository';
import { PackService } from '../story/pack.service';
import {
  assembleSystemPrompt,
  type SystemPromptContext,
} from './prompt-builder';

function packNpcToDefinition(npc: PackNpc): NpcDefinition {
  return {
    npc_id: npc.npc_id,
    name: npc.name,
    meta: npc.meta,
    attributes: npc.attributes,
    system_prompt_template: npc.system_prompt_template,
    memories: npc.memories,
  };
}

@Injectable()
export class NpcService {
  private readonly logger = new Logger(NpcService.name);
  /** key: PackService.sessionKey(playerId, npcId) */
  private runtimeCache = new Map<string, NpcRuntimeState>();

  constructor(
    private readonly playerStateRepo: PlayerStateRepository,
    private readonly packService: PackService,
  ) {}

  sessionKey(playerId: string, npcId: string): string {
    return this.packService.sessionKey(playerId, npcId);
  }

  private progressKey() {
    return this.packService.getProgressKey();
  }

  getDefinition(npcId: string): NpcDefinition {
    const npc = this.packService.tryGetNpc(npcId);
    if (!npc) {
      throw new NotFoundException(`NPC not found: ${npcId}`);
    }
    return packNpcToDefinition(npc);
  }

  getPublicProfile(npcId: string): NpcPublicResponse {
    const def = this.getDefinition(npcId);
    return {
      npc_id: def.npc_id,
      name: def.name,
      meta: def.meta,
      runtime: this.getDefaultRuntimeState(npcId),
      max_fatigue: def.attributes.max_fatigue,
    };
  }

  getDefaultRuntimeState(npcId: string): NpcRuntimeState {
    const def = this.getDefinition(npcId);
    return {
      fatigue: def.attributes.fatigue,
      affinity: def.attributes.affinity,
      current_status: def.attributes.current_status,
    };
  }

  async hydrateRuntime(playerId: string, npcId: string): Promise<NpcRuntimeState> {
    const { worldId, packVersionId } = this.progressKey();
    const session = await this.playerStateRepo.loadSession(
      playerId,
      worldId,
      packVersionId,
      npcId,
      this.getDefaultRuntimeState(npcId),
      this.packService.getDefaultChapter(),
    );
    const key = this.sessionKey(playerId, npcId);
    this.runtimeCache.set(key, session.runtime);
    return session.runtime;
  }

  getRuntimeState(playerId: string, npcId: string): NpcRuntimeState {
    const cached = this.runtimeCache.get(this.sessionKey(playerId, npcId));
    return cached ?? this.getDefaultRuntimeState(npcId);
  }

  updateRuntimeState(
    playerId: string,
    npcId: string,
    patch: Partial<NpcRuntimeState>,
  ): NpcRuntimeState {
    const def = this.getDefinition(npcId);
    const current = this.getRuntimeState(playerId, npcId);

    const next: NpcRuntimeState = {
      fatigue: patch.fatigue ?? current.fatigue,
      affinity: patch.affinity ?? current.affinity,
      current_status: patch.current_status ?? current.current_status,
    };

    next.fatigue = Math.max(0, Math.min(def.attributes.max_fatigue, next.fatigue));
    next.affinity = Math.max(0, Math.min(100, next.affinity));

    const key = this.sessionKey(playerId, npcId);
    this.runtimeCache.set(key, next);
    const { worldId, packVersionId } = this.progressKey();
    void this.playerStateRepo.saveRuntime(
      playerId,
      worldId,
      packVersionId,
      npcId,
      next,
      this.packService.getDefaultChapter(),
    );
    this.logger.log(`Updated state for ${key}: ${JSON.stringify(next)}`);
    return next;
  }

  getInterestTriggers(npcId: string): string[] {
    const { favorite_things, favorite_synonyms = {} } =
      this.getDefinition(npcId).attributes;
    const triggers = new Set<string>();
    for (const fav of favorite_things) {
      triggers.add(fav);
      for (const syn of favorite_synonyms[fav] ?? []) {
        triggers.add(syn);
      }
    }
    return [...triggers];
  }

  buildSystemPrompt(
    npcId: string,
    ctx: Omit<SystemPromptContext, 'prompts'>,
  ): string {
    const def = this.getDefinition(npcId);
    const prompts = this.packService.getPack().prompts;
    return assembleSystemPrompt(def.system_prompt_template, {
      ...ctx,
      prompts,
    });
  }

  resetAllSessionsForNpc(npcId: string) {
    const suffix = `:${npcId}`;
    for (const key of [...this.runtimeCache.keys()]) {
      if (key.endsWith(suffix)) {
        this.runtimeCache.delete(key);
      }
    }
  }

  resetRuntimeState(playerId: string, npcId: string) {
    this.runtimeCache.delete(this.sessionKey(playerId, npcId));
  }
}
