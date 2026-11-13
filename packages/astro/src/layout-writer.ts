import { readFile, writeFile } from 'node:fs/promises';
import { applyChange, type ContentChange, type LayoutWriter } from '@vvitrine/core';
import { editYaml } from '@vvitrine/yaml-edit';

/**
 * Saves layout changes into the layout file (US-135), in its format: YAML is edited in place, so its comments and
 * styles stay and `git diff` shows only what moved; JSON is written again with its indentation. The kernel has
 * checked the changes before.
 */
export function layoutFileWriter(path: string): LayoutWriter {
  return {
    async save(changes) {
      const text = await readFile(path, 'utf8');
      await writeFile(path, path.endsWith('.json') ? editJson(text, changes) : editYaml(text, changes), 'utf8');
    },
  };
}

function editJson(text: string, changes: readonly ContentChange[]): string {
  const data = changes.reduce<Record<string, unknown>>(
    (current, change) => applyChange(current, change),
    JSON.parse(text) as Record<string, unknown>,
  );
  const indent = /^[ \t]+(?=")/m.exec(text)?.[0] ?? '  ';
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return JSON.stringify(data, null, indent).replaceAll('\n', eol) + (/\r?\n$/.test(text) ? eol : '');
}
