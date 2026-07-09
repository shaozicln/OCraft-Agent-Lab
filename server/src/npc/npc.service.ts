import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  NpcDefinition,
  NpcPublicResponse,
  NpcRuntimeState,
  npcDefinitionSchema,
} from '@ocraft/shared';
import { PlayerStateRepository } from '../db/player-state.repository';
import {
  assembleSystemPrompt,
  type SystemPromptContext,
} from './prompt-builder';

@Injectable()
export class NpcService {
  private readonly logger = new Logger(NpcService.name);
  private readonly mockDataDir = path.join(__dirname, '..', 'mock-data');
  private definitions = new Map<string, NpcDefinition>();
  /** key: `${playerId}:${npcId}` */
  private runtimeCache = new Map<string, NpcRuntimeState>();

  constructor(private readonly playerStateRepo: PlayerStateRepository) {
    this.loadDefinitions();
  }

  sessionKey(playerId: string, npcId: string): string {
    return `${playerId}:${npcId}`;
  }

  private loadDefinitions() {
    const filePath = path.join(this.mockDataDir, 'npc.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const npc = npcDefinitionSchema.parse(JSON.parse(raw));
    this.definitions.set(npc.npc_id, npc);
  }

  getDefinition(npcId: string): NpcDefinition {
    const def = this.definitions.get(npcId);
    if (!def) {
      throw new NotFoundException(`NPC not found: ${npcId}`);
    }
    return def;
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
    const session = await this.playerStateRepo.loadSession(
      playerId,
      npcId,
      this.getDefaultRuntimeState(npcId),
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
    void this.playerStateRepo.saveRuntime(playerId, npcId, next);
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

  buildSystemPrompt(npcId: string, ctx: SystemPromptContext): string {
    const def = this.getDefinition(npcId);
    return assembleSystemPrompt(def.system_prompt_template, ctx);
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
