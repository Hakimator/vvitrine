import { InvalidPluginOptionsError, toIssues, type ServicePlugin } from '@vvitrine/core';
import { z } from 'zod';
import { ga4Script } from './ga4.browser.ts';

const Options = z.object({
  /** The measurement ID of your GA4 data stream, e.g. 'G-ABC123DEF4'. */
  measurementId: z
    .string()
    .regex(/^G-[A-Z0-9]{4,}$/, { message: 'expected a GA4 measurement ID such as "G-ABC123DEF4"' }),
});

export type Ga4Options = z.input<typeof Options>;

/** The CNIL recommends that consent-based cookies last 13 months at most; 390 days stays below that. */
export const COOKIE_SECONDS = 390 * 24 * 60 * 60;

/**
 * Google Analytics 4, loaded only after the visitor accepts in the consent banner (requires `@vvitrine/consent`).
 * Advertising features stay off. See ADR-006.
 */
export function ga4(options: Ga4Options): ServicePlugin {
  const parsed = Options.safeParse(options);
  if (!parsed.success) throw new InvalidPluginOptionsError('@vvitrine/analytics ga4', toIssues(parsed.error));
  const { measurementId } = parsed.data;
  return {
    name: '@vvitrine/analytics:ga4',
    kind: 'service',
    apiVersion: 1,
    requires: ['consent'],
    messages: {
      fr: {
        'analytics.ga4.purpose': 'Mesurer l’audience : savoir quelles pages sont lues, et depuis quels pays',
        'analytics.ga4.when': 'Seulement si vous acceptez dans le bandeau des cookies',
        'analytics.ga4.data.pages': 'les pages vues et la page d’où vous venez',
        'analytics.ga4.data.device': 'le type d’appareil et de navigateur',
        'analytics.ga4.data.location':
          'une localisation approximative, déduite de votre adresse IP (qui n’est pas conservée pour les visiteurs européens)',
        'analytics.ga4.data.cookie': 'un identifiant aléatoire, dans un cookie',
        'analytics.ga4.retention':
          'Cookie : 13 mois au plus. Statistiques : selon le réglage du compte Google Analytics',
        'analytics.ga4.location': 'Google ; données des visiteurs européens collectées sur des serveurs européens',
      },
      en: {
        'analytics.ga4.purpose': 'Measuring the audience: which pages are read, and from which countries',
        'analytics.ga4.when': 'Only if you accept in the cookie banner',
        'analytics.ga4.data.pages': 'the pages you view and the page you came from',
        'analytics.ga4.data.device': 'your type of device and browser',
        'analytics.ga4.data.location':
          'an approximate location, derived from your IP address (which is not stored for European visitors)',
        'analytics.ga4.data.cookie': 'a random identifier, in a cookie',
        'analytics.ga4.retention': 'Cookie: 13 months at most. Statistics: as set in the Google Analytics account',
        'analytics.ga4.location': 'Google; data from European visitors collected on European servers',
      },
    },
    privacy: (ctx) => [
      {
        service: 'Google Analytics',
        purpose: ctx.t('analytics.ga4.purpose'),
        when: ctx.t('analytics.ga4.when'),
        data: ['pages', 'device', 'location', 'cookie'].map((key) => ctx.t(`analytics.ga4.data.${key}`)),
        retention: ctx.t('analytics.ga4.retention'),
        location: ctx.t('analytics.ga4.location'),
        cookies: true,
        url: 'https://support.google.com/analytics/answer/12017362',
      },
    ],
    hooks: {
      head: () => [{ tag: 'script', content: ga4Script(measurementId, COOKIE_SECONDS) }],
    },
  };
}
