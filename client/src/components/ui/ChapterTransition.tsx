'use client';

import { useEffect, useState } from 'react';
import './chapter-transition.css';

type Phase = 'in' | 'hold' | 'out';

export type ChapterCue = {
  key: number;
  ordinal?: number;
  title: string;
};

/**
 * 升章全屏过场：黑场 + 电影黑边 + 章节标题。
 * 由父组件在章节 id 变化时传入 cue；播完回调 onDone。
 */
export function ChapterTransition({
  cue,
  onDone,
}: {
  cue: ChapterCue | null;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase | null>(null);
  const [active, setActive] = useState<ChapterCue | null>(null);

  useEffect(() => {
    if (!cue) {
      setPhase(null);
      setActive(null);
      return;
    }
    setActive(cue);
    setPhase('in');
    document.exitPointerLock?.();

    const tHold = window.setTimeout(() => setPhase('hold'), 480);
    const tOut = window.setTimeout(() => setPhase('out'), 480 + 1600);
    const tDone = window.setTimeout(() => {
      setPhase(null);
      setActive(null);
      onDone();
    }, 480 + 1600 + 640);

    return () => {
      window.clearTimeout(tHold);
      window.clearTimeout(tOut);
      window.clearTimeout(tDone);
    };
  }, [cue, onDone]);

  if (!active || !phase) return null;

  const kicker =
    active.ordinal != null ? `第 ${active.ordinal} 章` : '章节推进';

  return (
    <div
      className="chapter-cue"
      data-phase={phase}
      role="dialog"
      aria-live="polite"
      aria-label={`${kicker} ${active.title}`}
    >
      <div className="chapter-cue__veil" aria-hidden />
      <div className="chapter-cue__bar chapter-cue__bar--top" aria-hidden />
      <div className="chapter-cue__bar chapter-cue__bar--bottom" aria-hidden />
      <div className="chapter-cue__copy">
        <p className="chapter-cue__kicker">{kicker}</p>
        <div className="chapter-cue__rule" aria-hidden />
        <h2 className="chapter-cue__title">{active.title}</h2>
      </div>
    </div>
  );
}
