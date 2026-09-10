'use client';

import { APPEARANCES, PALETTES } from '@/theme/palettes';
import { useTheme } from '@/theme/ThemeProvider';

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { appearance, palette, setAppearance, setPalette } = useTheme();

  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend
          className="mb-2 text-xs font-semibold tracking-wide"
          style={{ color: 'var(--ui-fg-muted)' }}
        >
          明暗
        </legend>
        <div
          className="flex rounded-lg p-1"
          style={{ background: 'var(--ui-bg-elevated)' }}
        >
          {APPEARANCES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={appearance === item.id}
              onClick={() => setAppearance(item.id)}
              className={`flex-1 rounded-md px-2 py-2 text-sm font-medium transition-colors ${
                compact ? 'text-xs' : ''
              }`}
              style={
                appearance === item.id
                  ? {
                      background: 'var(--ui-panel-solid)',
                      color: 'var(--ui-fg)',
                      boxShadow: 'var(--ui-shadow)',
                    }
                  : { color: 'var(--ui-fg-muted)' }
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend
          className="mb-2 text-xs font-semibold tracking-wide"
          style={{ color: 'var(--ui-fg-muted)' }}
        >
          主题色
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {PALETTES.map((item) => {
            const selected = palette === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setPalette(item.id)}
                className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm"
                style={{
                  borderColor: selected ? 'var(--ui-accent)' : 'var(--ui-border)',
                  background: selected
                    ? 'var(--ui-accent-muted)'
                    : 'var(--ui-panel-solid)',
                  color: 'var(--ui-fg)',
                }}
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{ background: item.swatch }}
                  aria-hidden
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
