/** @jsxImportSource preact */
import { render } from 'preact';
import { studioApi } from './api.ts';
import { App } from './App.tsx';

/** The Studio's page gives its address, the token of this run and the languages; the rest comes from its API. */
async function start(root: HTMLElement): Promise<void> {
  const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? '';
  const base = meta('vvitrine-studio-base');
  const locales = meta('vvitrine-studio-locales').split(',').filter(Boolean);
  const api = studioApi(base, meta('vvitrine-studio-token'));
  const [model, layout, ...written] = await Promise.all([
    api.model(),
    api.layout(),
    ...locales.map((locale) => api.content(locale)),
  ]);
  root.replaceChildren();
  render(
    <App
      data={{
        api,
        base,
        locales,
        content: model.content,
        sections: model.sections,
        layout,
        written: Object.fromEntries(locales.map((l, i) => [l, written[i]!])),
      }}
    />,
    root,
  );
}

const root = document.getElementById('studio')!;
start(root).catch((error: Error) => {
  root.querySelector('[role="status"]')?.replaceChildren(`The Studio could not start: ${error.message}`);
});
