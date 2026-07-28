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
  /** MA-H：当前可尝试的 exchange 戏码 id（无触发细节） */
  availableEvents: string[];
}

export interface DirectorDecision {
  mode: DirectorMode;
  speakers: string[];
  reason: string;
  fallback: DirectorFallback;
  /** 回显本轮 hint（非 LLM 输出） */
  available_events?: string[];
}
