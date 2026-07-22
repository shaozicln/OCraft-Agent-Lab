export type ChatMessage = {
  role: 'player' | 'npc' | 'system' | 'exchange' | 'aside';
  text: string;
  /** 互聊旁听 / 多 NPC 时间线中的发言者名 */
  speakerName?: string;
  /** 稳定 id：流式更新只覆盖同一 speakerId，避免切人时盖掉上一句 */
  speakerId?: string;
};
