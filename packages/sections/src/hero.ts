import { defineSection } from '@vvitrine/core';
import { z } from 'zod';

export interface HeroAction {
  readonly id: 'cv' | 'contact';
  readonly label: string;
  readonly href: string;
  /** True for a file the browser should download (same-origin files only). */
  readonly download?: boolean;
}

export interface HeroView {
  readonly name: string;
  readonly label?: string;
  readonly summary?: string;
  readonly location?: string;
  readonly availability?: string;
  readonly email?: string;
  /** `basics.image`, resolved with the base path. */
  readonly photo?: { readonly src: string; readonly alt: string };
  /** Shown instead of the photo when there is none, e.g. "JM". */
  readonly initials: string;
  /** Calls to action, most important first: download the CV, then contact. */
  readonly actions: readonly HeroAction[];
  readonly links: readonly { label: string; url: string }[];
}

export const HeroOptions = z.object({
  /** CV file in public/ (e.g. '/cv.pdf') or a full URL. Adds a "Download CV" button. */
  cv: z.string().min(1).optional(),
  /** Target of the "Contact me" button. Defaults to a mailto: link to basics.email. */
  contact: z.string().min(1).optional(),
});
export type HeroOptions = z.infer<typeof HeroOptions>;

const isFullUrl = (value: string) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(value);

/** First letters of the first and last words: "Jeanne Martin" -> "JM", "Ada" -> "A". */
export function initialsOf(name: string, locale?: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return [first, last]
    .map((word) => (word ? Array.from(word)[0] : ''))
    .join('')
    .toLocaleUpperCase(locale);
}

/** Identity block. Reads `basics`, which the core owns, so it has no content key of its own. */
export const hero = () =>
  defineSection<undefined, HeroOptions, HeroView>({
    name: '@vvitrine/section-hero',
    kind: 'section',
    apiVersion: 1,
    id: 'hero',
    optionsSchema: HeroOptions,
    messages: {
      fr: {
        'section.hero.cv': 'Télécharger le CV (PDF)',
        'section.hero.contact': 'Me contacter',
        'section.hero.photoAlt': 'Photo de {name}',
      },
      en: {
        'section.hero.cv': 'Download CV (PDF)',
        'section.hero.contact': 'Contact me',
        'section.hero.photoAlt': 'Photo of {name}',
      },
    },
    present: ({ basics }, options, ctx) => {
      const location = [basics.location?.city, basics.location?.region, basics.location?.countryCode]
        .filter(Boolean)
        .join(', ');
      const availability = basics['x-vvitrine']?.availability;
      const actions: HeroAction[] = [];
      if (options.cv) {
        actions.push({
          id: 'cv',
          label: ctx.t('section.hero.cv'),
          href: ctx.asset(options.cv),
          ...(isFullUrl(options.cv) ? {} : { download: true }),
        });
      }
      const contact = options.contact ?? (basics.email ? `mailto:${basics.email}` : undefined);
      if (contact) actions.push({ id: 'contact', label: ctx.t('section.hero.contact'), href: contact });

      return {
        name: basics.name,
        ...(basics.label ? { label: basics.label } : {}),
        ...(basics.summary ? { summary: basics.summary } : {}),
        ...(location ? { location } : {}),
        ...(availability ? { availability } : {}),
        ...(basics.email ? { email: basics.email } : {}),
        ...(basics.image
          ? { photo: { src: ctx.asset(basics.image), alt: ctx.t('section.hero.photoAlt', { name: basics.name }) } }
          : {}),
        initials: initialsOf(basics.name, ctx.locale),
        actions,
        links: basics.profiles.flatMap((p) => (p.url ? [{ label: p.network, url: p.url }] : [])),
      };
    },
  });
