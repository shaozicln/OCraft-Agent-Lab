'use client';

import { Html } from '@react-three/drei';
import '@/components/ui/game-overlay.css';

const CHARS_PER_LINE = 10;
const MAX_LINES = 3;

/** 一行最多 10 字、最多 3 行，超出末尾用 ... */
export function formatSpeechBubbleText(raw: string): string {
  const chars = Array.from(raw.replace(/\s+/g, ' ').trim());
  if (chars.length === 0) return '';
  const capacity = CHARS_PER_LINE * MAX_LINES;
  const display =
    chars.length > capacity
      ? [...chars.slice(0, capacity - 3), '.', '.', '.']
      : chars;
  const lines: string[] = [];
  for (let i = 0; i < display.length; i += CHARS_PER_LINE) {
    lines.push(display.slice(i, i + CHARS_PER_LINE).join(''));
  }
  return lines.join('\n');
}

/** 头顶台词气泡（drei Html）；无文案时不渲染 */
export function SpeechBubbleHtml({
  text,
  /** 相对角色原点的高度；略高于头顶留空隙 */
  anchorY = 1.95,
}: {
  text: string | null;
  anchorY?: number;
}) {
  if (!text) return null;
  const display = formatSpeechBubbleText(text);
  if (!display) return null;

  return (
    <Html
      position={[0, anchorY, 0]}
      center
      distanceFactor={8}
      zIndexRange={[40, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div className="speech-bubble">{display}</div>
    </Html>
  );
}
