import type { ContentChange, ContentPath } from '@vvitrine/core';
import type { DocumentChange, DocumentId } from './session.ts';

/** What can be done to the items of a list (US-136). Positions count from 0. */
export type ListAction =
  | { readonly kind: 'move'; readonly from: number; readonly to: number }
  | { readonly kind: 'duplicate'; readonly index: number }
  | { readonly kind: 'remove'; readonly index: number }
  /** Add an item at the end (and the list, when a language has none yet). */
  | { readonly kind: 'add'; readonly value: unknown };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function valueAt(data: unknown, path: readonly (string | number)[]): unknown {
  let value = data;
  for (const segment of path) {
    if (Array.isArray(value) && typeof segment === 'number') value = value[segment];
    else if (isObject(value) && typeof segment === 'string') value = value[segment];
    else return undefined;
  }
  return value;
}

/** A copy of an item, without what must stay unique: its slug (its address), which the copy gets from its name. */
function copy(item: unknown): unknown {
  const clone = structuredClone(item);
  if (isObject(clone) && isObject(clone['x-vvitrine'])) {
    const rest = Object.fromEntries(Object.entries(clone['x-vvitrine']).filter(([name]) => name !== 'slug'));
    if (Object.keys(rest).length > 0) clone['x-vvitrine'] = rest;
    else delete clone['x-vvitrine'];
  }
  return clone;
}

/**
 * The changes that do `action` on the list at `path` in every document (each language) that has it, so that all
 * languages keep the same items in the same order: the Studio shows them side by side by position, and only their
 * texts differ. A language whose list is too short for the action is left as it is. Made as one step to undo.
 */
export function listChanges(
  documents: Readonly<Record<DocumentId, Readonly<Record<string, unknown>>>>,
  path: ContentPath,
  action: ListAction,
): DocumentChange[] {
  return Object.entries(documents).flatMap(([document, data]) => {
    const list = valueAt(data, path);
    const items = Array.isArray(list) ? list : undefined;
    const has = (index: number) => items !== undefined && index >= 0 && index < items.length;
    const change = ((): ContentChange | undefined => {
      switch (action.kind) {
        case 'move':
          return has(action.from) && has(action.to) && action.from !== action.to
            ? { op: 'move', path, from: action.from, to: action.to }
            : undefined;
        case 'duplicate':
          return has(action.index)
            ? { op: 'insert', path, index: action.index + 1, value: copy(items![action.index]) }
            : undefined;
        case 'remove':
          return has(action.index) ? { op: 'remove', path: [...path, action.index] } : undefined;
        case 'add':
          if (items) return { op: 'insert', path, index: items.length, value: structuredClone(action.value) };
          // A new list, where its place exists (a nested list needs its item in that language).
          return path.length === 1 || isObject(valueAt(data, path.slice(0, -1)))
            ? { op: 'set', path, value: [structuredClone(action.value)] }
            : undefined;
      }
    })();
    return change ? [{ document, change }] : [];
  });
}
