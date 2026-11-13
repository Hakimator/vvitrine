import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { layoutFileWriter } from '../src/layout-writer.ts';

describe('layout file writer (US-135)', () => {
  let folder: string;
  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), 'vvitrine-layout-writer-'));
  });
  afterAll(() => rm(folder, { recursive: true, force: true }));

  it("edits the demo's site.yaml in place: only the moved lines change, comments stay", async () => {
    const path = join(folder, 'site.yaml');
    await copyFile(new URL('../../../site/site.yaml', import.meta.url), path);
    const before = await readFile(path, 'utf8');
    await layoutFileWriter(path).save([
      // On the home page, "work" (5th) goes first and "talks" is hidden; the resume gets "awards".
      { op: 'move', path: ['pages', 0, 'sections'], from: 4, to: 0 },
      { op: 'set', path: ['pages', 0, 'sections', 10], value: { id: 'talks', hidden: true } },
      { op: 'insert', path: ['pages', 2, 'sections'], index: 7, value: 'awards' },
    ]);
    const after = await readFile(path, 'utf8');
    const lines = (text: string) => text.split('\n');
    expect(lines(after).filter((line) => !lines(before).includes(line))).toEqual([
      '      - { id: talks, hidden: true }',
      '      - awards',
    ]);
    expect(after).toContain('    sections:\n      - work\n      # The "Contact me" button');
    expect(after).toContain('      - interests\n      - awards\n');
    expect(after.match(/^\s*#/gm)).toEqual(before.match(/^\s*#/gm));
  });

  it('writes JSON again with its indentation and final line break', async () => {
    const path = join(folder, 'site.json');
    await writeFile(path, '{\n    "pages": [{ "path": "/", "sections": ["hero", "work"] }]\n}\n');
    await layoutFileWriter(path).save([{ op: 'move', path: ['pages', 0, 'sections'], from: 1, to: 0 }]);
    expect(await readFile(path, 'utf8')).toBe(
      '{\n    "pages": [\n        {\n            "path": "/",\n            "sections": [\n                "work",\n                "hero"\n            ]\n        }\n    ]\n}\n',
    );
  });
});
