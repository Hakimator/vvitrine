import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ProjectFiles } from '@vvitrine/core';

const MISSING = new Set(['ENOENT', 'ENOTDIR', 'EISDIR']);
const missing = (error: unknown) => MISSING.has((error as NodeJS.ErrnoException).code ?? '');

/** The project's files on disk, for sources (`ctx.files`). Paths are relative to `root` (or absolute). */
export function diskFiles(root: string): ProjectFiles {
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
  };
}
