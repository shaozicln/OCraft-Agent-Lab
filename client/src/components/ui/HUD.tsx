'use client';

interface StatBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  delta?: number;
}

function StatBar({ label, value, max, color, delta }: StatBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-slate-300 mb-1">
        <span>{label}</span>
        <span className="flex items-center gap-1">
          {value}/{max}
          {delta !== undefined && delta !== 0 && (
            <span className={delta > 0 ? 'text-green-400' : 'text-red-400'}>
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          )}
        </span>
      </div>
      <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
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
  chapterState?: string;
  affinityDelta?: number;
  fatigueDelta?: number;
}

export function HUD({
  visible,
  name,
  affinity,
  fatigue,
  maxFatigue,
  chapterState,
  affinityDelta,
  fatigueDelta,
}: HUDProps) {
  if (!visible) return null;

  return (
    <div className="absolute top-4 right-4 z-30 w-56 bg-slate-900/85 backdrop-blur border border-slate-600 rounded-xl p-4 shadow-xl">
      <h3 className="text-sm font-semibold text-white mb-3">{name}</h3>
      <StatBar
        label="好感度"
        value={affinity}
        max={100}
        color="#F472B6"
        delta={affinityDelta}
      />
      <StatBar
        label="疲惫值"
        value={fatigue}
        max={maxFatigue}
        color="#60A5FA"
        delta={fatigueDelta}
      />
      {chapterState && (
        <p className="text-xs text-slate-400 mt-1">
          章节：<span className="text-amber-300 font-mono">{chapterState}</span>
        </p>
      )}
    </div>
  );
}
