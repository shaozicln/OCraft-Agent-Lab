import { randomUUID } from 'crypto';
import type {
  ArchivedMessage,
  ArchivedNpcState,
  ArchivedNpcSlot,
  ConversationSnapshotV2,
  ConversationSnapshotV3,
  SceneUtterance,
} from '@ocraft/shared';
import {
  conversationSnapshotV2Schema,
  conversationSnapshotV3Schema,
  SCENE_PLAYER_DISPLAY_NAME,
  SCENE_PLAYER_ID,
} from '@ocraft/shared';

export const SAVE_SCHEMA_VERSION = 3 as const;

export type MigratedRunSnapshot = ConversationSnapshotV3;

/** 旧档无 scene_log 时：按各 NPC messages 的 at 拼伪时间线（不含互聊） */
export function stitchSceneLogFromNpcs(
  npcs: Record<string, ArchivedNpcSlot>,
  npcNames?: Record<string, string>,
): SceneUtterance[] {
  const out: SceneUtterance[] = [];
  for (const [npcId, slot] of Object.entries(npcs)) {
    const npcName = npcNames?.[npcId] ?? npcId;
    for (const m of slot.messages ?? []) {
      if (m.role === 'user') {
        out.push({
          id: randomUUID(),
          at: m.at,
          kind: 'player_to_npc',
          speaker_id: SCENE_PLAYER_ID,
          speaker_name: SCENE_PLAYER_DISPLAY_NAME,
          addressee_id: npcId,
          addressee_name: npcName,
          text: m.content,
          meta: { migrated: true },
        });
      } else {
        out.push({
          id: randomUUID(),
          at: m.at,
          kind: 'npc_to_player',
          speaker_id: npcId,
          speaker_name: npcName,
          addressee_id: SCENE_PLAYER_ID,
          addressee_name: SCENE_PLAYER_DISPLAY_NAME,
          text: m.content,
          meta: { migrated: true },
        });
      }
    }
  }
  out.sort((a, b) => a.at.localeCompare(b.at));
  return out;
}

function v2ToV3(v2: ConversationSnapshotV2): ConversationSnapshotV3 {
  return conversationSnapshotV3Schema.parse({
    ...v2,
    schema_version: 3,
    scene_log: stitchSceneLogFromNpcs(v2.npcs),
  });
}

/**
 * 读档版本迁移链：缺字段补默认，统一到当前 SAVE_SCHEMA_VERSION。
 */
export function migrateSave(raw: unknown): MigratedRunSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // 已是 v3
  const asV3 = conversationSnapshotV3Schema.safeParse(obj);
  if (asV3.success) return asV3.data;

  // 已是 v2 → 升 v3
  const asV2 = conversationSnapshotV2Schema.safeParse(obj);
  if (asV2.success) return v2ToV3(asV2.data);

  // v1：顶层 npc_state + messages，无 schema_version / npcs / world
  const npcState = obj.npc_state as ArchivedNpcState | undefined;
  const messages = obj.messages as ArchivedMessage[] | undefined;
  if (npcState && Array.isArray(messages)) {
    const focusId =
      typeof obj.focus_npc_id === 'string' ? obj.focus_npc_id : 'legacy_npc';
    const chapter = npcState.chapter_state;
    const flags = npcState.story_flags ?? {};
    const slot: ArchivedNpcSlot = {
      affinity: npcState.affinity,
      fatigue: npcState.fatigue,
      current_status: npcState.current_status,
      story_flags: flags,
      messages,
    };
    const v2: ConversationSnapshotV2 = {
      schema_version: 2,
      saved_at:
        typeof obj.saved_at === 'string'
          ? obj.saved_at
          : new Date().toISOString(),
      focus_npc_id: focusId,
      world: {
        chapter_state: chapter,
        story_flags: flags,
      },
      npc_state: {
        ...npcState,
        story_flags: flags,
      },
      messages,
      npcs: { [focusId]: slot },
    };
    return v2ToV3(conversationSnapshotV2Schema.parse(v2));
  }

  // payload 嵌套
  if (obj.payload && typeof obj.payload === 'object') {
    return migrateSave(obj.payload);
  }

  return null;
}
