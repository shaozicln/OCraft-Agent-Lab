export const PALETTES = [
  { id: 'mist', label: '雾蓝', swatch: '#3D6A82' },
  { id: 'sage', label: '鼠尾草绿', swatch: '#4A6B54' },
  { id: 'sand', label: '暖沙', swatch: '#8A6A4A' },
  { id: 'lavender', label: '薰衣草灰', swatch: '#6A6280' },
  { id: 'rose', label: '玫瑰灰', swatch: '#8A5E68' },
  { id: 'teal', label: '青灰', swatch: '#3E6E6C' },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];

export const APPEARANCES = [
  { id: 'system', label: '跟随系统' },
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
] as const;

export type Appearance = (typeof APPEARANCES)[number]['id'];
export type ResolvedTheme = 'light' | 'dark';

export const DEFAULT_PALETTE: PaletteId = 'mist';
export const DEFAULT_APPEARANCE: Appearance = 'system';

export const STORAGE_APPEARANCE = 'ocraft_ui_appearance';
export const STORAGE_PALETTE = 'ocraft_ui_palette';
/** 旧键：仅 light/dark，启动时迁移 */
export const STORAGE_THEME_LEGACY = 'ocraft_ui_theme';

export function isPaletteId(v: string | null): v is PaletteId {
  return PALETTES.some((p) => p.id === v);
}

export function isAppearance(v: string | null): v is Appearance {
  return APPEARANCES.some((a) => a.id === v);
}

export function resolveTheme(appearance: Appearance, systemDark: boolean): ResolvedTheme {
  if (appearance === 'light') return 'light';
  if (appearance === 'dark') return 'dark';
  return systemDark ? 'dark' : 'light';
}
