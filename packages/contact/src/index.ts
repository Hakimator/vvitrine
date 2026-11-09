/**
 * Contact section: a plain HTML form sent through a form provider (no JavaScript, no request until the visitor
 * sends), and the owner's e-mail address as a fallback. Without a provider, only the e-mail address is shown.
 * See ADR-011.
 */
import {
  defineSection,
  protectEmail,
  type DataProcessing,
  type ProtectedEmail,
  type RenderContext,
} from '@vvitrine/core';
import { z } from 'zod';
import type { ContactProvider, HiddenField } from './provider.ts';

export type { ContactProvider, ContactRequest, HiddenField } from './provider.ts';
export { web3forms, type Web3FormsOptions } from './web3forms.ts';

export interface ContactForm {
  /** Address the form posts to (method POST). */
  readonly action: string;
  readonly hidden: readonly HiddenField[];
  /** Name of the honeypot checkbox: render it hidden from people (display: none), so only bots tick it. */
  readonly honeypot?: string;
  readonly labels: { readonly name: string; readonly email: string; readonly message: string; readonly submit: string };
  /** Shown next to the button: who receives the message, and why. */
  readonly privacy: { readonly text: string; readonly linkLabel: string; readonly url: string };
}

export interface ContactView {
  readonly title: string;
  readonly intro: string;
  /** Absent when no provider is set: show the e-mail address only. */
  readonly form?: ContactForm;
  /**
   * The owner's e-mail address (basics.email), always offered when known, protected from spam harvesters: use `href`
   * as the link and draw `parts` as its text, with the `hidden` attribute on hidden parts.
   */
  readonly email?: { readonly label: string } & ProtectedEmail;
}

/** The "message sent" page the provider sends visitors back to (component `contact:sent`). */
export interface ContactSentView {
  readonly text: string;
  readonly backLabel: string;
  readonly backHref: string;
}

export interface ContactSettings {
  /** Where messages go. Without one, the section only shows your e-mail address. */
  readonly provider?: ContactProvider;
}

const SENT_PATH = '/contact/sent';

