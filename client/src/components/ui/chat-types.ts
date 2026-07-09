export type ChatMessage = {
  role: 'player' | 'npc' | 'system';
  text: string;
};
