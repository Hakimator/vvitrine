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
});
