import { describe, expect, it } from 'vitest';
import { InvalidContentError, createKernel, InvalidPluginOptionsError, type EntriesView } from '@vvitrine/core';
import { memorySource, stringTheme } from '@vvitrine/core/testing';
import now from '../src/index.ts';

const content = {
  basics: { name: 'Jane' },
  now: {
    updated: '2026-11',
    items: [{ text: 'Looking for an internship' }, { text: 'Writing a framework', details: 'Astro and TypeScript' }],
  },
};

const build = (data: Record<string, unknown>, options: object = {}) =>
  createKernel(
    {
      site: { defaultLocale: 'en', locales: ['en', 'fr'] },
      plugins: [memorySource({ en: data, fr: data }), stringTheme({ 'kind:entries': 'Entries' }), now()],
      pages: [{ path: '/', sections: [{ id: 'now', options }] }],
    },
    { root: '/', logger: { info: () => {}, warn: () => {} } },
  ).build();

const section = async (data: Record<string, unknown>, options: object = {}, locale = 'en') =>
  (await build(data, options)).routes.find((r) => r.locale === locale)!.sections.find((s) => s.id === 'now');

describe('example section-now', () => {
  it('lists what you are doing now, dated once, in the page language', async () => {
    const fr = await section(content, {}, 'fr');
    // No component of its own: the theme draws it as a list of entries.
    expect(fr!.component).toBe('Entries');
    expect(fr!.view as EntriesView).toEqual({
      title: 'En ce moment',
      items: [
        { title: 'Looking for an internship', meta: ['Mis à jour : nov. 2026'], notes: [] },
        { title: 'Writing a framework', meta: [], summary: 'Astro and TypeScript', notes: [] },
      ],
    });
  });

  it('follows its options, and disappears without content', async () => {
    const view = (await section(content, { title: 'Lately', limit: 1 }))!.view as EntriesView;
    expect(view.title).toBe('Lately');
    expect(view.items).toHaveLength(1);
    expect(await section({ basics: { name: 'Jane' } })).toBeUndefined();
    await expect(build(content, { limit: 0 })).rejects.toThrow(InvalidPluginOptionsError);
  });

  it('rejects content that does not match its schema', async () => {
    await expect(build({ ...content, now: { updated: 'soon', items: [] } })).rejects.toThrow(InvalidContentError);
  });
});
