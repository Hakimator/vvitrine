import type { EditingModel, Locale, WrittenContent } from '@vvitrine/core';
import { describeContent } from '@vvitrine/studio-core';

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * The Studio's page: the address, token and languages for the app, the app's script, and the styles (the only
 * ones the security policy allows). Before the app starts, and without JavaScript, it lists what can be edited.
 */
export function studioPage(input: {
  token: string;
  nonce: string;
  base: string;
  scripts: readonly string[];
  locales: readonly Locale[];
  model: EditingModel;
  written: WrittenContent;
}): string {
  const { token, nonce, base, scripts, locales, model, written } = input;
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
<meta name="vvitrine-studio-base" content="${escape(base)}">
<meta name="vvitrine-studio-locales" content="${escape(locales.join(','))}">
<title>VVitrine Studio</title>
<style nonce="${escape(nonce)}">${STYLES}</style>
${scripts.map((src) => `<script type="module" src="${escape(src)}"></script>`).join('\n')}
</head>
<body>
<div id="studio">
<main>
<h1>VVitrine Studio</h1>
<p role="status">Loading the Studio… It needs JavaScript. Meanwhile, here is what it edits.</p>
<p>Languages: ${locales.map((locale) => `<code>${escape(locale)}</code>`).join(', ')}.</p>
<table>
<caption>Content of the site, in the default language</caption>
<thead><tr><th scope="col">Content</th><th scope="col">Key</th><th scope="col">File</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</main>
</div>
</body>
</html>
`;
}

/** The Studio's look: plain, readable, keyboard-friendly; light and dark from the system. */
const STYLES = `
:root { color-scheme: light dark; --accent: #1f5fbf; --danger: #b3261e; --warn: #8a5a00; --line: color-mix(in srgb, currentColor 22%, transparent);
  font-family: system-ui, sans-serif; line-height: 1.5; }
@media (prefers-color-scheme: dark) { :root { --accent: #8ab4f8; --danger: #f2b8b5; --warn: #f0c36d; } }
body { margin: 0; }
table { border-collapse: collapse; width: 100%; }
th, td { border-bottom: 1px solid var(--line); padding: 0.5rem; text-align: left; }
code { overflow-wrap: anywhere; }
#studio > main { margin: 0 auto; max-width: 60rem; padding: 1.5rem 1rem; }
.studio { display: grid; grid-template-columns: minmax(10rem, 14rem) 1fr; grid-template-areas: "bar bar" "nav main"; min-height: 100vh; }
.bar { grid-area: bar; display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; align-items: center; padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--line); position: sticky; top: 0; background: Canvas; z-index: 1; }
.bar h1 { font-size: 1.15rem; margin: 0; }
.actions { display: flex; gap: 0.5rem; }
.status { margin: 0; min-height: 1.5em; }
nav { grid-area: nav; border-right: 1px solid var(--line); padding: 0.5rem; }
nav ul { list-style: none; margin: 0; padding: 0; }
nav button { width: 100%; text-align: left; border: 0; background: none; padding: 0.4rem 0.6rem; border-radius: 0.3rem; }
nav button[aria-current] { background: color-mix(in srgb, var(--accent) 18%, transparent); font-weight: 600; }
main { grid-area: main; padding: 1rem 1.5rem; min-width: 0; }
.languages { display: grid; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 1.5rem; }
.languages h3 { margin-top: 0; }
.file { font-weight: normal; font-size: 0.85em; }
button { font: inherit; padding: 0.35rem 0.8rem; border: 1px solid var(--line); border-radius: 0.3rem; background: Canvas; color: CanvasText; cursor: pointer; }
button.primary { background: var(--accent); color: Canvas; border-color: var(--accent); }
button.quiet { font-size: 0.85em; margin: 0.25rem 0 0.75rem; }
button:disabled { opacity: 0.5; cursor: default; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.group { border: 1px solid var(--line); border-radius: 0.4rem; margin: 0 0 1rem; padding: 0.5rem 0.75rem 0.75rem; min-width: 0; }
.group legend { font-weight: 600; padding: 0 0.3rem; }
.group ol { padding-left: 1.25rem; }
.field { margin: 0 0 0.9rem; }
.field label { display: block; font-weight: 600; }
.field input:not([type="checkbox"]), .field textarea, .field select { box-sizing: border-box; width: 100%; font: inherit; padding: 0.35rem 0.5rem;
  border: 1px solid var(--line); border-radius: 0.3rem; background: Canvas; color: CanvasText; }
.field [aria-invalid="true"] { border-color: var(--danger); border-width: 2px; }
.field.markdown textarea { font-family: ui-monospace, monospace; }
.help { margin: 0.1rem 0 0.3rem; font-size: 0.9em; opacity: 0.85; }
.required { font-weight: normal; font-size: 0.85em; }
.missing { color: var(--warn); font-size: 0.9em; margin: 0.25rem 0 0; }
.issues { color: var(--danger); font-size: 0.9em; margin: 0.25rem 0 0; padding-left: 1.1rem; }
.note { padding: 0.5rem 0.75rem; border-left: 4px solid var(--warn); }
.raw { overflow: auto; padding: 0.5rem; border: 1px dashed var(--line); }
.flag { color: var(--danger); font-size: 0.85em; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 40rem) {
  .studio { grid-template-columns: 1fr; grid-template-areas: "bar" "nav" "main"; }
  nav { border-right: 0; border-bottom: 1px solid var(--line); }
  nav ul { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  nav button { width: auto; }
}
`;
