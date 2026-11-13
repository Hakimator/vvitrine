import type { EditingModel, Locale, WrittenContent } from '@vvitrine/core';
import { describeContent } from '@vvitrine/studio-core';

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * The Studio's page. For now, what it will edit: the languages and every content key, with its file and whether it
 * can be saved. The editing interface (US-134 and after) replaces the list, on the same page and with the same token.
 */
export function studioPage(input: {
  token: string;
  nonce: string;
  locales: readonly Locale[];
  model: EditingModel;
  written: WrittenContent;
}): string {
  const { token, nonce, locales, model, written } = input;
  const rows = model.content
    .map((content) => {
      const form = describeContent(content);
      const origin = written.origin[content.key];
      const readOnly = written.readOnly.includes(content.key);
      const state = origin === undefined ? 'no content yet' : readOnly ? `${origin} (read-only)` : origin;
      return `<tr><th scope="row">${escape(form.label)}</th><td><code>${escape(content.key)}</code></td><td>${escape(state)}</td></tr>`;
    })
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="vvitrine-studio-token" content="${escape(token)}">
<title>VVitrine Studio</title>
<style nonce="${escape(nonce)}">
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.5; }
  body { margin: 0 auto; max-width: 60rem; padding: 1.5rem 1rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid color-mix(in srgb, currentColor 25%, transparent); padding: 0.5rem; text-align: left; }
  code { overflow-wrap: anywhere; }
</style>
</head>
<body>
<main>
<h1>VVitrine Studio</h1>
<p>Languages: ${locales.map((locale) => `<code>${escape(locale)}</code>`).join(', ')}. The editing screens come next; this page lists what they will edit.</p>
<table>
<caption>Content of the site, in the default language</caption>
<thead><tr><th scope="col">Content</th><th scope="col">Key</th><th scope="col">File</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</main>
</body>
</html>
`;
}
