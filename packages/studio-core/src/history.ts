import type { ContentChange, ContentPath } from '@vvitrine/core';

type Container = Record<string, unknown> | unknown[];
const isContainer = (value: unknown): value is Container => typeof value === 'object' && value !== null;
const has = (container: unknown, segment: string | number): boolean =>
  isContainer(container) &&
  (Array.isArray(container) ? typeof segment === 'number' && segment < container.length : segment in container);
const at = (container: unknown, segment: string | number): unknown =>
  (container as Record<string | number, unknown>)[segment];

/**
 * The change that undoes `change` on `content` (the content before the change): applying both gives back the same
 * content. A `set` that created objects on its way is undone by removing the first object it created.
 */
export function invert(content: Readonly<Record<string, unknown>>, change: ContentChange): ContentChange {
  const path = change.path;
  switch (change.op) {
    case 'set': {
      let value: unknown = content;
      for (let index = 0; index < path.length; index += 1) {
        if (!has(value, path[index]!)) {
          return { op: 'remove', path: path.slice(0, index + 1) as unknown as ContentPath };
        }
        value = at(value, path[index]!);
      }
      return { op: 'set', path, value };
    }
    case 'remove': {
      const parent = path.slice(0, -1).reduce<unknown>(at, content);
      const last = path.at(-1)!;
      const value = at(parent, last);
      if (Array.isArray(parent)) {
        return { op: 'insert', path: path.slice(0, -1) as unknown as ContentPath, index: last as number, value };
      }
      return { op: 'set', path, value };
    }
    case 'insert':
      return { op: 'remove', path: [...path, change.index] as unknown as ContentPath };
    case 'move':
      return { op: 'move', path, from: change.to, to: change.from };
  }
}
