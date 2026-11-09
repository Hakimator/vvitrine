import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { InvalidPluginOptionsError, type GeneratorRoute } from '@vvitrine/core';
import type Sharp from 'sharp';
import ogImage, { card, HEIGHT, WIDTH } from '../src/index.ts';

const sharp = createRequire(import.meta.url)('sharp') as typeof Sharp;

const route = (locale: string, page = '/', hero = true): GeneratorRoute => ({
  path: locale === 'fr' ? page : `/${locale}${page}`,
  href: locale === 'fr' ? page : `/${locale}${page}`,
  page,
  locale,
  title: 'Portfolio',
  sections: hero
    ? [
        {
          id: 'hero',
          view: { name: 'Jeanne Martin', label: locale === 'fr' ? 'Ingénieure' : 'Engineer', initials: 'JM' },
        },
      ]
    : [],
});

const generate = (options = {}, routes = [route('fr'), route('en'), route('fr', '/blog')]) =>
  ogImage(options).generate({ locales: ['fr', 'en'], base: '/portfolio/', routes, siteUrl: 'https://jeanne.dev' });

/** All the strings in the card, in order. */
const texts = (node: unknown): string[] => {
  const children = (node as { props: { children?: unknown } }).props.children;
  if (typeof children === 'string') return children ? [children] : [];
  return Array.isArray(children) ? children.flatMap(texts) : [];
};

describe('@vvitrine/og-image', () => {
  it('draws one 1200 × 630 PNG per language, in the given background colour', async () => {
    const files = await generate({ background: '#102030' });
    expect(files.map((f) => f.path)).toEqual(['/og-fr.png', '/og-en.png']);
    const image = sharp(Buffer.from(files[0]!.contents as Uint8Array));
    expect(await image.metadata()).toMatchObject({ format: 'png', width: WIDTH, height: HEIGHT });
    const { data } = await image
      .extract({ left: 600, top: 10, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)]).toEqual([0x10, 0x20, 0x30]);
    // The accent band runs along the bottom edge: the card fits the picture exactly.
    const bottom = await sharp(Buffer.from(files[0]!.contents as Uint8Array))
      .extract({ left: 600, top: HEIGHT - 4, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect([...bottom.subarray(0, 3)]).toEqual([0xe0, 0xb3, 0x5c]);
  });

  it('shows the initials, name, title and site address', () => {
    const colours = { background: '#000000', color: '#ffffff', accent: '#ff0000' };
    expect(texts(card({ name: 'Jeanne Martin', label: 'Engineer', initials: 'JM' }, 'jeanne.dev', colours))).toEqual([
      'JM',
      'Jeanne Martin',
      'Engineer',
      'jeanne.dev',
    ]);
    // Without a hero, the page title is used.
    expect(texts(card({ name: 'Portfolio' }, undefined, colours))).toEqual(['P', 'Portfolio']);
  });

  it('follows the options, and explains a missing page', async () => {
    const files = await generate({ file: 'share.{locale}.png', page: '/blog' });
    expect(files.map((f) => f.path)).toEqual(['/share.fr.png']);
    await expect(generate({ page: '/about' })).rejects.toThrow('no page "/about"');
    expect(() => ogImage({ background: 'navy' })).toThrow(InvalidPluginOptionsError);
    expect(() => ogImage({ file: 'og.jpg' })).toThrow(InvalidPluginOptionsError);
  });
});
