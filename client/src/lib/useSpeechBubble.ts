'use client';

import { useSyncExternalStore } from 'react';
import {
  getSpeechBubble,
  subscribeSpeechBubble,
  truncateBubbleText,
  type SpeechBubble,
} from '@/lib/speechBubbles';

function snapshot(): SpeechBubble | null {
  return getSpeechBubble();
}

export function useSpeechBubble(speakerId: string): string | null {
  const bubble = useSyncExternalStore(
    subscribeSpeechBubble,
    snapshot,
    () => null,
  );
  if (!bubble || bubble.speakerId !== speakerId) return null;
  if (bubble.until <= Date.now()) return null;
  return truncateBubbleText(bubble.text);
}
