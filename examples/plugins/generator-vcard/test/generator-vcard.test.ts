import { describe, expect, it } from 'vitest';
import { InvalidPluginOptionsError, protectEmail, type GeneratorRoute } from '@vvitrine/core';
import vcardGenerator, { fold, vcard } from '../src/index.ts';

const hero = {
  name: 'Jeanne Marie Martin',
  label: 'Engineer, accessibility; web',
  email: protectEmail('jeanne@example.dev'),
  links: [{ label: 'GitHub', url: 'https://github.com/jeanne' }],
};
const route = (locale: string, page = '/'): GeneratorRoute => ({
  path: page,
  href: page,
  page,
  locale,
  title: 'Home',
  sections: [{ id: 'hero', view: { ...hero, label: locale === 'fr' ? 'Ingénieure' : hero.label } }],
});

describe('example generator-vcard', () => {
  it('writes an RFC 6350 card from the hero of the home page, in the default language', async () => {
    const [file] = await vcardGenerator().generate({
      locales: ['en', 'fr'],
      base: '/portfolio/',
      siteUrl: 'https://jeanne.dev',
      routes: [route('fr'), route('en'), route('en', '/blog')],
    });
    expect(file!.path).toBe('/contact.vcf');
    expect(String(file!.contents).split('\r\n')).toEqual([
      'BEGIN:VCARD',
      'VERSION:4.0',
      'FN:Jeanne Marie Martin',
      'N:Martin;Jeanne Marie;;;',
      'TITLE:Engineer\\, accessibility\\; web',
      'EMAIL:jeanne@example.dev',
      'URL:https://jeanne.dev/portfolio/',
      'URL;TYPE=github:https://github.com/jeanne',
      'END:VCARD',
      '',
    ]);
  });

  it('folds long lines at 75 octets, counting accented letters as two', () => {
    const line = `NOTE:${'é'.repeat(60)}`;
    const folded = fold(line).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    for (const part of folded) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.map((part, i) => (i === 0 ? part : part.slice(1))).join('')).toBe(line);
    expect(vcard({ name: 'Cher' })).toContain('N:;Cher;;;');
  });

  it('follows its options, and explains a page without a hero', async () => {
    const ctx = { locales: ['en'], base: '/', routes: [route('en')] };
    expect((await vcardGenerator({ file: 'jeanne.vcf' }).generate(ctx))[0]!.path).toBe('/jeanne.vcf');
    await expect(vcardGenerator({ page: '/blog' }).generate(ctx)).rejects.toThrow('no hero on the page "/blog"');
    expect(() => vcardGenerator({ file: 'card.txt' })).toThrow(InvalidPluginOptionsError);
  });
});
