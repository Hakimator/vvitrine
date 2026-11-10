import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { layoutModule, readLayout } from '../src/index.ts';

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

  it('imports only the theme the layout names, with its options', async () => {
    const pkg = await write(
      'bold.yaml',
      'theme:\n  use: "@vvitrine/theme-bold"\n  options: { colorSchemeToggle: true }\n',
    );
    const code = await layoutModule(pkg, root);
    expect(code.match(/^import /gm)).toHaveLength(1);
    expect(code).toContain('import * as themeModule from "@vvitrine/theme-bold";');
    expect(code).toContain('themeModule.default({"colorSchemeToggle":true})');

    const local = await write('local.yaml', 'theme: { use: ./plugins/theme.ts }\n');
    expect(await layoutModule(local, root)).toContain(
      `from ${JSON.stringify(join(root, 'plugins/theme.ts').replaceAll('\\', '/'))}`,
    );
  });

  it('imports no theme when the layout names none, and exports null without a layout file', async () => {
    const plain = await write('plain.yaml', 'theme: { tokens: { light: { colorPrimary: "#000" } } }\n');
    expect(await layoutModule(plain, root)).not.toContain('import');
    expect(await layoutModule(undefined, root)).toBe('export default null;');
  });
});
