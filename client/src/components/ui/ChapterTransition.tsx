'use client';

import { useEffect, useState } from 'react';
import './chapter-transition.css';

type Phase = 'in' | 'hold' | 'out';

export type ChapterCue = {
  key: number;
  ordinal?: number;
  title: string;
};

/** 下滑入场 / 悬停 / 上撤（ms） */
const MS_IN = 640;
const MS_HOLD = 3000;
const MS_OUT = 520;

/**
 * 升章提示：顶部卡片缓慢下弹 → 悬停 3s → 向上撤走。
 * 不挡操作（pointer-events: none）。
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

    const tHold = window.setTimeout(() => setPhase('hold'), MS_IN);
    const tOut = window.setTimeout(() => setPhase('out'), MS_IN + MS_HOLD);
    const tDone = window.setTimeout(() => {
      setPhase(null);
      setActive(null);
      onDone();
    }, MS_IN + MS_HOLD + MS_OUT);

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
      role="status"
      aria-live="polite"
      aria-label={`${kicker} ${active.title}`}
    >
      <div className="chapter-cue__card">
        <p className="chapter-cue__kicker">{kicker}</p>
        <h2 className="chapter-cue__title">{active.title}</h2>
      </div>
    </div>
  );
}
