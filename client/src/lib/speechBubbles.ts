/**
 * AP-4b：场景头顶台词气泡（轻量订阅，避免 page 层层传 text）。
 * speakerId：NPC 的 npc_id，或玩家演出位 `player`。
 */

export const SPEECH_BUBBLE_PLAYER_ID = 'player';

export type SpeechBubble = {
  speakerId: string;
  text: string;
  /** 到期时间戳；流式时可设得很远，结束再缩短 */
  until: number;
  /** 递增，便于同 speaker 刷新时触发动画 */
  seq: number;
};

type Listener = () => void;

let bubble: SpeechBubble | null = null;
let seq = 0;
const listeners = new Set<Listener>();
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  for (const l of listeners) l();
}

function scheduleAutoClear(until: number) {
  if (clearTimer != null) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  const ms = until - Date.now();
  if (ms <= 0) {
    bubble = null;
    notify();
    return;
  }
  clearTimer = setTimeout(() => {
    clearTimer = null;
    bubble = null;
    notify();
  }, ms);
}

export function getSpeechBubble(): SpeechBubble | null {
  if (bubble && bubble.until <= Date.now()) {
    bubble = null;
  }
  return bubble;
}

/** 展示/刷新气泡；同 speaker 连续流式可反复调用 */
export function setSpeechBubble(opts: {
  speakerId: string;
  text: string;
  /** 默认 4.2s；流式建议更长 */
  ttlMs?: number;
}): void {
  const text = opts.text.trim();
  if (!text || !opts.speakerId) return;
  seq += 1;
  const ttlMs = opts.ttlMs ?? 4200;
  bubble = {
    speakerId: opts.speakerId,
    text,
    until: Date.now() + ttlMs,
    seq,
  };
  scheduleAutoClear(bubble.until);
  notify();
}

export function clearSpeechBubble(speakerId?: string): void {
  if (speakerId && bubble && bubble.speakerId !== speakerId) return;
  if (clearTimer != null) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  if (!bubble) return;
  bubble = null;
  notify();
}

export function subscribeSpeechBubble(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 展示用截断（光遇式短句） */
export function truncateBubbleText(text: string, max = 42): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
