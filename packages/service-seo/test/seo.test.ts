import { describe, expect, it } from 'vitest';
import { createKernel } from '@vvitrine/core';
import { memorySource, stringTheme } from '@vvitrine/core/testing';
import { seo, sitemap } from '../src/index.ts';

const data = { basics: { name: 'Jane', label: 'Dev', profiles: [{ network: 'GitHub', url: 'https://github.com/j' }] } };
const build = (siteUrl?: string, base = '/', options = {}) =>
  createKernel(
    {
      site: { defaultLocale: 'fr', locales: ['fr', 'en'] },
      plugins: [memorySource({ fr: data, en: data }), stringTheme(), seo(options), sitemap()],
      pages: [{ path: '/', sections: [] }],
    },
    { root: '/', base, ...(siteUrl ? { siteUrl } : {}), logger: { info: () => {}, warn: () => {} } },
  ).build();

describe('@vvitrine/seo', () => {
  it('adds description, canonical, hreflang alternates and JSON-LD with absolute URLs', async () => {
    const site = await build('https://jane.dev', '/portfolio/');
    const en = site.routes.find((r) => r.locale === 'en')!;
    const find = (pred: (t: (typeof en.head)[number]) => boolean) => en.head.filter(pred);
    expect(find((t) => t.attrs?.name === 'description')[0]!.attrs!.content).toBe('Jane – Dev');
    expect(find((t) => t.attrs?.rel === 'canonical')[0]!.attrs!.href).toBe('https://jane.dev/portfolio/en/');
    expect(find((t) => t.attrs?.rel === 'alternate').map((t) => [t.attrs!.hreflang, t.attrs!.href])).toEqual([
      ['fr', 'https://jane.dev/portfolio/'],
      ['en', 'https://jane.dev/portfolio/en/'],
      ['x-default', 'https://jane.dev/portfolio/'],
    ]);
    const jsonLd = JSON.parse(find((t) => t.tag === 'script')[0]!.content!);
    expect(jsonLd).toMatchObject({
      '@type': 'Person',
      name: 'Jane',
      jobTitle: 'Dev',
      sameAs: ['https://github.com/j'],
    });
  });

  it('adds a share picture per language, with its text alternative', async () => {
    const site = await build('https://jane.dev', '/portfolio/', { image: '/og-{locale}.png' });
    const meta = (locale: string, key: string) =>
      site.routes.find((r) => r.locale === locale)!.head.find((t) => (t.attrs?.property ?? t.attrs?.name) === key)
        ?.attrs?.content;
    expect(meta('en', 'og:image')).toBe('https://jane.dev/portfolio/og-en.png');
    expect(meta('fr', 'og:image')).toBe('https://jane.dev/portfolio/og-fr.png');
    expect(meta('en', 'og:image:alt')).toBe('Jane – Dev');
    expect(meta('en', 'twitter:card')).toBe('summary_large_image');
    // No absolute address without the site URL: social networks would ignore a relative one.
    const local = await build(undefined, '/', { image: '/og.png' });
    expect(local.routes[0]!.head.some((t) => t.attrs?.property === 'og:image')).toBe(false);
  });

  it('omits absolute URLs when the site URL is unknown', async () => {
    const site = await build();
    expect(site.routes[0]!.head.some((t) => t.attrs?.rel === 'canonical')).toBe(false);
  });

  it('generates sitemap.xml and robots.txt that respect the base path', async () => {
    const sub = await build('https://example.github.io', '/demo/');
    expect(String(sub.files[0]!.contents)).toContain('<loc>https://example.github.io/demo/en/</loc>');
    expect(String(sub.files[1]!.contents)).toContain('Sitemap: https://example.github.io/demo/sitemap.xml');

    const site = await build('https://jane.dev');
    expect(site.files.map((f) => f.path)).toEqual(['/sitemap.xml', '/robots.txt']);
    expect(String(site.files[0]!.contents)).toContain('<loc>https://jane.dev/en/</loc>');
    expect(String(site.files[1]!.contents)).toContain('Sitemap: https://jane.dev/sitemap.xml');
    const noUrl = await build();
    expect(noUrl.files.map((f) => f.path)).toEqual(['/robots.txt']);
  });
});
