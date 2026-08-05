'use client';

import { Html } from '@react-three/drei';

/** 头顶台词气泡（drei Html）；无文案时不渲染 */
export function SpeechBubbleHtml({
  text,
  anchorY = 1.55,
}: {
  text: string | null;
  anchorY?: number;
}) {
  if (!text) return null;
  return (
    <Html
      position={[0, anchorY, 0]}
      center
      distanceFactor={8}
      zIndexRange={[40, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="max-w-[11rem] rounded-2xl border border-white/20 bg-slate-900/90 px-2.5 py-1.5 text-center text-[11px] leading-snug text-slate-50 shadow-lg"
        style={{
          backdropFilter: 'blur(4px)',
        }}
      >
        {text}
      </div>
    </Html>
  );
}
