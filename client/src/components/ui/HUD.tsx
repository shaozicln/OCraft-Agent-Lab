'use client';

import './game-overlay.css';

interface StatBarProps {
  label: string;
  value: number;
  max: number;
  delta?: number;
}

function StatBar({ label, value, max, delta }: StatBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="game-stat-row">
      <div className="game-stat-row__meta">
        <span>{label}</span>
        <span className="flex items-center gap-1">
          {value}/{max}
          {delta !== undefined && delta !== 0 && (
            <span
              className={
                delta > 0 ? 'game-stat-delta--up' : 'game-stat-delta--down'
              }
            >
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          )}
        </span>
      </div>
      <div className="game-stat-row__track">
        <div className="game-stat-row__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface HUDProps {
  visible: boolean;
  name: string;
  affinity: number;
  fatigue: number;
  maxFatigue: number;
  affinityDelta?: number;
  fatigueDelta?: number;
}

/** 好感/疲惫进度条；定位由父级负责（左上角） */
export function HUD({
  visible,
  name,
  affinity,
  fatigue,
  maxFatigue,
  affinityDelta,
  fatigueDelta,
}: HUDProps) {
  if (!visible) return null;

  return (
    <div className="game-stat-card">
      <h3>{name}</h3>
      <StatBar label="好感度" value={affinity} max={100} delta={affinityDelta} />
      <StatBar
        label="疲惫值"
        value={fatigue}
        max={maxFatigue}
        delta={fatigueDelta}
      />
    </div>
  );
}
