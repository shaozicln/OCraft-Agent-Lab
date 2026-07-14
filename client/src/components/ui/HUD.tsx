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
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex justify-between text-xs text-slate-300">
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
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-700">
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
    <div className="w-56 rounded-xl border border-slate-600 bg-slate-900/85 p-4 shadow-xl backdrop-blur">
      <h3 className="mb-3 text-sm font-semibold text-white">{name}</h3>
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
    </div>
  );
}
