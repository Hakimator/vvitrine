/**
 * Lays out one resume page as a tagged PDF: the reading order and the structure (headings, paragraphs, lists, links)
 * are in the file, so screen readers and text extraction get the same document as sighted readers.
 */
import { createRequire } from 'node:module';
import type PDFKitDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import type { EntriesView, GeneratorRoute, TagsView } from '@vvitrine/core';

export interface LayoutOptions {
  /** Colour of the name and the section headings. */
  readonly accent: string;
  /** Full URL of the online version, printed at the end. */
  readonly onlineUrl?: string;
  /** Label for the online version, in the page language. */
  readonly onlineLabel: string;
  /** For tests: leave the content streams uncompressed. */
  readonly compress?: boolean;
  /** Fixed creation date, so a build gives the same file. */
  readonly date: Date;
  readonly fonts: { readonly regular: string; readonly bold: string };
}

// Resolved from this package, found by name: the site's build bundles this code elsewhere, where pdfkit and the font
// (dependencies of this package only) would not be found from the bundle's own location.
const fromHere = createRequire(fileURLToPath(import.meta.resolve('@vvitrine/resume-pdf')));
const font = (file: string) => fromHere.resolve(`@fontsource/inter/files/${file}`);
// Loaded by Node at build time, not bundled: pdfkit finds its own files through its package.json.
const PDFDocument = fromHere('pdfkit') as typeof PDFKitDocument;
/** Inter (SIL Open Font License), latin subset: embedded, as PDF/UA requires. */
export const DEFAULT_FONTS = {
  regular: font('inter-latin-400-normal.woff'),
  bold: font('inter-latin-700-normal.woff'),
};

const TEXT = '#1a1a1a';
const MUTED = '#4d4d4d';
const MARGIN = 50;

/** The parts of a hero view the PDF uses (structural: no dependency on the sections package). */
interface HeroLike {
  readonly name: string;
  readonly label?: string;
  readonly summary?: string;
  readonly location?: string;
  readonly email?: { readonly href: string; readonly parts: readonly { text: string; hidden?: true }[] };
  readonly links?: readonly { label: string; url: string }[];
}
interface LanguagesLike {
  readonly title: string;
  readonly items: readonly { language: string; fluency?: string }[];
}

