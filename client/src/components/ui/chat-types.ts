export type ChatMessage = {
  role: 'player' | 'npc' | 'system' | 'exchange';
  text: string;
  /** 互聊旁听时的发言者名 */
  speakerName?: string;
};
