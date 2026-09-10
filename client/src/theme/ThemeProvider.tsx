'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_APPEARANCE,
  DEFAULT_PALETTE,
  STORAGE_APPEARANCE,
  STORAGE_PALETTE,
  STORAGE_THEME_LEGACY,
  isAppearance,
  isPaletteId,
  resolveTheme,
  type Appearance,
  type PaletteId,
  type ResolvedTheme,
} from './palettes';

function readSystemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredAppearance(): Appearance {
  const app = window.localStorage.getItem(STORAGE_APPEARANCE);
  if (isAppearance(app)) return app;
  const legacy = window.localStorage.getItem(STORAGE_THEME_LEGACY);
  if (legacy === 'light' || legacy === 'dark') return legacy;
  return DEFAULT_APPEARANCE;
}

function readStoredPalette(): PaletteId {
  const pal = window.localStorage.getItem(STORAGE_PALETTE);
  return isPaletteId(pal) ? pal : DEFAULT_PALETTE;
}

function applyDom(theme: ResolvedTheme, palette: PaletteId, appearance: Appearance) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-palette', palette);
  root.setAttribute('data-appearance', appearance);
  root.style.colorScheme = theme;
}

interface ThemeContextValue {
  appearance: Appearance;
  palette: PaletteId;
  theme: ResolvedTheme;
  setAppearance: (appearance: Appearance) => void;
  setPalette: (palette: PaletteId) => void;
  /** @deprecated 使用 setAppearance；保留以兼容旧调用 */
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [palette, setPaletteState] = useState<PaletteId>(DEFAULT_PALETTE);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const nextAppearance = readStoredAppearance();
    const nextPalette = readStoredPalette();
    const dark = readSystemDark();
    // 阻塞脚本已写入 DOM；此处只同步 React 状态，避免选择器与真实主题不一致。
    setAppearanceState(nextAppearance);
    setPaletteState(nextPalette);
    setSystemDark(dark);
    applyDom(resolveTheme(nextAppearance, dark), nextPalette, nextAppearance);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const nowDark = mq.matches;
      setSystemDark(nowDark);
      const app = readStoredAppearance();
      const pal = readStoredPalette();
      applyDom(resolveTheme(app, nowDark), pal, app);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const theme = resolveTheme(appearance, systemDark);

  const setAppearance = useCallback(
    (next: Appearance) => {
      setAppearanceState(next);
      window.localStorage.setItem(STORAGE_APPEARANCE, next);
      window.localStorage.removeItem(STORAGE_THEME_LEGACY);
      applyDom(resolveTheme(next, readSystemDark()), palette, next);
    },
    [palette],
  );

  const setPalette = useCallback(
    (next: PaletteId) => {
      setPaletteState(next);
      window.localStorage.setItem(STORAGE_PALETTE, next);
      applyDom(theme, next, appearance);
    },
    [theme, appearance],
  );

  const setTheme = useCallback(
    (next: 'light' | 'dark') => {
      setAppearance(next);
    },
    [setAppearance],
  );

  const toggleTheme = useCallback(() => {
    setAppearance(theme === 'light' ? 'dark' : 'light');
  }, [setAppearance, theme]);

  const value = useMemo(
    () => ({
      appearance,
      palette,
      theme,
      setAppearance,
      setPalette,
      setTheme,
      toggleTheme,
    }),
    [appearance, palette, theme, setAppearance, setPalette, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
