import type {
  ArchivedMessage,
  ArchivedNpcState,
  ArchivedNpcSlot,
  ConversationSnapshotV2,
} from '@ocraft/shared';
import { conversationSnapshotV2Schema } from '@ocraft/shared';

export const SAVE_SCHEMA_VERSION = 2 as const;

export type MigratedRunSnapshot = ConversationSnapshotV2;

/**
 * 读档版本迁移链：缺字段补默认，统一到当前 SAVE_SCHEMA_VERSION。
 */
export function migrateSave(raw: unknown): MigratedRunSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // 已是 v2
  const asV2 = conversationSnapshotV2Schema.safeParse(obj);
  if (asV2.success) return asV2.data;

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
    return conversationSnapshotV2Schema.parse(v2);
  }

  // payload 嵌套
  if (obj.payload && typeof obj.payload === 'object') {
    return migrateSave(obj.payload);
  }

  return null;
}
