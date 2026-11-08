/**
 * Runs in the browser (printed inline in <head>): loads Google Analytics 4 only once the visitor accepts, through the
 * `vvitrine:consent` event of `@vvitrine/consent`, and removes its cookies when the visitor refuses.
 */
function vvitrineGa4(measurementId: string, cookieSeconds: number): void {
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  const dataLayer = w.dataLayer;
  // gtag.js reads the `arguments` objects pushed here, not arrays.
  const gtag: (...args: unknown[]) => void = function () {
    // eslint-disable-next-line prefer-rest-params -- gtag.js expects the arguments object itself.
    dataLayer.push(arguments);
  };
  let loaded = false;

  const removeCookies = () => {
    const host = location.hostname.split('.');
    for (const cookie of document.cookie.split('; ')) {
      const name = cookie.split('=')[0] ?? '';
      if (!/^_ga/.test(name)) continue;
      // Analytics sets its cookies on the widest domain it can: try the host and each parent domain.
      for (let i = 0; i < host.length; i += 1) {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=.${host.slice(i).join('.')}`;
      }
      document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  };

  addEventListener('vvitrine:consent', (event) => {
    const granted = (event as CustomEvent<{ granted: boolean }>).detail.granted;
    if (!granted) {
      if (loaded) gtag('consent', 'update', { analytics_storage: 'denied' });
      removeCookies();
      return;
    }
    if (loaded) {
      gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    loaded = true;
    // Consent mode: statistics only; advertising stays denied.
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
    });
    gtag('js', new Date());
    gtag('config', measurementId, {
      cookie_expires: cookieSeconds,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.append(script);
  });
}

export const ga4Script = (measurementId: string, cookieSeconds: number): string =>
  `(${vvitrineGa4.toString()})(${JSON.stringify(measurementId)}, ${cookieSeconds});`;
