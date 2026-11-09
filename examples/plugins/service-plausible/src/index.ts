/**
 * Example service plugin: Plausible Analytics, which counts visits without cookies.
 *
 * What it shows:
 * - a service adds tags to the <head> of every page (`hooks.head`);
 * - it declares the visitor data it handles (`privacy`), so the privacy page lists it; with `cookies: false`, the
 *   consent banner stays away, so there is no `requires: ['consent']`;
 * - messages in each language for those declarations.
 */
import { InvalidPluginOptionsError, toIssues, type ServicePlugin } from '@vvitrine/core';
import { z } from 'zod';

const Options = z.object({
  /** Your site as registered in Plausible, e.g. 'jane.github.io'. */
  domain: z.string().regex(/^[a-z0-9.-]+(\/[\w./-]*)?$/i, { message: 'expected a domain such as "jane.github.io"' }),
  /** The script address Plausible gives you (another one for self-hosting). Default: Plausible's own. */
  src: z.url({ protocol: /^https$/ }).default('https://plausible.io/js/script.js'),
});

export type PlausibleOptions = z.input<typeof Options>;

export default function plausible(options: PlausibleOptions): ServicePlugin {
  const parsed = Options.safeParse(options);
  if (!parsed.success) throw new InvalidPluginOptionsError('service-plausible', toIssues(parsed.error));
  const { domain, src } = parsed.data;

  return {
    name: 'example-service-plausible',
    kind: 'service',
    apiVersion: 1,
    messages: {
      fr: {
        'plausible.purpose': 'Mesurer l’audience : quelles pages sont lues, d’où viennent les visiteurs',
        'plausible.when': 'À chaque page vue',
        'plausible.data.page': 'la page vue et la page d’où vous venez',
        'plausible.data.device': 'le navigateur, le système et le type d’appareil',
        'plausible.data.location': 'le pays et la ville, déduits de votre adresse IP, qui n’est pas conservée',
        'plausible.location': 'Union européenne (entreprise basée en Estonie)',
      },
      en: {
        'plausible.purpose': 'Measuring the audience: which pages are read, where visitors come from',
        'plausible.when': 'On each page view',
        'plausible.data.page': 'the page viewed and the page you came from',
        'plausible.data.device': 'your browser, operating system and type of device',
        'plausible.data.location': 'your country and city, derived from your IP address, which is not stored',
        'plausible.location': 'European Union (company based in Estonia)',
      },
    },
    privacy: (ctx) => [
      {
        service: 'Plausible Analytics',
        purpose: ctx.t('plausible.purpose'),
        when: ctx.t('plausible.when'),
        data: ['page', 'device', 'location'].map((key) => ctx.t(`plausible.data.${key}`)),
        location: ctx.t('plausible.location'),
        // No cookie and nothing stored on the device: no consent banner (Plausible's data policy).
        cookies: false,
        url: 'https://plausible.io/data-policy',
      },
    ],
    hooks: {
      head: () => [{ tag: 'script', attrs: { defer: true, 'data-domain': domain, src } }],
    },
  };
}
