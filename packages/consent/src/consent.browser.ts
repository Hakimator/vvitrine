/**
 * Runs in the browser (printed inline by the banner): remembers the visitor's choice and tells the services.
 *
 * Contract for services that need consent (e.g. `@vvitrine/analytics`): listen to the `vvitrine:consent` event on
 * `window`. Its `detail.granted` is true or false. It is sent once per page when a choice is known (remembered or just
 * made), and again each time the visitor changes it. Nothing is sent while the visitor has not chosen.
 */
function vvitrineConsent(script: HTMLScriptElement | null): void {
  const banner = script?.closest<HTMLElement>('[data-consent-banner]');
  if (!banner) return;
  const KEY = 'vvitrine:consent';
  // The CNIL recommends remembering a choice, acceptance or refusal, for 6 months before asking again.
  const MAX_AGE = 182 * 24 * 60 * 60 * 1000;

  const remembered = (): boolean | null => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { granted?: unknown; at?: unknown } | null;
      if (
        saved &&
        typeof saved.granted === 'boolean' &&
        typeof saved.at === 'number' &&
        Date.now() - saved.at < MAX_AGE
      ) {
        return saved.granted;
      }
    } catch {
      // Storage blocked or unreadable: ask again.
    }
    return null;
  };
  const announce = (granted: boolean) => dispatchEvent(new CustomEvent('vvitrine:consent', { detail: { granted } }));
  const show = (visible: boolean) => {
    banner.hidden = !visible;
    // Keep focused elements visible above the banner (WCAG 2.4.11).
    document.documentElement.style.scrollPaddingBottom = visible ? `${banner.offsetHeight + 16}px` : '';
  };
  const choose = (granted: boolean) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ granted, at: Date.now() }));
    } catch {
      // The choice then lasts for this page only.
    }
    show(false);
    announce(granted);
  };

  banner.querySelector('[data-consent="accept"]')?.addEventListener('click', () => choose(true));
  banner.querySelector('[data-consent="refuse"]')?.addEventListener('click', () => choose(false));
  // "Manage cookies" links (footer) open the banner again.
  for (const link of document.querySelectorAll<HTMLAnchorElement>(`a[href="#${banner.id}"]`)) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      show(true);
      banner.focus();
    });
  }

  const choice = remembered();
  if (choice === null) show(true);
  else announce(choice);
}

/** Print it inline at the end of the banner: no request, no dependency. */
export const consentScript = `(${vvitrineConsent.toString()})(document.currentScript);`;
