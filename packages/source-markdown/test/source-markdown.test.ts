import { describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { InvalidPluginOptionsError } from '@vvitrine/core';
import { checkSourceContract } from '@vvitrine/core/testing';
import markdownSource from '../src/index.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const ctx = (locale: string, logger = { info: () => {}, warn: () => {} }) => ({
  locale,
  defaultLocale: 'en',
  root,
  logger,
});

describe('@vvitrine/source-markdown', () => {
  it('turns each file into an item: front matter fields, body and slug from the file name', async () => {
    const result = await markdownSource({ dir: 'fixtures/projects' }).load(ctx('en'));
    expect(result.data).toEqual({
      projects: [
        {
          name: 'Alpha',
          startDate: '2025-10',
          keywords: ['Astro'],
          'x-vvitrine': { slug: 'alpha', body: '# Context\n\nShared write-up.' },
        },
        { name: 'Beta', 'x-vvitrine': { slug: 'beta' } },
      ],
    });
    expect(result.origin).toEqual({ projects: 'fixtures/projects' });
  });

  it('prefers the file for the current locale and ignores other locales', async () => {
    const result = await markdownSource({ dir: 'fixtures/projects' }).load(ctx('fr'));
    expect(result.data).toEqual({
      projects: [
        {
          name: 'Alpha (FR)',
          // The front matter can still set its own slug and other extension fields.
          'x-vvitrine': { slug: 'alpha-fr', featured: true, body: 'Texte en français.' },
        },
      ],
    });
  });

  it('fills the content key given in the options', async () => {
    const result = await markdownSource({ dir: 'fixtures/projects', key: 'posts' }).load(ctx('en'));
    expect(Object.keys(result.data)).toEqual(['posts']);
  });

  it('provides nothing, without failing, when the folder is missing or empty for the locale', async () => {
    const info = vi.fn();
    expect((await markdownSource({ dir: 'fixtures/none' }).load(ctx('en', { info, warn: () => {} }))).data).toEqual({});
    expect(info).toHaveBeenCalledOnce();
    expect((await markdownSource({ dir: 'fixtures/projects' }).load(ctx('de'))).data).toEqual({
      projects: [expect.objectContaining({ name: 'Alpha' })],
    });
  });

  it('explains what is wrong with a file', async () => {
    await expect(markdownSource({ dir: 'fixtures/broken' }).load(ctx('en'))).rejects.toThrow(
      'fixtures/broken/oops.md must start with front matter between two "---" lines.',
    );
    await expect(markdownSource({ dir: 'fixtures/bad-yaml' }).load(ctx('en'))).rejects.toThrow(
      'Could not parse the front matter of fixtures/bad-yaml/oops.md',
    );
    await expect(markdownSource({ dir: 'fixtures/not-object' }).load(ctx('en'))).rejects.toThrow(
      'The front matter of fixtures/not-object/list.md must contain fields such as "name".',
    );
  });

  it('rejects invalid options', () => {
    expect(() => markdownSource({ key: 'Not a key' })).toThrow(InvalidPluginOptionsError);
  });

  it('honours the source contract', async () => {
    expect(
      await checkSourceContract(markdownSource({ dir: 'fixtures/projects' }), { root, locales: ['en', 'fr'] }),
    ).toEqual([]);
  });
});
