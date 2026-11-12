import { createKernel } from '@vvitrine/core';
import { memoryFiles, stringTheme } from '@vvitrine/core/testing';
import { allSections } from '@vvitrine/sections';
import yamlSource from '@vvitrine/source-yaml';
import { describe, expect, it } from 'vitest';
import { EditSession, SaveBlockedError } from '../src/index.ts';

/** The session against the real kernel and the real YAML source, as the Studio uses them. */
describe('an editing session on a site', () => {
  const resume =
    '# My resume\nbasics:\n  name: Jane Doe # as on my passport\nwork:\n  - name: ACME\n    position: Dev\n    startDate: 2024-09\n';
  const site = (files: ReturnType<typeof memoryFiles>) =>
    createKernel(
      { plugins: [yamlSource({ dir: 'content', file: 'resume' }), stringTheme({}, ''), ...allSections()] },
      { root: '/', logger: { info: () => {}, warn: () => {} }, files },
    );

  it('starts from the files, refuses what would not build, and saves the rest in place', async () => {
    const files = memoryFiles({ 'content/resume.yaml': resume });
    const kernel = site(files);
    const session = new EditSession({ en: (await kernel.readContent('en')).content });

    session.apply('en', { op: 'set', path: ['work', 0, 'startDate'], value: 'next year' });
    await expect(session.save(kernel, kernel)).rejects.toThrow(SaveBlockedError);
    expect(session.issuesAt('en', ['work', 0, 'startDate'])).toHaveLength(1);
    expect(files.snapshot()['content/resume.yaml']).toBe(resume);

    session.undo();
    session.apply('en', { op: 'set', path: ['basics', 'name'], value: 'Ada Lovelace' });
    expect(await session.save(kernel, kernel)).toEqual(['content/resume.yaml']);
    expect(session.issues).toEqual([]);
    expect(files.snapshot()['content/resume.yaml']).toBe(resume.replace('Jane Doe', 'Ada Lovelace'));
  });
});
