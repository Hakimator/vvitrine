import type { RenderContext } from '@vvitrine/core';
import { Marked } from 'marked';
import { slugify } from './shared.ts';

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const unescapeHtml = (html: string) => html.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? e);

/** A heading of the write-up, for a table of contents: `<a href="#{id}">{text}</a>`. */
export interface Heading {
  readonly id: string;
  readonly text: string;
}

export interface RenderedMarkdown {
  readonly html: string;
  /** The <h2> headings (`#` in the Markdown), in order. */
  readonly headings: readonly Heading[];
}

const escape = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * Turns a Markdown write-up into HTML for a page that already has its own <h1>:
 * - headings move one level down (`#` becomes <h2>), so the page keeps a single <h1>;
 * - local links (`/docs/guide.pdf`) get the deployment base path;
 * - images go through `ctx.image()`: base path, responsive variants and real size when an image plugin is
 *   installed, and lazy loading, since a write-up starts below the fold;
 * - an image without alt text fails the build, as everywhere else in VVitrine (accessibility);
 * - code blocks and tables, which may scroll sideways on small screens, can receive keyboard focus (WCAG 2.1.1);
 * - headings get an id (unique in the page) so they can be linked to, and the <h2> ones are returned for a table
 *   of contents.
 * Raw HTML is kept: the content is the site owner's own, like the rest of the site.
 */
export function renderMarkdownDocument(
  markdown: string,
  ctx: Pick<RenderContext, 'asset' | 'image'>,
  where: string,
): RenderedMarkdown {
  const headings: Heading[] = [];
  const ids = new Set<string>();
  const uniqueId = (text: string) => {
    const base = slugify(text) || 'section';
    let id = base;
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
    ids.add(id);
    return id;
  };
  const marked = new Marked({
    gfm: true,
    async: false,
    walkTokens(token) {
      if (token.type === 'heading') token.depth = Math.min(token.depth + 1, 6);
      if (token.type === 'image' && token.text.trim() === '') {
        throw new Error(
          `${where}: the image "${token.href}" has no alt text. Write it as ![description](${token.href}).`,
        );
      }
      if (token.type === 'link' && /^\/(?!\/)/.test(token.href)) token.href = ctx.asset(token.href);
    },
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        // Plain text for the table of contents: themes escape it again when they print it.
        const text = unescapeHtml(inner.replace(/<[^>]+>/g, '')).trim();
        const id = uniqueId(text);
        if (depth === 2) headings.push({ id, text });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      image({ href, title, text }) {
        const image = ctx.image(href);
        const attributes = [
          `src="${escape(image.src)}"`,
          `alt="${escape(text)}"`,
          ...(title ? [`title="${escape(title)}"`] : []),
          ...(image.srcset ? [`srcset="${escape(image.srcset)}"`, 'sizes="(min-width: 64rem) 64rem, 100vw"'] : []),
          ...(image.width && image.height ? [`width="${image.width}"`, `height="${image.height}"`] : []),
          'loading="lazy"',
          'decoding="async"',
        ];
        return `<img ${attributes.join(' ')}>`;
      },
    },
  });
  const html = (marked.parse(markdown) as string)
    .replaceAll('<pre>', '<pre tabindex="0">')
    .replaceAll('<table>', '<table tabindex="0">');
  return { html, headings };
}

/** The HTML only, for write-ups shown without a table of contents (project pages). */
export const renderMarkdown = (markdown: string, ctx: Pick<RenderContext, 'asset' | 'image'>, where: string): string =>
  renderMarkdownDocument(markdown, ctx, where).html;
