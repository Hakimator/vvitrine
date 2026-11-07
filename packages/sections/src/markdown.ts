import { Marked } from 'marked';

/**
 * Turns a Markdown write-up into HTML for a page that already has its own <h1>:
 * - headings move one level down (`#` becomes <h2>), so the page keeps a single <h1>;
 * - local images and links (`/images/app.png`) get the deployment base path through `asset`;
 * - an image without alt text fails the build, as everywhere else in VVitrine (accessibility);
 * - code blocks and tables, which may scroll sideways on small screens, can receive keyboard focus (WCAG 2.1.1).
 * Raw HTML is kept: the content is the site owner's own, like the rest of the site.
 */
export function renderMarkdown(markdown: string, asset: (path: string) => string, where: string): string {
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
      if ((token.type === 'image' || token.type === 'link') && /^\/(?!\/)/.test(token.href)) {
        token.href = asset(token.href);
      }
    },
  });
  return (marked.parse(markdown) as string)
    .replaceAll('<pre>', '<pre tabindex="0">')
    .replaceAll('<table>', '<table tabindex="0">');
}
