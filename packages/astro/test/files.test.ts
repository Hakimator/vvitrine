import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { diskFiles } from '../src/files.ts';

describe('project files on disk', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'vvitrine-files-'));
    await mkdir(join(root, 'content/projects'), { recursive: true });
    await writeFile(join(root, 'content/resume.yaml'), 'basics: { name: Jane }\n');
    await writeFile(join(root, 'content/projects/b.md'), 'b');
    await writeFile(join(root, 'content/projects/a.md'), 'a');
  });
  afterAll(() => rm(root, { recursive: true, force: true }));

  it('reads files relative to the project root, and absolute paths', async () => {
    const files = diskFiles(root);
    expect(await files.read('content/resume.yaml')).toBe('basics: { name: Jane }\n');
    expect(await files.read(join(root, 'content/projects/a.md'))).toBe('a');
  });

  it('lists a folder sorted, and gives nothing for what does not exist', async () => {
    const files = diskFiles(root);
    expect(await files.list('content')).toEqual(['projects', 'resume.yaml']);
    expect(await files.list('content/projects')).toEqual(['a.md', 'b.md']);
    expect(await files.read('content/missing.yaml')).toBeUndefined();
    expect(await files.read('content')).toBeUndefined();
    expect(await files.list('content/resume.yaml')).toBeUndefined();
    expect(await files.list('elsewhere')).toBeUndefined();
  });
});
