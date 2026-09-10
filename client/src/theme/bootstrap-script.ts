/** 同步内联脚本：在首屏绘制前写入 data-theme / data-palette，避免 SSR 闪烁。 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var pal = localStorage.getItem('ocraft_ui_palette');
    var app = localStorage.getItem('ocraft_ui_appearance');
    var legacy = localStorage.getItem('ocraft_ui_theme');
    if (!app && (legacy === 'light' || legacy === 'dark')) app = legacy;
    if (app !== 'light' && app !== 'dark' && app !== 'system') app = 'system';
    var allowed = {mist:1,sage:1,sand:1,lavender:1,rose:1,teal:1};
    if (!allowed[pal]) pal = 'mist';
    var dark = app === 'dark' || (app !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-palette', pal);
    root.setAttribute('data-appearance', app);
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {
    var r = document.documentElement;
    r.setAttribute('data-theme', 'light');
    r.setAttribute('data-palette', 'mist');
    r.setAttribute('data-appearance', 'system');
  }
})();`;
