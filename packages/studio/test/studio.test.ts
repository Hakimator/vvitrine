import { createKernel, defineSection, type Plugin } from '@vvitrine/core';
import { memoryFiles, stringTheme } from '@vvitrine/core/testing';
import yamlSource from '@vvitrine/source-yaml';
import { describe, expect, it } from 'vitest';
import studio, { STUDIO_PATH, TOKEN_HEADER } from '../src/index.ts';

const resume = '# Mine\nbasics:\n  name: Jane Doe\n';
const site = (...plugins: Plugin[]) => {
  const files = memoryFiles({ 'content/resume.yaml': resume });
  const kernel = createKernel(
    {
      plugins: [yamlSource({ dir: 'content', file: 'resume' }), stringTheme({}, ''), ...plugins],
      site: { defaultLocale: 'en', locales: ['en', 'fr'] },
    },
    { root: '/', logger: { info: () => {}, warn: () => {} }, files },
  );
  return { kernel, files };
};
const ask = (kernel: ReturnType<typeof site>['kernel'], path: string, init: RequestInit = {}) =>
  kernel.handleDevRequest(new Request(`http://localhost:4321${path}`, init)) as Promise<Response>;

/** Open the Studio page like a person would, and keep its token. */
async function open(kernel: ReturnType<typeof site>['kernel']) {
  const page = await ask(kernel, STUDIO_PATH);
  const html = await page.text();
  const token = /name="vvitrine-studio-token" content="([0-9a-f]+)"/.exec(html)![1]!;
  const call = (name: string, init: RequestInit = {}) =>
    ask(kernel, `${STUDIO_PATH}api/${name}`, { ...init, headers: { [TOKEN_HEADER]: token, ...init.headers } });
  return { page, html, token, call };
}

describe('the local Studio (US-133)', () => {
  it('serves its page with the token of this run, safely', async () => {
    const { kernel } = site(studio());
    const { page, html, token } = await open(kernel);
    expect(page.status).toBe(200);
    expect(token).toHaveLength(64);
    expect(page.headers.get('cache-control')).toBe('no-store');
    const csp = page.headers.get('content-security-policy')!;
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe');
    // The page lists what can be edited, with each key's file.
    expect(html).toContain('<th scope="row">Basics</th><td><code>basics</code></td><td>content/resume.yaml</td>');
    // The token is the same for the whole run, and differs from one run to the next.
    expect((await open(kernel)).token).toBe(token);
    expect((await open(site(studio()).kernel)).token).not.toBe(token);
  });

  it('refuses its API without the token of this run', async () => {
    const { kernel } = site(studio());
    const attempts: Record<string, string>[] = [{}, { [TOKEN_HEADER]: 'guess' }, { [TOKEN_HEADER]: '0'.repeat(64) }];
    for (const headers of attempts) {
      const response = await ask(kernel, `${STUDIO_PATH}api/content`, { headers });
      expect(response.status).toBe(403);
    }
  });

  it('gives the editing model and the content, checks it, and saves changes in place', async () => {
    const { kernel, files } = site(studio());
    const { call } = await open(kernel);
    expect((await (await call('model')).json()).content[0].key).toBe('basics');
    const written = await (await call('content?locale=en')).json();
    expect(written).toEqual({
      content: { basics: { name: 'Jane Doe' } },
      origin: { basics: 'content/resume.yaml' },
      readOnly: [],
    });

    const check = (content: unknown) =>
      call('check', { method: 'POST', body: JSON.stringify({ locale: 'en', content }) }).then((r) => r.json());
    expect(await check({ basics: { name: 'Ada' } })).toEqual({ issues: [] });
    expect((await check({ basics: { name: 42 } })).issues[0]).toMatchObject({ at: ['basics', 'name'] });

    const changes = [{ op: 'set', path: ['basics', 'name'], value: 'Ada Lovelace' }];
    const saved = await call('save', { method: 'POST', body: JSON.stringify({ locale: 'en', changes }) });
    expect(await saved.json()).toEqual({ files: ['content/resume.yaml'] });
    expect(files.snapshot()['content/resume.yaml']).toBe('# Mine\nbasics:\n  name: Ada Lovelace\n');
  });

  it('answers clearly what it cannot do', async () => {
    const { kernel } = site(studio());
    const { call } = await open(kernel);
    const status = async (response: Promise<Response>) => {
      const r = await response;
      return [r.status, ((await r.json()) as { error: string }).error];
    };
    expect(await status(call('content?locale=de'))).toEqual([400, 'Unknown language "de".']);
    expect(await status(call('save', { method: 'POST', body: '{' }))).toEqual([400, expect.any(String)]);
    expect(await status(call('save', { method: 'POST', body: '{}' }))).toEqual([400, 'Send { locale, changes }.']);
    expect(await status(call('check', { method: 'POST', body: '{}' }))).toEqual([400, 'Send { locale, content }.']);
    expect(await status(call('model', { method: 'POST' }))).toEqual([405, 'Use GET.']);
    // An invalid change is refused by the kernel, with its message, and nothing is written.
    const invalid = JSON.stringify({ locale: 'en', changes: [{ op: 'set', path: ['basics', 'name'], value: 1 }] });
    expect(await status(call('save', { method: 'POST', body: invalid }))).toEqual([
      422,
      expect.stringContaining('basics.name'),
    ]);
    expect(await status(ask(kernel, `${STUDIO_PATH}elsewhere`))).toEqual([404, 'No such Studio page.']);
    expect(await status(ask(kernel, STUDIO_PATH, { method: 'POST' }))).toEqual([
      405,
      'The Studio page answers GET only.',
    ]);
  });

  it('gives the layout, checks it and saves changes to it (US-135)', async () => {
    const saved: unknown[] = [];
    const layout = { pages: [{ path: '/', sections: ['hero'] }] };
    const hero = defineSection({ name: 'hero', kind: 'section', apiVersion: 1, id: 'hero', present: () => ({}) });
    const kernel = createKernel(
      { plugins: [stringTheme({}, ''), hero, studio()] },
      {
        root: '/',
        logger: { info: () => {}, warn: () => {} },
        layout: { data: layout, origin: 'site.yaml' },
        layoutWriter: { save: async (changes) => void saved.push(changes) },
      },
    );
    const { call } = await open(kernel);
    const post = (name: string, body: unknown) => call(name, { method: 'POST', body: JSON.stringify(body) });
    expect(await (await call('layout')).json()).toMatchObject({ layout, origin: 'site.yaml', pages: layout.pages });
    expect(await (await post('check-layout', { layout })).json()).toEqual({ issues: [] });
    const unknown = await (await post('check-layout', { layout: { pages: [{ path: '/', sections: ['x'] }] } })).json();
    expect(unknown.issues[0]).toMatchObject({ at: ['pages', 0, 'sections', 0] });

    const refused = await post('save-layout', {
      changes: [{ op: 'insert', path: ['pages', 0, 'sections'], index: 0, value: 'x' }],
    });
    expect([refused.status, saved]).toEqual([422, []]);
    const hide = { op: 'set', path: ['pages', 0, 'sections', 0], value: { id: 'hero', hidden: true } };
    expect(await (await post('save-layout', { changes: [hide] })).json()).toEqual({ files: ['site.yaml'] });
    expect(saved).toEqual([[hide]]);
    expect((await post('save-layout', {})).status).toBe(400);
    expect((await post('check-layout', { layout: [] })).status).toBe(400);
  });

  it('is gone with the plugin: no Studio route without studio()', async () => {
    expect(await site().kernel.handleDevRequest(new Request(`http://localhost:4321${STUDIO_PATH}`))).toBeUndefined();
  });
});
