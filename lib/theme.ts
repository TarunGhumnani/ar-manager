export type Theme = 'light' | 'dark' | 'system';

export const THEME_KEY = 'theme';

/**
 * Runs in <head> before the page paints, so there is no flash of the wrong theme.
 * - No saved choice (or 'system'): follow the operating system, including live changes.
 * - Printing always uses the light theme, so statements print black on white.
 */
export const themeScript = `(function () {
  var root = document.documentElement;
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  function saved() { try { return localStorage.getItem('${THEME_KEY}'); } catch (e) { return null; } }
  function apply() {
    var t = saved();
    root.classList.toggle('dark', t === 'dark' || (t !== 'light' && media.matches));
  }
  apply();
  media.addEventListener('change', apply);
  window.addEventListener('storage', apply);
  window.addEventListener('beforeprint', function () { root.classList.remove('dark'); });
  window.addEventListener('afterprint', apply);
  window.__applyTheme = apply;
})();`;