/** What a structure element can hold: content drawn by a callback, or other elements. */
type StructureChild = PDFKit.PDFStructureElementChild;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export function layoutResume(route: GeneratorRoute, options: LayoutOptions): Promise<Uint8Array> {
  const hero = route.sections.find((s) => s.id === 'hero' && isObject(s.view) && typeof s.view.name === 'string')
    ?.view as HeroLike | undefined;
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    pdfVersion: '1.7',
    // pdfkit supports PDF/UA since 0.16; its type definitions only list PDF/A.
    subset: 'PDF/UA' as never,
    tagged: true,
    displayTitle: true,
    lang: route.locale,
    compress: options.compress ?? true,
    info: { Title: hero ? `${hero.name} – ${route.title}` : route.title, CreationDate: options.date },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Uint8Array>((resolve) =>
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks)))),
  );

  doc.registerFont('regular', options.fonts.regular);
  doc.registerFont('bold', options.fonts.bold);
  const width = doc.page.width - 2 * MARGIN;
  // French puts a (non-breaking) space before a colon.
  const colon = route.locale.startsWith('fr') ? '\u00a0: ' : ': ';
  /** `struct(tag, children)`: a structure element without options. */
  const struct = (tag: string, children?: StructureChild | StructureChild[]) => doc.struct(tag, {}, children);
  const root = struct('Document');
  doc.addStructure(root);

  /** Starts a new page when fewer than `height` points are left, so a block is not split. */
  const keep = (height: number) => {
    if (doc.y + height > doc.page.height - MARGIN) doc.addPage();
  };
  const paragraph = (text: string, size = 10, color = TEXT) =>
    root.add(struct('P', () => doc.font('regular').fontSize(size).fillColor(color).text(text, { width })));
  const heading = (text: string) => {
    keep(60);
    doc.moveDown(0.8);
    root.add(struct('H2', () => doc.font('bold').fontSize(13).fillColor(options.accent).text(text, { width })));
    // The rule under the heading is decoration: an artifact, ignored by screen readers.
    doc.markContent('Artifact', { type: 'Layout' });
    doc
      .moveTo(MARGIN, doc.y + 2)
      .lineTo(MARGIN + width, doc.y + 2)
      .lineWidth(0.75)
      .strokeColor(options.accent)
      .stroke();
    doc.endMarkedContent();
    doc.moveDown(0.5);
  };
  const links = (items: readonly { text: string; url: string }[]) => {
    if (items.length === 0) return;
    root.add(
      struct(
        'P',
        items.map((item, i) =>
          struct('Link', () =>
            doc
              .font('regular')
              .fontSize(10)
              .fillColor(TEXT)
              .text(item.text + (i < items.length - 1 ? '   ' : ''), {
                link: item.url,
                underline: false,
                continued: i < items.length - 1,
              }),
          ),
        ),
      ),
    );
  };

  if (hero) {
    root.add(struct('H1', () => doc.font('bold').fontSize(24).fillColor(options.accent).text(hero.name, { width })));
    if (hero.label) paragraph(hero.label, 13, MUTED);
    doc.moveDown(0.3);
    if (hero.location) paragraph(hero.location, 10, MUTED);
    const contact = [
      ...(hero.email
        ? [
            {
              text: hero.email.parts
                .filter((p) => !p.hidden)
                .map((p) => p.text)
                .join(''),
              url: decodeURIComponent(hero.email.href),
            },
          ]
        : []),
      ...(hero.links ?? []).map((l) => ({
        text: l.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''),
        url: l.url,
      })),
    ];
    links(contact);
    if (hero.summary) {
      doc.moveDown(0.6);
      paragraph(hero.summary, 10.5);
    }
  }

  for (const section of route.sections) {
    const view = section.view;
    if (section.viewKind === 'entries') {
      const entries = view as EntriesView;
      if (entries.items.length === 0) continue;
      heading(entries.title);
      for (const item of entries.items) {
        keep(48);
        const title = item.subtitle ? `${item.title}, ${item.subtitle}` : item.title;
        root.add(struct('H3', () => doc.font('bold').fontSize(10.5).fillColor(TEXT).text(title, { width })));
        if (item.meta.length > 0) paragraph(item.meta.join(' · '), 9, MUTED);
        if (item.summary) paragraph(item.summary, 10);
        if (item.notes.length > 0) {
          doc.font('regular').fontSize(10).fillColor(TEXT);
          // list() tags each item as LI > (Lbl, LBody) inside the L element given as parent.
          const list = struct('L');
          root.add(list);
          doc.list([...item.notes], { width, bulletRadius: 1.5, textIndent: 10, structParent: list });
          list.end();
        }
        doc.moveDown(0.5);
      }
    } else if (section.viewKind === 'tags') {
      const tags = view as TagsView;
      if (tags.groups.length === 0) continue;
      heading(tags.title);
      for (const group of tags.groups) {
        keep(30);
        const name = group.level ? `${group.name} (${group.level})` : group.name;
        root.add(
          struct('P', () => {
            doc
              .font('bold')
              .fontSize(10)
              .fillColor(TEXT)
              .text(group.keywords.length ? `${name}${colon}` : name, {
                width,
                continued: group.keywords.length > 0,
              });
            if (group.keywords.length) doc.font('regular').text(group.keywords.join(', '));
          }),
        );
      }
    } else if (section.id === 'languages' && isObject(view) && Array.isArray(view.items)) {
      const langs = view as unknown as LanguagesLike;
      heading(langs.title);
      paragraph(langs.items.map((l) => (l.fluency ? `${l.language} (${l.fluency})` : l.language)).join(' · '));
    }
    // Other sections (quotes, figures, projects...) belong to the website, not to a printed CV.
  }

  if (options.onlineUrl) {
    keep(40);
    doc.moveDown(1.2);
    root.add(
      struct('P', [
        struct('Span', () =>
          doc.font('regular').fontSize(9).fillColor(MUTED).text(`${options.onlineLabel} `, { width, continued: true }),
        ),
        struct('Link', () => doc.text(options.onlineUrl!, { link: options.onlineUrl, underline: true })),
      ]),
    );
  }

  root.end();
  doc.end();
  return done;
}
