import { Injectable } from '@nestjs/common';
import type { NpcFollowState } from '@ocraft/shared';

@Injectable()
export class NpcFollowService {
  /** playerId → npcId → follow */
  private readonly byPlayer = new Map<string, Map<string, NpcFollowState>>();

  get(playerId: string, npcId: string): NpcFollowState | null {
    return this.byPlayer.get(playerId)?.get(npcId) ?? null;
  }

  set(playerId: string, npcId: string, state: NpcFollowState): void {
    let map = this.byPlayer.get(playerId);
    if (!map) {
      map = new Map();
      this.byPlayer.set(playerId, map);
    }
    map.set(npcId, state);
  }

  clear(playerId: string, npcId: string): boolean {
    const map = this.byPlayer.get(playerId);
    if (!map?.has(npcId)) return false;
    map.delete(npcId);
    if (map.size === 0) this.byPlayer.delete(playerId);
    return true;
  }

  clearPlayer(playerId: string): void {
    this.byPlayer.delete(playerId);
  }
}
