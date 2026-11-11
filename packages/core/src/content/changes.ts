import { VVitrineError } from '../errors.ts';

/**
 * Where a change applies: the content key first, then field names and list positions,
 * e.g. ['work', 0, 'position'] or ['basics', 'name'].
 */
export type ContentPath = readonly [string, ...(string | number)[]];

/**
 * One edit of the content as written in the files (before defaults). Changes are small serialisable commands: the
 * Studio records them for undo, shows them before saving, and the kernel checks them before any file is written.
 */
export type ContentChange =
  /** Set a field (missing objects on the way are created). */
  | { readonly op: 'set'; readonly path: ContentPath; readonly value: unknown }
  /** Remove a field or a list item. */
  | { readonly op: 'remove'; readonly path: ContentPath }
  /** Insert an item into the list at `path`, at `index` (0 to the list's length). */
  | { readonly op: 'insert'; readonly path: ContentPath; readonly index: number; readonly value: unknown }
  /** Move an item of the list at `path` from one position to another. */
  | { readonly op: 'move'; readonly path: ContentPath; readonly from: number; readonly to: number };

export class InvalidChangeError extends VVitrineError {
  constructor(change: ContentChange, reason: string) {
    super(`Cannot ${change.op} ${change.path.join('.')}: ${reason}.`);
  }
}

type Container = Record<string, unknown> | unknown[];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function child(container: Container, segment: string | number): unknown {
  return Array.isArray(container) ? container[segment as number] : container[segment as string];
}

function checkSegment(change: ContentChange, container: unknown, segment: string | number): Container {
  if (typeof segment === 'number') {
    if (!Array.isArray(container))
      throw new InvalidChangeError(change, `${segment} is a position, but this is no list`);
    if (!Number.isInteger(segment) || segment < 0 || segment >= container.length) {
      throw new InvalidChangeError(change, `there is no item ${segment} (the list has ${container.length})`);
    }
  } else if (!isObject(container)) {
    throw new InvalidChangeError(change, `"${segment}" is a field name, but this is no object`);
  }
  return container as Container;
}

/** A copy of `container` with `segment` replaced by `value` (nothing else is copied: unchanged parts are shared). */
function replaced(container: Container, segment: string | number, value: unknown): Container {
  if (Array.isArray(container)) return container.map((item, index) => (index === segment ? value : item));
  return { ...container, [segment]: value };
}

function edit(change: ContentChange, value: unknown, path: readonly (string | number)[]): unknown {
  if (path.length === 0) return atTarget(change, value);
  const [segment, ...rest] = path as [string | number, ...(string | number)[]];
  // `set` creates the missing objects on its way; lists are never created implicitly.
  const created = change.op === 'set' && typeof segment === 'string' && value === undefined ? {} : value;
  const container = checkSegment(change, created, segment);
  if (rest.length === 0 && change.op === 'remove') {
    if (Array.isArray(container)) return container.filter((_, index) => index !== segment);
    if (!(segment in container)) throw new InvalidChangeError(change, `there is no field "${segment}"`);
    return Object.fromEntries(Object.entries(container).filter(([name]) => name !== segment));
  }
  return replaced(container, segment, edit(change, child(container, segment), rest));
}

/** What happens at the end of the path: the new value, or the list operations on the list found there. */
function atTarget(change: ContentChange, value: unknown): unknown {
  if (change.op === 'set') return change.value;
  if (change.op === 'remove') throw new InvalidChangeError(change, 'the path is empty');
  if (!Array.isArray(value)) throw new InvalidChangeError(change, 'this is no list');
  if (change.op === 'insert') {
    if (!Number.isInteger(change.index) || change.index < 0 || change.index > value.length) {
      throw new InvalidChangeError(change, `position ${change.index} is outside the list (0 to ${value.length})`);
    }
    return [...value.slice(0, change.index), change.value, ...value.slice(change.index)];
  }
  for (const position of [change.from, change.to]) {
    if (!Number.isInteger(position) || position < 0 || position >= value.length) {
      throw new InvalidChangeError(change, `there is no item ${position} (the list has ${value.length})`);
    }
  }
  const items = [...value];
  const [moved] = items.splice(change.from, 1);
  items.splice(change.to, 0, moved);
  return items;
}

/**
 * Apply a change to raw content (all keys), without modifying it: the result shares the parts that did not change.
 * Throws `InvalidChangeError` when the path does not exist (except the objects `set` creates on the way).
 */
export function applyChange(
  content: Readonly<Record<string, unknown>>,
  change: ContentChange,
): Record<string, unknown> {
  return edit(change, content, change.path) as Record<string, unknown>;
}
