import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diskFiles, readLayout } from '@vvitrine/astro';
import { createKernel, type Plugin } from '@vvitrine/core';
import { stringTheme } from '@vvitrine/core/testing';
import { allSections } from '@vvitrine/sections';
import markdownSource from '@vvitrine/source-markdown';
import yamlSource from '@vvitrine/source-yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The whole chain on the demo content, as the Studio will use it: the demo's sources and section plugins, files on
 * disk (a copy of site/content), changes saved through the kernel, then a build of the result. (The demo's own
 * vvitrine.config.ts cannot be loaded here: some of its plugins ship Astro components.)
 */
describe('saving the demo content', () => {
  const site = new URL('../../site/', import.meta.url).pathname;
  const plugins: Plugin[] = [
    yamlSource({ dir: 'content', file: 'resume' }),
    markdownSource({ dir: 'content/projects' }),
    markdownSource({ dir: 'content/blog', key: 'posts' }),
    ...allSections(),
  ];
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'vvitrine-save-'));
    await cp(join(site, 'content'), join(root, 'content'), { recursive: true });
    await cp(join(site, 'public'), join(root, 'public'), { recursive: true });
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  const kernel = async () => {
    // The demo's languages and texts; its pages also place plugins not loaded here, so every section goes on one page.
    const layout = await readLayout(join(site, 'site.yaml'), site);
    const data = Object.fromEntries(Object.entries(layout.data as object).filter(([key]) => key !== 'pages'));
    const silent = { info: () => {}, warn: () => {} };
    return createKernel(
      { plugins },
      {
        root,
        logger: silent,
        files: diskFiles(root),
        // Nothing is rendered here: the core's test theme stands in for the theme site.yaml names.
        layout: { origin: layout.origin, data, theme: stringTheme({}, 'Section') },
      },
    );
  };

  it('changes one line of the YAML file and one front matter field, and the site still builds', async () => {
    const before = await readFile(join(root, 'content/resume.en.yaml'), 'utf8');
    const saved = await (
      await kernel()
    ).saveContent('en', [
      { op: 'set', path: ['basics', 'label'], value: 'Software engineer' },
      { op: 'set', path: ['projects', 0, 'name'], value: 'Renamed project' },
    ]);
    const after = await readFile(join(root, 'content/resume.en.yaml'), 'utf8');
    const changed = after.split('\n').filter((line, index) => line !== before.split('\n')[index]);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatch(/^ {2}label: Software engineer/);
    expect(saved.files).toHaveLength(2);
    const built = await (await kernel()).build();
    const hero = built.routes.find((route) => route.key === 'en:/')!.sections.find((s) => s.id === 'hero')!;
    expect(JSON.stringify(hero.view)).toContain('Software engineer');
  });

  it('refuses a change the build would refuse, and writes nothing', async () => {
    const before = await readFile(join(root, 'content/resume.en.yaml'), 'utf8');
    await expect(
      (await kernel()).saveContent('en', [{ op: 'set', path: ['basics', 'name'], value: 42 }]),
    ).rejects.toThrow(/basics\.name/);
    expect(await readFile(join(root, 'content/resume.en.yaml'), 'utf8')).toBe(before);
  });
});
