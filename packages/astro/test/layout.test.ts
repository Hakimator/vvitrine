import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readLayout } from '../src/index.ts';

describe('layout file', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'vvitrine-layout-'));
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  const write = async (name: string, text: string) => {
    await writeFile(join(root, name), text);
    return join(root, name);
  };

  it('reads YAML and JSON, and names the file relative to the project', async () => {
    const yaml = await write('site.yaml', '# Pages\npages:\n  - path: /\n    sections: [hero]\n');
    expect(await readLayout(yaml, root)).toEqual({
      data: { pages: [{ path: '/', sections: ['hero'] }] },
      origin: 'site.yaml',
    });
    const json = await write('site.json', '{ "messages": { "en": { "page.blog": "Blog" } } }');
    expect((await readLayout(json, root)).data).toEqual({ messages: { en: { 'page.blog': 'Blog' } } });
  });

  it('gives the file name and the line of a syntax error', async () => {
    const broken = await write('broken.yaml', 'pages:\n  - path: /\n   sections: [hero\n');
    await expect(readLayout(broken, root)).rejects.toThrow(/broken\.yaml is not valid YAML: .*line 3/s);
  });
});
