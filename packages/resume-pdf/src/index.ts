/**
 * Resume as a PDF, generated at build time from the same data as the site: the sections placed on your resume page
 * (hero, experience, education, skills, languages...), one file per language, A4, tagged for accessibility (PDF/UA
 * identification, embedded fonts, document language, headings, lists and links in the structure tree). See ADR-014.
 */
import { InvalidPluginOptionsError, toIssues, type GeneratorPlugin } from '@vvitrine/core';
import { z } from 'zod';
import { DEFAULT_FONTS, layoutResume } from './layout.ts';

const Options = z.object({
  /** The page whose sections make the PDF, as configured in `pages`. Default '/resume'. */
  page: z.string().startsWith('/').default('/resume'),
  /** File written for each language; `{locale}` is the language. Link it with `hero` option `cv: '/cv-{locale}.pdf'`. */
  file: z
    .string()
    .regex(/^[\w{}.-]+\.pdf$/, { message: 'expected a file name ending in .pdf, e.g. "cv-{locale}.pdf"' })
    .default('cv-{locale}.pdf'),
  /** Colour of the name and headings (hex), e.g. your theme's primary colour. */
  accent: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default('#1f4e79'),
  /** Your own TrueType/OpenType/WOFF fonts, for scripts Inter's latin subset does not cover. */
  fonts: z.object({ regular: z.string(), bold: z.string() }).optional(),
  /** For tests: leave the PDF uncompressed. */
  compress: z.boolean().default(true),
});

export type ResumePdfOptions = z.input<typeof Options>;

const ONLINE = { fr: 'Version en ligne :', en: 'Online version:' } as Record<string, string>;

export default function resumePdf(options: ResumePdfOptions = {}): GeneratorPlugin {
  const parsed = Options.safeParse(options);
  if (!parsed.success) throw new InvalidPluginOptionsError('@vvitrine/resume-pdf', toIssues(parsed.error));
  const { page, file, accent, fonts, compress } = parsed.data;

  return {
    name: '@vvitrine/resume-pdf',
    kind: 'generator',
    apiVersion: 1,
    async generate({ routes, siteUrl }) {
      const pages = routes.filter((route) => route.page === page);
      if (pages.length === 0) {
        throw new Error(`@vvitrine/resume-pdf: no page "${page}". Add it to "pages", or set the "page" option.`);
      }
      const date = new Date();
      return Promise.all(
        pages.map(async (route) => ({
          path: `/${file.replaceAll('{locale}', route.locale)}`,
          contents: await layoutResume(route, {
            accent,
            onlineLabel: ONLINE[route.locale] ?? ONLINE.en!,
            ...(siteUrl ? { onlineUrl: `${siteUrl}${route.href}` } : {}),
            compress,
            date,
            fonts: fonts ?? DEFAULT_FONTS,
          }),
        })),
      );
    },
  };
}
