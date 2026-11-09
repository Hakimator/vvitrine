/**
 * Example generator plugin: a contact card (`contact.vcf`, vCard 4.0, RFC 6350) that phones and address books import
 * in one tap. Link it from your site, for example in a profile link or the contact section text.
 *
 * What it shows:
 * - a generator writes files at build time from what the pages show (`routes[].sections[].view`), without knowing
 *   the section plugins: here, the hero of the home page;
 * - it reads the protected e-mail address (`ProtectedEmail`) back into a plain one, since a vCard is made to be read.
 */
import { InvalidPluginOptionsError, toIssues, type GeneratorPlugin, type GeneratorRoute } from '@vvitrine/core';
import { z } from 'zod';

const Options = z.object({
  /** File name, written at the site root. Default 'contact.vcf'. */
  file: z
    .string()
    .regex(/^[\w.-]+\.vcf$/, { message: 'expected a file name ending in .vcf' })
    .default('contact.vcf'),
  /** The page whose hero gives the details, in the default language. Default '/'. */
  page: z.string().startsWith('/').default('/'),
});

export type VCardOptions = z.input<typeof Options>;

interface HeroLike {
  name: string;
  label?: string;
  email?: { href: string };
  links?: readonly { label: string; url: string }[];
}

/** Escapes a text value (RFC 6350, section 3.4). */
const escape = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r?\n/g, '\\n');

/** Folds a line longer than 75 octets: the rest goes on lines starting with a space (section 3.2). */
export function fold(line: string): string {
  const bytes = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes.encode(current + char).length > limit) {
      parts.push(current);
      current = '';
    }
    current += char;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function vcard(hero: HeroLike, siteUrl?: string): string {
  const words = hero.name.trim().split(/\s+/);
  const family = words.length > 1 ? words.at(-1)! : '';
  const given = words.length > 1 ? words.slice(0, -1).join(' ') : words[0]!;
  const lines = [
    'BEGIN:VCARD',
    'VERSION:4.0',
    `FN:${escape(hero.name)}`,
    `N:${escape(family)};${escape(given)};;;`,
    ...(hero.label ? [`TITLE:${escape(hero.label)}`] : []),
    ...(hero.email ? [`EMAIL:${decodeURIComponent(hero.email.href).replace(/^mailto:/, '')}`] : []),
    ...(siteUrl ? [`URL:${siteUrl}`] : []),
    ...(hero.links ?? []).map((link) => `URL;TYPE=${escape(link.label.toLowerCase())}:${link.url}`),
    'END:VCARD',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

export default function vcardGenerator(options: VCardOptions = {}): GeneratorPlugin {
  const parsed = Options.safeParse(options);
  if (!parsed.success) throw new InvalidPluginOptionsError('generator-vcard', toIssues(parsed.error));
  const { file, page } = parsed.data;

  return {
    name: 'example-generator-vcard',
    kind: 'generator',
    apiVersion: 1,
    async generate({ routes, locales, siteUrl, base }) {
      // The default language is the first one; its page has the details as you wrote them.
      const route = routes.find((r: GeneratorRoute) => r.page === page && r.locale === locales[0]);
      const hero = route?.sections.find((s) => s.id === 'hero')?.view as HeroLike | undefined;
      if (typeof hero?.name !== 'string') {
        throw new Error(`generator-vcard: no hero on the page "${page}". Set the "page" option.`);
      }
      return [{ path: `/${file}`, contents: vcard(hero, siteUrl && `${siteUrl}${base}`) }];
    },
  };
}
