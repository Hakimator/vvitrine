import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { ProjectFileWriter, ProjectFiles } from '@vvitrine/core';

const MISSING = new Set(['ENOENT', 'ENOTDIR', 'EISDIR']);
const missing = (error: unknown) => MISSING.has((error as NodeJS.ErrnoException).code ?? '');

/**
 * The project's files on disk, for sources (`ctx.files`), writable for saving content (`saveContent`). Paths are
 * relative to `root` (or absolute).
 */
export function diskFiles(root: string): ProjectFiles & ProjectFileWriter {
  const at = (path: string) => resolve(root, path);
  return {
    async read(path) {
      try {
        return await readFile(at(path), 'utf8');
      } catch (error) {
        if (missing(error)) return undefined;
        throw error;
      }
    },
    async list(dir) {
      try {
        return (await readdir(at(dir))).sort();
      } catch (error) {
        if (missing(error)) return undefined;
        throw error;
      }
    },
    async write(path, text) {
      await mkdir(dirname(at(path)), { recursive: true });
      await writeFile(at(path), text, 'utf8');
    },
    async remove(path) {
      await rm(at(path), { force: true });
    },
  };
}
