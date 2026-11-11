import { describe, expect, it, vi } from 'vitest';
import { InvalidPluginOptionsError, type ContentChange } from '@vvitrine/core';
import { checkSourceContract, memoryFiles } from '@vvitrine/core/testing';
import markdownSource from '../src/index.ts';

const root = '/project';
// The files of the tests, as a project would have them.
const files = memoryFiles({
  'fixtures/bad-yaml/oops.md': '---\nname: [unclosed\n---\n\nText\n',
  'fixtures/broken/oops.md': 'No front matter here.\n',
  'fixtures/not-object/list.md': '---\n- a list\n---\n',
  'fixtures/projects/alpha.fr.md':
    '---\nname: Alpha (FR)\nx-vvitrine: { featured: true, slug: alpha-fr }\n---\n\nTexte en français.\n',
  'fixtures/projects/alpha.md':
    '---\nname: Alpha\nstartDate: 2025-10\nkeywords: [Astro]\n---\n\n# Context\n\nShared write-up.\n',
  'fixtures/projects/beta.en.md': '---\nname: Beta\n---\n',
  'fixtures/projects/notes.txt': 'Not a Markdown file: ignored.\n',
});
const ctx = (locale: string, logger = { info: () => {}, warn: () => {} }) => ({
  locale,
  defaultLocale: 'en',
  root,
  logger,
  files,
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

  it('fills the content key given in the options, and can be installed once per key', async () => {
    const posts = markdownSource({ dir: 'fixtures/projects', key: 'posts' });
    expect(Object.keys((await posts.load(ctx('en'))).data)).toEqual(['posts']);
    expect([markdownSource().name, posts.name]).toEqual([
      '@vvitrine/source-markdown:projects',
      '@vvitrine/source-markdown:posts',
    ]);
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
      await checkSourceContract(markdownSource({ dir: 'fixtures/projects' }), { root, locales: ['en', 'fr'], files }),
    ).toEqual([]);
  });

  describe('saving', () => {
    const project = () =>
      memoryFiles({
        'content/projects/alpha.md':
          '---\n# The first one\nname: Alpha\nkeywords: [Astro]\n---\n\n# Context\n\nText.\n',
        'content/projects/beta.fr.md': '---\nname: Bêta\n---\n',
        'content/projects/beta.md': '---\nname: Beta\n---\n',
      });
    const save = (files: ReturnType<typeof memoryFiles>, changes: ContentChange[], locale = 'en') =>
      markdownSource().save!(changes, { ...ctx(locale), files });

    it('edits the front matter of the item in place, and leaves the text below it as written', async () => {
      const files = project();
      await save(files, [{ op: 'set', path: ['projects', 0, 'name'], value: 'Alpha 2' }]);
      expect(files.snapshot()['content/projects/alpha.md']).toBe(
        '---\n# The first one\nname: Alpha 2\nkeywords: [Astro]\n---\n\n# Context\n\nText.\n',
      );
      await save(files, [{ op: 'set', path: ['projects', 0, 'x-vvitrine', 'featured'], value: true }]);
      expect(files.snapshot()['content/projects/alpha.md']).toContain('x-vvitrine:\n  featured: true\n---\n');
    });

    it('replaces the text below the front matter for x-vvitrine.body', async () => {
      const files = project();
      await save(files, [{ op: 'set', path: ['projects', 0, 'x-vvitrine', 'body'], value: 'New text.' }]);
      expect(files.snapshot()['content/projects/alpha.md']).toBe(
        '---\n# The first one\nname: Alpha\nkeywords: [Astro]\n---\n\nNew text.\n',
      );
      await save(files, [{ op: 'remove', path: ['projects', 0, 'x-vvitrine', 'body'] }]);
      expect(files.snapshot()['content/projects/alpha.md']).toBe(
        '---\n# The first one\nname: Alpha\nkeywords: [Astro]\n---\n',
      );
    });

    it('creates a file for a new item, named after its name, and edits it by its position', async () => {
      const files = project();
      await save(files, [
        {
          op: 'insert',
          path: ['projects'],
          index: 2,
          value: { name: 'Ma Bibliothèque!', 'x-vvitrine': { body: 'Hi.' } },
        },
        { op: 'set', path: ['projects', 2, 'startDate'], value: '2026-01' },
        { op: 'insert', path: ['projects'], index: 0, value: { name: 'Alpha' } },
      ]);
      const after = files.snapshot();
      expect(after['content/projects/ma-bibliotheque.md']).toBe(
        '---\nname: Ma Bibliothèque!\nstartDate: 2026-01\n---\n\nHi.\n',
      );
      // "alpha" is taken: the new file gets a free name.
      expect(after['content/projects/alpha-2.md']).toBe('---\nname: Alpha\n---\n');
      // In another locale, the new file is for that locale only.
      await save(files, [{ op: 'insert', path: ['projects'], index: 0, value: { name: 'Gamma' } }], 'fr');
      expect(files.snapshot()['content/projects/gamma.fr.md']).toBe('---\nname: Gamma\n---\n');
    });

    it('deletes the file of a removed item, and the file of its locale only', async () => {
      const files = project();
      await save(files, [{ op: 'remove', path: ['projects', 1] }], 'fr');
      expect(Object.keys(files.snapshot())).toEqual(['content/projects/alpha.md', 'content/projects/beta.md']);
    });

    it('keeps the slug that comes from the file name out of the file, and keeps Windows line endings', async () => {
      const files = memoryFiles({ 'content/projects/alpha.md': '---\r\nname: Alpha\r\n---\r\n\r\nText.\r\n' });
      await save(files, [{ op: 'set', path: ['projects', 0, 'x-vvitrine', 'slug'], value: 'alpha' }]);
      expect(files.snapshot()['content/projects/alpha.md']).toBe('---\r\nname: Alpha\r\n---\r\n\r\nText.\r\n');
      await save(files, [{ op: 'set', path: ['projects', 0, 'name'], value: 'A' }]);
      expect(files.snapshot()['content/projects/alpha.md']).toBe('---\r\nname: A\r\n---\r\n\r\nText.\r\n');
    });

    it('explains the changes a folder of files cannot hold', async () => {
      await expect(save(project(), [{ op: 'move', path: ['projects'], from: 0, to: 1 }])).rejects.toThrow(
        '"projects" items are ordered by their file names in content/projects/: they cannot be moved.',
      );
      await expect(save(project(), [{ op: 'set', path: ['projects'], value: [] }])).rejects.toThrow(
        'Change "projects" item by item',
      );
      await expect(save(project(), [{ op: 'remove', path: ['projects', 7] }])).rejects.toThrow('there is no such item');
      expect([markdownSource().accepts!('projects'), markdownSource().accepts!('posts')]).toEqual([true, false]);
    });

    it('saves through the kernel like any source, and the next load shows the change', async () => {
      const files = project();
      const source = markdownSource();
      expect(await checkSourceContract(source, { root, locales: ['en', 'fr'], files })).toEqual([]);
      await save(files, [{ op: 'set', path: ['projects', 1, 'name'], value: 'Beta 2' }]);
      const loaded = await source.load({ ...ctx('en'), files });
      expect((loaded.data.projects as { name: string }[]).map((p) => p.name)).toEqual(['Alpha', 'Beta 2']);
    });
  });
});
