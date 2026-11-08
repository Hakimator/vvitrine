import type { DataProcessing, PageContext, RenderContext, ServicePlugin } from '@vvitrine/core';
import { consentScript } from './consent.browser.ts';

export interface ConsentSettings {
  /** Path of your privacy page, linked from the banner when that page is in the footer. Default '/privacy'. */
  readonly privacyPage?: string;
}

/** What the banner component receives. */
export interface ConsentBannerProps {
  /** Target of the "Manage cookies" links. */
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly accept: string;
  readonly refuse: string;
  readonly privacy?: { readonly label: string; readonly href: string };
  /** Inline script that makes the buttons work (print it with `set:html`). */
  readonly script: string;
}

const BANNER_ID = 'vvitrine-consent';

/** Services that set cookies or similar trackers need the visitor's consent first. */
const needingConsent = (ctx: RenderContext): DataProcessing[] => ctx.dataProcessing().filter((p) => p.cookies);

/** The consent plugin, drawn with the given banner component (see index.ts). */
export function consentPlugin(Banner: unknown, settings: ConsentSettings = {}): ServicePlugin {
  const privacyPage = settings.privacyPage ?? '/privacy';
  return {
    name: '@vvitrine/consent',
    kind: 'service',
    apiVersion: 1,
    provides: ['consent'],
    messages: {
      fr: {
        'consent.title': 'Cookies et statistiques',
        'consent.text':
          'Ce site aimerait utiliser {services}, qui dépose des cookies, pour savoir quelles pages sont lues. Rien n’est chargé si vous refusez. Vous pouvez changer d’avis à tout moment depuis le pied de page.',
        'consent.accept': 'Accepter',
        'consent.refuse': 'Refuser',
        'consent.privacy': 'En savoir plus',
        'consent.manage': 'Gérer les cookies',
      },
      en: {
        'consent.title': 'Cookies and statistics',
        'consent.text':
          'This site would like to use {services}, which sets cookies, to learn which pages are read. Nothing is loaded if you refuse. You can change your mind at any time from the footer.',
        'consent.accept': 'Accept',
        'consent.refuse': 'Refuse',
        'consent.privacy': 'Learn more',
        'consent.manage': 'Manage cookies',
      },
    },
    hooks: {
      bodyEnd: (ctx: PageContext) => {
        const services = needingConsent(ctx);
        if (services.length === 0) return [];
        const names = new Intl.ListFormat(ctx.locale, { type: 'conjunction' }).format([
          ...new Set(services.map((s) => s.service)),
        ]);
        const privacy = ctx.nav.footer.find((item) => item.id === privacyPage);
        const props: ConsentBannerProps = {
          id: BANNER_ID,
          title: ctx.t('consent.title'),
          text: ctx.t('consent.text', { services: names }),
          accept: ctx.t('consent.accept'),
          refuse: ctx.t('consent.refuse'),
          ...(privacy ? { privacy: { label: ctx.t('consent.privacy'), href: privacy.href } } : {}),
          script: consentScript,
        };
        return [{ component: Banner, props: { ...props } }];
      },
      footerLinks: (ctx) =>
        needingConsent(ctx).length > 0
          ? [{ id: 'consent', label: ctx.t('consent.manage'), href: `#${BANNER_ID}` }]
          : [],
    },
  };
}
