import type { RenderContext } from '@vvitrine/core';
import { Marked } from 'marked';

const escape = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * Turns a Markdown write-up into HTML for a page that already has its own <h1>:
 * - headings move one level down (`#` becomes <h2>), so the page keeps a single <h1>;
 * - local links (`/docs/guide.pdf`) get the deployment base path;
 * - images go through `ctx.image()`: base path, responsive variants and real size when an image plugin is
 *   installed, and lazy loading, since a write-up starts below the fold;
 * - an image without alt text fails the build, as everywhere else in VVitrine (accessibility);
 * - code blocks and tables, which may scroll sideways on small screens, can receive keyboard focus (WCAG 2.1.1).
 * Raw HTML is kept: the content is the site owner's own, like the rest of the site.
 */
export function renderMarkdown(markdown: string, ctx: Pick<RenderContext, 'asset' | 'image'>, where: string): string {
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
  return (marked.parse(markdown) as string)
    .replaceAll('<pre>', '<pre tabindex="0">')
    .replaceAll('<table>', '<table tabindex="0">');
}
