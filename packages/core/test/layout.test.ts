import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  createKernel,
  defineSection,
  InvalidChangeError,
  InvalidConfigError,
  type ContentChange,
  type LayoutWriter,
  type VVitrineConfig,
} from '../src/index.ts';
import { memorySource, stringTheme } from '../src/testing.ts';

const silent = { info: () => {}, warn: () => {} };

const work = defineSection({
  name: 'section-work',
  kind: 'section',
  apiVersion: 1,
  id: 'work',
  content: { key: 'work', schema: z.array(z.object({ name: z.string() })).default([]) },
  optionsSchema: z.object({ limit: z.number().int().positive().default(10) }),
  messages: { en: { 'section.work.title': 'Experience' }, fr: { 'section.work.title': 'Expérience' } },
  present: ({ content }, _options, { t }) => ({ title: t('section.work.title'), items: content }),
});

const hero = defineSection({
  name: 'section-hero',
  kind: 'section',
  apiVersion: 1,
  id: 'hero',
  present: ({ basics }) => ({ name: basics.name }),
});

const config: VVitrineConfig = {
  plugins: [memorySource({ basics: { name: 'Jane Doe' } }), stringTheme({ hero: 'Hero', work: 'Work' }), hero, work],
};

const layout = {
  site: { defaultLocale: 'en', locales: ['en', 'fr'] },
  pages: [
    { path: '/', sections: ['hero', { id: 'work', options: { limit: 2 } }] },
    { path: '/cv', title: 'page.cv', sections: ['work'] },
  ],
  messages: { en: { 'page.cv': 'Resume' }, fr: { 'page.cv': 'CV' } },
};

function kernel(options: { data?: unknown; writer?: LayoutWriter; config?: VVitrineConfig } = {}) {
  return createKernel(options.config ?? config, {
    root: '/',
    logger: silent,
    layout: { data: options.data ?? layout, origin: 'site.yaml' },
    ...(options.writer ? { layoutWriter: options.writer } : {}),
  });
}

const writer = () => {
  const saved: ContentChange[][] = [];
  return { saved, writer: { save: vi.fn(async (changes: readonly ContentChange[]) => void saved.push([...changes])) } };
};

describe('reading the layout (US-135)', () => {
  it('gives the layout file as written, the pages and their titles, and the titles of sections', () => {
    const site = kernel({ writer: writer().writer });
    expect(site.readLayout()).toEqual({
      layout,
      origin: 'site.yaml',
      pages: layout.pages,
      titles: { '/cv': { en: 'Resume', fr: 'CV' } },
    });
    expect(site.editingModel().sections.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'hero', title: undefined },
      { id: 'work', title: { en: 'Experience', fr: 'Expérience' } },
    ]);
  });

  it('says why the layout cannot be saved: no layout file, pages in vvitrine.config.ts, no writer', () => {
    const none = createKernel(config, { root: '/', logger: silent, layoutWriter: writer().writer }).readLayout();
    expect(none).toMatchObject({ layout: {}, pages: [{ path: '/', sections: ['hero', 'work'] }] });
    expect(none.readOnly).toMatch(/^There is no layout file: create site\.yaml/);
    const inConfig = kernel({
      data: { site: layout.site },
      config: { ...config, pages: [{ path: '/', sections: ['work'] }] },
      writer: writer().writer,
    }).readLayout();
    expect(inConfig.readOnly).toMatch(/^The pages are set in vvitrine\.config\.ts/);
    expect(inConfig.pages).toEqual([{ path: '/', sections: ['work'] }]);
    expect(kernel().readLayout().readOnly).toBe('This server cannot save the layout file.');
  });
});

describe('checking the layout (US-135)', () => {
  const pages = (sections: unknown[], more: unknown[] = []) => ({
    ...layout,
    pages: [{ path: '/', sections }, ...more],
  });

  it('finds nothing in a layout that builds', () => {
    expect(kernel().checkLayout(layout)).toEqual([]);
    expect(kernel().checkLayout({ site: layout.site })).toEqual([]);
  });

  it('points at unknown sections, invalid options and pages that share an address', () => {
    const issues = kernel().checkLayout(
      pages(['hero', 'gallery', { id: 'work', options: { limit: 0 } }], [{ path: '/', sections: [] }]),
    );
    expect(issues.map(({ at, message }) => ({ at, message }))).toEqual([
      { at: ['pages', 0, 'sections', 1], message: 'no installed section is "gallery" (installed: hero, work)' },
      { at: ['pages', 0, 'sections', 2, 'options', 'limit'], message: expect.stringMatching(/>0|positive/) },
      { at: ['pages', 1, 'path'], message: 'another page has the address /' },
    ]);
    expect(issues[0]!.file).toBe('site.yaml');
  });

  it('points at what the schema refuses, and at a setting also made in vvitrine.config.ts', () => {
    const [bad] = kernel().checkLayout({ pages: [{ path: 'cv', sections: [] }] });
    expect(bad!.at).toEqual(['pages', 0, 'path']);
    // The site builds (the layout has no messages yet); adding some there would set them in both places.
    const both = kernel({ data: { site: layout.site }, config: { ...config, messages: { en: {} } } }).checkLayout(
      layout,
    );
    expect(both).toEqual([expect.objectContaining({ at: ['messages'] })]);
  });
});

describe('saving the layout (US-135)', () => {
  it('checks the changes, then gives them to the writer', async () => {
    const { saved, writer: target } = writer();
    const move: ContentChange = { op: 'move', path: ['pages', 0, 'sections'], from: 1, to: 0 };
    expect(await kernel({ writer: target }).saveLayout([move])).toEqual({ files: ['site.yaml'] });
    expect(saved).toEqual([[move]]);
  });

  it('writes nothing when the result would not build, or a change is impossible', async () => {
    const { saved, writer: target } = writer();
    const site = kernel({ writer: target });
    const add = { op: 'insert', path: ['pages', 1, 'sections'], index: 0, value: 'gallery' } as const;
    const refused = await site.saveLayout([add]).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(InvalidConfigError);
    expect((refused as InvalidConfigError).issues[0]!.at).toEqual(['pages', 1, 'sections', 0]);
    await expect(site.saveLayout([{ op: 'remove', path: ['pages', 5] }])).rejects.toThrow(InvalidChangeError);
    await expect(kernel().saveLayout([])).rejects.toThrow('This server cannot save the layout file.');
    expect(saved).toEqual([]);
  });
});
