import { defineSection } from '@vvitrine/core';

export interface HeroView {
  readonly name: string;
  readonly label?: string;
  readonly summary?: string;
  readonly location?: string;
  readonly availability?: string;
  readonly email?: string;
  readonly links: readonly { label: string; url: string }[];
}

/** Identity block. Reads `basics`, which the core owns, so it has no content key of its own. */
export const hero = () =>
  defineSection<undefined, Record<string, never>, HeroView>({
    name: '@vvitrine/section-hero',
    kind: 'section',
    apiVersion: 1,
    id: 'hero',
    present: ({ basics }) => {
      const location = [basics.location?.city, basics.location?.region, basics.location?.countryCode]
        .filter(Boolean)
        .join(', ');
      const availability = basics['x-vvitrine']?.availability;
      return {
        name: basics.name,
        ...(basics.label ? { label: basics.label } : {}),
        ...(basics.summary ? { summary: basics.summary } : {}),
        ...(location ? { location } : {}),
        ...(availability ? { availability } : {}),
        ...(basics.email ? { email: basics.email } : {}),
        links: basics.profiles.flatMap((p) => (p.url ? [{ label: p.network, url: p.url }] : [])),
      };
    },
  });
