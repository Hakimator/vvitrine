/**
 * Privacy page content, generated from what the plugins in use declare (`BasePlugin.privacy`): which services receive
 * visitor data, what, when, for how long, and whether they set cookies. Place it on a page of its own, linked from the
 * footer: `{ path: '/privacy', title: 'page.privacy', footer: true, sections: ['privacy'] }`.
 */
import { defineSection, protectEmail, type DataProcessing, type ProtectedEmail } from '@vvitrine/core';
import { z } from 'zod';

export interface PrivacyView {
  readonly title: string;
  /** One or two sentences: cookies or not, data sent to third parties or not. */
  readonly summary: string;
  readonly services: readonly (DataProcessing & { readonly linkLabel: string })[];
  readonly labels: {
    readonly purpose: string;
    readonly when: string;
    readonly data: string;
    readonly retention: string;
    readonly location: string;
    readonly cookies: string;
    readonly yes: string;
    readonly no: string;
  };
  /** The web host, which sees every visit. */
  readonly host?: { readonly text: string; readonly linkLabel: string; readonly url: string };
  /** Who is responsible and how to reach them about personal data. */
  readonly contact: { readonly text: string; readonly email?: ProtectedEmail };
  readonly rights: string;
}

export interface PrivacySettings {
  /** Your web host, e.g. { name: 'GitHub Pages', url: '<its privacy statement>' }. */
  readonly host?: { readonly name: string; readonly url: string };
}

export const privacy = (settings: PrivacySettings = {}) =>
  defineSection({
    name: '@vvitrine/section-privacy',
    kind: 'section',
    apiVersion: 1,
    id: 'privacy',
    optionsSchema: z.object({
      title: z.string().optional().describe('Heading of the section, instead of the default one.'),
    }),
    messages: {
      fr: {
        'section.privacy.title': 'Vos données personnelles',
        'section.privacy.none':
          'Ce site ne dépose aucun cookie et n’envoie aucune donnée à des services tiers pendant votre visite.',
        'section.privacy.noCookies':
          'Ce site ne dépose aucun cookie. Les services ci-dessous reçoivent des données seulement dans les cas indiqués.',
        'section.privacy.cookies':
          'Certains services ci-dessous déposent des cookies : ils ne le font qu’avec votre accord.',
        'section.privacy.purpose': 'Pourquoi',
        'section.privacy.when': 'Quand',
        'section.privacy.data': 'Données',
        'section.privacy.retention': 'Durée de conservation',
        'section.privacy.location': 'Où',
        'section.privacy.cookiesLabel': 'Cookies',
        'section.privacy.yes': 'Oui',
        'section.privacy.no': 'Non',
        'section.privacy.details': 'Conditions de {service}',
        'section.privacy.host':
          'Ce site est hébergé par {host}, qui enregistre des données techniques sur chaque visite, comme votre adresse IP, notamment pour sa sécurité.',
        'section.privacy.hostLink': 'Politique de confidentialité de {host}',
        'section.privacy.contact':
          'Responsable : {name}. Pour savoir quelles données vous concernent, les corriger ou les faire supprimer, écrivez-moi :',
        'section.privacy.contactNoEmail':
          'Responsable : {name}. Pour savoir quelles données vous concernent, les corriger ou les faire supprimer, contactez-moi par les moyens indiqués sur ce site.',
        'section.privacy.rights':
          'Vous pouvez aussi adresser une réclamation à l’autorité de protection des données de votre pays (la CNIL en France).',
      },
      en: {
        'section.privacy.title': 'Your personal data',
        'section.privacy.none': 'This site sets no cookies and sends no data to third-party services while you visit.',
        'section.privacy.noCookies':
          'This site sets no cookies. The services below receive data only in the cases described.',
        'section.privacy.cookies': 'Some services below set cookies: they only do so with your consent.',
        'section.privacy.purpose': 'Why',
        'section.privacy.when': 'When',
        'section.privacy.data': 'Data',
        'section.privacy.retention': 'Kept for',
        'section.privacy.location': 'Where',
        'section.privacy.cookiesLabel': 'Cookies',
        'section.privacy.yes': 'Yes',
        'section.privacy.no': 'No',
        'section.privacy.details': '{service} terms',
        'section.privacy.host':
          'This site is hosted by {host}, which records technical data about every visit, such as your IP address, in particular for security.',
        'section.privacy.hostLink': '{host} privacy statement',
        'section.privacy.contact':
          'Responsible: {name}. To find out which data concerns you, correct it or have it deleted, write to me:',
        'section.privacy.contactNoEmail':
          'Responsible: {name}. To find out which data concerns you, correct it or have it deleted, contact me through this site.',
        'section.privacy.rights':
          'You can also complain to the data protection authority of your country (the CNIL in France).',
      },
    },
    present: ({ basics }, options, ctx): PrivacyView => {
      const services = ctx.dataProcessing();
      const summary =
        services.length === 0
          ? ctx.t('section.privacy.none')
          : ctx.t(services.some((s) => s.cookies) ? 'section.privacy.cookies' : 'section.privacy.noCookies');
      const { host } = settings;
      return {
        title: options.title ?? ctx.t('section.privacy.title'),
        summary,
        services: services.map((s) => ({ ...s, linkLabel: ctx.t('section.privacy.details', { service: s.service }) })),
        labels: {
          purpose: ctx.t('section.privacy.purpose'),
          when: ctx.t('section.privacy.when'),
          data: ctx.t('section.privacy.data'),
          retention: ctx.t('section.privacy.retention'),
          location: ctx.t('section.privacy.location'),
          cookies: ctx.t('section.privacy.cookiesLabel'),
          yes: ctx.t('section.privacy.yes'),
          no: ctx.t('section.privacy.no'),
        },
        ...(host
          ? {
              host: {
                text: ctx.t('section.privacy.host', { host: host.name }),
                linkLabel: ctx.t('section.privacy.hostLink', { host: host.name }),
                url: host.url,
              },
            }
          : {}),
        contact: basics.email
          ? { text: ctx.t('section.privacy.contact', { name: basics.name }), email: protectEmail(basics.email) }
          : { text: ctx.t('section.privacy.contactNoEmail', { name: basics.name }) },
        rights: ctx.t('section.privacy.rights'),
      };
    },
  });
