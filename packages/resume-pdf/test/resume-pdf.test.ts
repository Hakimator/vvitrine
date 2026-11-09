import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { InvalidPluginOptionsError, protectEmail, type GeneratorRoute } from '@vvitrine/core';
import resumePdf from '../src/index.ts';

const route = (locale: string, page = '/resume'): GeneratorRoute => ({
  path: locale === 'fr' ? page : `/${locale}${page}`,
  href: locale === 'fr' ? `/demo${page}/` : `/demo/${locale}${page}/`,
  page,
  locale,
  title: 'CV',
  sections: [
    {
      id: 'hero',
      view: {
        name: 'Jeanne Martin',
        label: 'Étudiante en ingénierie',
        location: 'Lyon, FR',
        summary: 'Passionnée par l’accessibilité.',
        email: protectEmail('jeanne@example.dev'),
        links: [{ label: 'GitHub', url: 'https://github.com/jeanne' }],
        initials: 'JM',
        actions: [],
      },
    },
    {
      id: 'work',
      viewKind: 'entries',
      view: {
        title: 'Expérience',
        items: [
          {
            title: 'Stagiaire',
            subtitle: 'Acme',
            meta: ['2025 – 2026', 'Lyon'],
            summary: 'Refonte d’une API.',
            notes: ['Tests automatisés', 'Revue de code'],
          },
        ],
      },
    },
    {
      id: 'skills',
      viewKind: 'tags',
      view: { title: 'Compétences', groups: [{ name: 'Web', keywords: ['Astro', 'TypeScript'] }] },
    },
    { id: 'languages', view: { title: 'Langues', items: [{ language: 'Anglais', fluency: 'C1' }] } },
    { id: 'testimonials', viewKind: 'quotes', view: { title: 'Avis', items: [{ quote: 'Super', author: 'X' }] } },
  ],
});

const generate = (options = {}, routes = [route('fr'), route('en'), route('fr', '/')], siteUrl?: string) =>
  resumePdf(options).generate({ locales: ['fr', 'en'], base: '/demo/', routes, ...(siteUrl ? { siteUrl } : {}) });

const read = async (bytes: Uint8Array) => {
  const pdf = await getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  const page = await pdf.getPage(1);
  const text = (await page.getTextContent()).items.map((i) => ('str' in i ? i.str : '')).join('');
  const annotations = await page.getAnnotations();
  const tree = await page.getStructTree();
  return { text, links: annotations.map((a) => a.url as string), tree, meta: await pdf.getMetadata(), pdf };
};

const roles = (node: { role: string; children?: unknown[] }): string[] => [
  node.role,
  ...((node.children ?? []) as { role?: string }[]).flatMap((c) =>
    c.role ? roles(c as { role: string; children?: unknown[] }) : [],
  ),
];

describe('@vvitrine/resume-pdf', () => {
  it('writes one A4 PDF per language of the resume page', async () => {
    const files = await generate();
    expect(files.map((f) => f.path)).toEqual(['/cv-fr.pdf', '/cv-en.pdf']);
    const { pdf } = await read(files[0]!.contents as Uint8Array);
    const [, , width, height] = (await pdf.getPage(1)).view;
    expect([Math.round(width!), Math.round(height!)]).toEqual([595, 842]);
  });

  it('prints the resume sections, the address people can use, and skips website-only sections', async () => {
    const [fr] = await generate({}, [route('fr')], 'https://jeanne.dev');
    const { text, links } = await read(fr!.contents as Uint8Array);
    for (const expected of [
      'Jeanne Martin',
      'Étudiante en ingénierie',
      'jeanne@example.dev',
      'Expérience',
      'Stagiaire, Acme',
      '2025 – 2026 · Lyon',
      'Tests automatisés',
      'Anglais (C1)',
      'Version en ligne : https://jeanne.dev/demo/resume/',
    ]) {
      expect(text).toContain(expected);
    }
    // French typography: a non-breaking space before the colon.
    expect(text).toMatch(/Web\s: Astro, TypeScript/);
    expect(text).not.toContain('nospam');
    expect(text).not.toContain('Super');
    expect(links).toEqual([
      'mailto:jeanne@example.dev',
      'https://github.com/jeanne',
      'https://jeanne.dev/demo/resume/',
    ]);
  });

  it('is tagged: language, title, and a structure tree with headings, lists and links', async () => {
    const [fr] = await generate({}, [route('fr')]);
    const bytes = fr!.contents as Uint8Array;
    const { tree, meta } = await read(bytes);
    expect((meta.info as { Title: string }).Title).toBe('Jeanne Martin – CV');
    const all = roles(tree as { role: string; children?: unknown[] });
    for (const role of ['Document', 'H1', 'H2', 'H3', 'P', 'L', 'LI', 'Lbl', 'LBody', 'Link'])
      expect(all).toContain(role);
    // List items sit inside their list.
    expect(all.join(' ')).toContain('L LI Lbl LBody LI Lbl LBody');
    const raw = Buffer.from(bytes).toString('latin1');
    expect(raw).toMatch(/\/Lang \(fr\)/);
    expect(raw).toContain('pdfuaid:part');
    // Fonts are embedded (FontFile2), not referenced.
    expect(raw).toContain('/FontFile2');
  });

  it('follows the options, and explains a missing page', async () => {
    const files = await generate({ file: 'resume.{locale}.pdf', page: '/' });
    expect(files.map((f) => f.path)).toEqual(['/resume.fr.pdf']);
    await expect(generate({ page: '/cv' })).rejects.toThrow('no page "/cv"');
    expect(() => resumePdf({ file: 'cv.docx' })).toThrow(InvalidPluginOptionsError);
  });
});
