/**
 * Runs in the browser, inline in <head> (added by the kernel when the theme offers a light/dark switch).
 *
 * Before the page is drawn, it applies the visitor's saved choice (`data-color-scheme` on <html>), so there is no
 * flash of the wrong colours. Then it shows the theme's switch buttons (`[data-color-scheme-toggle]`, hidden without
 * JavaScript), keeps their `aria-pressed` in step (pressed = dark) and saves each change. Without a saved choice, the
 * system preference applies, as in the CSS.
 */
function vvitrineColorScheme(): void {
  const KEY = 'vvitrine:color-scheme';
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    // Storage blocked: the switch still works for this page.
  }
  if (saved === 'light' || saved === 'dark') root.dataset.colorScheme = saved;

  const isDark = () => (root.dataset.colorScheme ?? (system.matches ? 'dark' : 'light')) === 'dark';
  const buttons = () => document.querySelectorAll<HTMLButtonElement>('[data-color-scheme-toggle]');
  const sync = () => {
    for (const button of buttons()) button.setAttribute('aria-pressed', String(isDark()));
  };

  addEventListener('DOMContentLoaded', () => {
    for (const button of buttons()) {
      button.hidden = false;
      button.addEventListener('click', () => {
        const next = isDark() ? 'light' : 'dark';
        root.dataset.colorScheme = next;
        try {
          localStorage.setItem(KEY, next);
        } catch {
          // Not saved: the choice lasts for this page.
        }
        sync();
      });
    }
    sync();
  });
  system.addEventListener('change', sync);
}

/** About 1 KB, no request. */
export const colorSchemeScript = `(${vvitrineColorScheme.toString()})();`;
