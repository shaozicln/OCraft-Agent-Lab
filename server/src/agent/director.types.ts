import type {
  DirectorFallback,
  DirectorMode,
} from '@ocraft/shared';

export type { DirectorFallback, DirectorMode };

export interface CastMember {
  npc_id: string;
  display_name: string;
  blurb: string;
}

export interface DirectorInput {
  playerId: string;
  chatNpcId: string;
  playerMessage: string;
  cast: CastMember[];
  chapterId: string;
  chapterLabel: string;
  flagNames: string[];
  recentLines: string[];
}

export interface DirectorDecision {
  mode: DirectorMode;
  speakers: string[];
  reason: string;
  fallback: DirectorFallback;
}
