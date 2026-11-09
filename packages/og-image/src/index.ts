/**
 * Open Graph picture (1200 × 630 PNG), one per language, drawn at build time from the hero of the home page: initials,
 * name, title and the site address. Link it with `seo({ image: '/og-{locale}.png' })`.
 *
 * satori lays the card out and turns its text into vector paths (with the embedded Inter font, so the result does not
 * depend on the fonts of the build machine); sharp turns that SVG into a PNG.
 */
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { InvalidPluginOptionsError, toIssues, type GeneratorPlugin, type GeneratorRoute } from '@vvitrine/core';
import type Satori from 'satori';
import type Sharp from 'sharp';
import { z } from 'zod';

// Loaded from this package by Node at build time: the site's build bundles this code elsewhere, where these
// dependencies (and satori's layout engine, sharp's native library) would not be found.
const fromHere = createRequire(fileURLToPath(import.meta.resolve('@vvitrine/og-image')));
const satori = (fromHere('satori') as { default: typeof Satori }).default;
const sharp = fromHere('sharp') as typeof Sharp;

const Colour = z.string().regex(/^#[0-9a-f]{6}$/i, { message: 'expected a hex colour such as "#1f3a5f"' });
const Options = z.object({
  /** The page whose hero gives the name and title. Default '/'. */
  page: z.string().startsWith('/').default('/'),
  /** File written for each language; `{locale}` is the language. Default 'og-{locale}.png'. */
  file: z
    .string()
    .regex(/^[\w{}.-]+\.png$/, { message: 'expected a file name ending in .png, e.g. "og-{locale}.png"' })
    .default('og-{locale}.png'),
  /** Background, text and decoration colours: use your theme's, with enough contrast between them. */
  background: Colour.default('#1f3a5f'),
  color: Colour.default('#ffffff'),
  accent: Colour.default('#e0b35c'),
});

export type OgImageOptions = z.input<typeof Options>;

export const WIDTH = 1200;
export const HEIGHT = 630;

interface HeroLike {
  readonly name: string;
  readonly label?: string;
  readonly initials?: string;
}

const fontFile = (file: string) => readFile(fromHere.resolve(`@fontsource/inter/files/${file}`));
type Node = { type: string; props: { style: Record<string, unknown>; children?: unknown } };
const el = (style: Record<string, unknown>, children?: unknown): Node => ({ type: 'div', props: { style, children } });

/** The card, as satori elements (a small subset of HTML and CSS: flexbox only). */
export function card(
  hero: HeroLike,
  address: string | undefined,
  colours: { background: string; color: string; accent: string },
) {
  return el(
    {
      width: '100%',
      height: '100%',
      // Padding and border inside the 1200 × 630 box, not added to it.
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '72px 80px',
      background: colours.background,
      color: colours.color,
      fontFamily: 'Inter',
      borderBottom: `16px solid ${colours.accent}`,
    },
    [
      el(
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 136,
          height: 136,
          borderRadius: 68,
          background: colours.color,
          color: colours.background,
          fontSize: 54,
          fontWeight: 700,
        },
        hero.initials ?? hero.name.slice(0, 1),
      ),
      el({ display: 'flex', flexDirection: 'column' }, [
        el({ fontSize: hero.name.length > 22 ? 60 : 76, fontWeight: 700, lineHeight: 1.1 }, hero.name),
        ...(hero.label ? [el({ fontSize: 36, marginTop: 16, opacity: 0.88 }, hero.label)] : []),
      ]),
      el({ fontSize: 28, opacity: 0.8, minHeight: 34 }, address ?? ''),
    ],
  );
}

export default function ogImage(options: OgImageOptions = {}): GeneratorPlugin {
  const parsed = Options.safeParse(options);
  if (!parsed.success) throw new InvalidPluginOptionsError('@vvitrine/og-image', toIssues(parsed.error));
  const { page, file, ...colours } = parsed.data;

  return {
    name: '@vvitrine/og-image',
    kind: 'generator',
    apiVersion: 1,
    async generate({ routes, siteUrl, base }) {
      const pages = routes.filter((route) => route.page === page);
      if (pages.length === 0) {
        throw new Error(`@vvitrine/og-image: no page "${page}". Set the "page" option to a page with a hero.`);
      }
      const fonts = [
        {
          name: 'Inter',
          weight: 400 as const,
          style: 'normal' as const,
          data: await fontFile('inter-latin-400-normal.woff'),
        },
        {
          name: 'Inter',
          weight: 700 as const,
          style: 'normal' as const,
          data: await fontFile('inter-latin-700-normal.woff'),
        },
      ];
      // e.g. 'jeanne.github.io/portfolio'
      const address = siteUrl && `${siteUrl}${base}`.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return Promise.all(
        pages.map(async (route) => {
          const svg = await satori(card(heroOf(route), address, colours) as never, {
            width: WIDTH,
            height: HEIGHT,
            fonts,
          });
          return {
            path: `/${file.replaceAll('{locale}', route.locale)}`,
            contents: new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer()),
          };
        }),
      );
    },
  };
}

/** The hero of the page, or the page title when there is none. */
function heroOf(route: GeneratorRoute): HeroLike {
  const hero = route.sections.find((s) => s.id === 'hero')?.view as Partial<HeroLike> | undefined;
  return typeof hero?.name === 'string' ? (hero as HeroLike) : { name: route.title };
}
