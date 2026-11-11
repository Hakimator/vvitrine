import { describe, expect, it, vi } from 'vitest';
import { checkSourceContract, memoryFiles } from '@vvitrine/core/testing';
import yamlSource from '../src/index.ts';

const root = '/project';
// The files of the tests, as a project would have them.
const files = memoryFiles({
  'fixtures/resume.yaml': 'basics:\n  name: Default\n',
  'fixtures/resume.fr.yaml': 'basics:\n  name: Français\n',
  'fixtures/other.json': '{ "basics": { "name": "JSON" } }',
  'fixtures/broken.yaml': 'basics: [unclosed\n',
  'fixtures/list.yaml': '- a list\n',
});
const ctx = (locale: string, logger = { info: () => {}, warn: () => {} }) => ({
  locale,
  defaultLocale: 'en',
  root,
  logger,
  files,
});

describe('@vvitrine/source-yaml', () => {
  it('reads the locale-specific file first and records where each key came from', async () => {
    const result = await yamlSource({ dir: 'fixtures' }).load(ctx('fr'));
    expect(result.data).toEqual({ basics: { name: 'Français' } });
    expect(result.origin).toEqual({ basics: 'fixtures/resume.fr.yaml' });
  });

  it('falls back to the shared file for other locales', async () => {
    expect((await yamlSource({ dir: 'fixtures' }).load(ctx('en'))).data).toEqual({ basics: { name: 'Default' } });
  });

  it('reads JSON files too', async () => {
    expect((await yamlSource({ dir: 'fixtures', file: 'other' }).load(ctx('en'))).data).toEqual({
      basics: { name: 'JSON' },
    });
  });

  it('warns and returns no data when nothing is found', async () => {
    const warn = vi.fn();
    expect(
      (await yamlSource({ dir: 'fixtures', file: 'none' }).load(ctx('en', { info: () => {}, warn }))).data,
    ).toEqual({});
    expect(warn).toHaveBeenCalledOnce();
  });

  it('gives a clear error for invalid YAML or a non-object document', async () => {
    await expect(yamlSource({ dir: 'fixtures', file: 'broken' }).load(ctx('en'))).rejects.toThrow(
      /Could not parse fixtures\/broken.yaml/,
    );
    await expect(yamlSource({ dir: 'fixtures', file: 'list' }).load(ctx('en'))).rejects.toThrow(
      /must contain an object/,
    );
  });

  it('validates its options', () => {
    expect(() => yamlSource({ file: '../secret' })).toThrow(/Invalid options/);
  });

  it('satisfies the source contract', async () => {
    expect(await checkSourceContract(yamlSource({ dir: 'fixtures' }), { root, locales: ['en', 'fr'], files })).toEqual(
      [],
    );
  });

  it('reads only through ctx.files, with the folder as given', async () => {
    const read: string[] = [];
    const spy = { read: async (path: string) => (read.push(path), files.read(path)), list: files.list };
    await yamlSource({ dir: 'fixtures/' }).load({ ...ctx('fr'), files: spy });
    expect(read).toEqual(['fixtures/resume.fr.yaml']);
  });

  it('saves changes in the file it read for the locale, keeping its comments', async () => {
    const project = memoryFiles({
      'content/resume.yaml': '# Shared\nbasics:\n  name: Jane # me\n',
      'content/resume.fr.yaml': '# French\nbasics:\n  name: Jeanne\n',
      'content/other.json': '{ "basics": { "name": "J" } }',
    });
    const source = yamlSource();
    await source.save!([{ op: 'set', path: ['basics', 'label'], value: 'Développeuse' }], {
      ...ctx('fr'),
      files: project,
    });
    expect(project.snapshot()['content/resume.fr.yaml']).toBe(
      '# French\nbasics:\n  name: Jeanne\n  label: Développeuse\n',
    );
    // English has no file of its own: it reads, and saves, the shared one.
    await source.save!([{ op: 'set', path: ['basics', 'name'], value: 'Ada' }], { ...ctx('en'), files: project });
    expect(project.snapshot()['content/resume.yaml']).toBe('# Shared\nbasics:\n  name: Ada # me\n');
    await yamlSource({ dir: 'content', file: 'other' }).save!([{ op: 'set', path: ['work'], value: [] }], {
      ...ctx('en'),
      files: project,
    });
    expect(project.snapshot()['content/other.json']).toBe('{\n  "basics": {\n    "name": "J"\n  },\n  "work": []\n}\n');
  });

  it('creates the file when there is none: shared for the default locale, its own for the others', async () => {
    const project = memoryFiles({});
    const change = [{ op: 'set', path: ['basics', 'name'], value: 'Ada' }] as const;
    await yamlSource().save!(change, { ...ctx('en'), files: project });
    await yamlSource().save!(change, { ...ctx('fr'), files: project });
    expect(project.snapshot()).toEqual({
      'content/resume.yaml': 'basics:\n  name: Ada\n',
      // French read the shared file just created, so it saved there: no French file.
    });
    const french = memoryFiles({});
    await yamlSource().save!(change, { ...ctx('fr'), files: french });
    expect(Object.keys(french.snapshot())).toEqual(['content/resume.fr.yaml']);
    expect(yamlSource().accepts!('anything')).toBe(true);
  });
});