export const contact = (settings: ContactSettings = {}) => {
  const { provider } = settings;

  const formOf = (p: ContactProvider, siteName: string, ctx: RenderContext): ContactForm => ({
    action: p.action,
    hidden: p.hiddenFields({
      subject: ctx.t('section.contact.subject', { site: siteName }),
      siteName,
      ...(ctx.siteUrl ? { thanksUrl: `${ctx.siteUrl}${ctx.url(SENT_PATH)}` } : {}),
    }),
    ...(p.honeypot ? { honeypot: p.honeypot } : {}),
    labels: {
      name: ctx.t('section.contact.name'),
      email: ctx.t('section.contact.email'),
      message: ctx.t('section.contact.message'),
      submit: ctx.t('section.contact.submit'),
    },
    privacy: {
      text: ctx.t('section.contact.privacy', { service: p.service }),
      linkLabel: ctx.t('section.contact.privacyLink', { service: p.service }),
      url: p.privacyUrl,
    },
  });

  return defineSection({
    name: '@vvitrine/section-contact',
    kind: 'section',
    apiVersion: 1,
    id: 'contact',
    optionsSchema: z.object({
      title: z.string().optional().describe('Heading of the section, instead of the default one.'),
    }),
    messages: {
      fr: {
        'section.contact.title': 'Contact',
        'section.contact.intro': 'Une question, un stage, un projet ? Écrivez-moi.',
        'section.contact.name': 'Nom',
        'section.contact.email': 'Adresse e-mail',
        'section.contact.message': 'Message',
        'section.contact.submit': 'Envoyer',
        'section.contact.subject': 'Nouveau message sur le site de {site}',
        'section.contact.privacy':
          'Votre message passe par {service}, qui me l’envoie par e-mail. Il sert uniquement à vous répondre.',
        'section.contact.privacyLink': 'Comment {service} traite vos données',
        'section.contact.orEmail': 'Vous préférez l’e-mail ?',
        'section.contact.emailOnly': 'Mon adresse e-mail :',
        'section.contact.sent': 'Message envoyé',
        'section.contact.sentText': 'Merci ! Je vous réponds dès que possible.',
        'section.contact.back': 'Retour au site',
        'section.contact.purpose': 'M’envoyer les messages du formulaire de contact, pour que je puisse vous répondre',
        'section.contact.when': 'Seulement quand vous envoyez le formulaire',
        'section.contact.data.name': 'votre nom',
        'section.contact.data.email': 'votre adresse e-mail',
        'section.contact.data.message': 'votre message',
        'section.contact.data.technical': 'des données techniques vues par le service (adresse IP, navigateur)',
        'section.contact.retention': 'Jusqu’à {duration}',
        'section.contact.country': 'Pays de l’entreprise : {country}',
      },
      en: {
        'section.contact.title': 'Contact',
        'section.contact.intro': 'A question, an internship, a project? Write to me.',
        'section.contact.name': 'Name',
        'section.contact.email': 'E-mail address',
        'section.contact.message': 'Message',
        'section.contact.submit': 'Send',
        'section.contact.subject': 'New message on the site of {site}',
        'section.contact.privacy':
          'Your message goes through {service}, which e-mails it to me. It is only used to answer you.',
        'section.contact.privacyLink': 'How {service} handles your data',
        'section.contact.orEmail': 'Prefer e-mail?',
        'section.contact.emailOnly': 'My e-mail address:',
        'section.contact.sent': 'Message sent',
        'section.contact.sentText': 'Thank you! I will answer as soon as I can.',
        'section.contact.back': 'Back to the site',
        'section.contact.purpose': 'Sending me the messages of the contact form, so that I can answer you',
        'section.contact.when': 'Only when you send the form',
        'section.contact.data.name': 'your name',
        'section.contact.data.email': 'your e-mail address',
        'section.contact.data.message': 'your message',
        'section.contact.data.technical': 'technical data the service sees (IP address, browser)',
        'section.contact.retention': 'Up to {duration}',
        'section.contact.country': 'Company based in {country}',
      },
    },
    present: ({ basics }, options, ctx): ContactView | null => {
      if (!provider && !basics.email) return null;
      return {
        title: options.title ?? ctx.t('section.contact.title'),
        intro: ctx.t('section.contact.intro'),
        ...(provider ? { form: formOf(provider, basics.name, ctx) } : {}),
        ...(basics.email
          ? {
              email: {
                label: ctx.t(provider ? 'section.contact.orEmail' : 'section.contact.emailOnly'),
                ...protectEmail(basics.email),
              },
            }
          : {}),
      };
    },
    privacy: (ctx): DataProcessing[] => {
      if (!provider) return [];
      const { country, retention } = provider.facts ?? {};
      const duration =
        retention &&
        new Intl.NumberFormat(ctx.locale, { style: 'unit', unit: retention.unit, unitDisplay: 'long' }).format(
          retention.value,
        );
      const countryName = country && new Intl.DisplayNames([ctx.locale], { type: 'region' }).of(country);
      return [
        {
          service: provider.service,
          purpose: ctx.t('section.contact.purpose'),
          when: ctx.t('section.contact.when'),
          data: ['name', 'email', 'message', 'technical'].map((key) => ctx.t(`section.contact.data.${key}`)),
          ...(duration ? { retention: ctx.t('section.contact.retention', { duration }) } : {}),
          ...(countryName ? { location: ctx.t('section.contact.country', { country: countryName }) } : {}),
          cookies: false,
          url: provider.privacyUrl,
        },
      ];
    },
    routes: (_input, ctx) => {
      if (!provider) return [];
      const heading = ctx.t('section.contact.sent');
      const view: ContactSentView = {
        text: ctx.t('section.contact.sentText'),
        backLabel: ctx.t('section.contact.back'),
        backHref: ctx.url('/'),
      };
      return [{ path: SENT_PATH, title: heading, heading, component: 'contact:sent', view }];
    },
  });
};
