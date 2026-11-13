import type { ContentChange, ContentPath } from '@vvitrine/core';
import type { FieldDescriptor } from '@vvitrine/studio-core';

/** A concrete place in the content: the content key, then field names and list positions. */
export type Place = readonly [string, ...(string | number)[]];

/** The value at a place, or undefined. */
export function valueAt(content: Readonly<Record<string, unknown>>, place: readonly (string | number)[]): unknown {
  return place.reduce<unknown>(
    (at, segment) =>
      typeof at === 'object' && at !== null ? (at as Record<string | number, unknown>)[segment] : undefined,
    content,
  );
}

/** Whether a value counts as filled in (for "missing in another language"). */
export function filled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value).some(filled);
  return true;
}

/**
 * The change for what a person typed or chose in a field. An emptied optional field is removed from the file rather
 * than written empty (an empty text is often invalid, and the file stays clean). Gives undefined when nothing changes.
 */
export function changeFor(
  field: FieldDescriptor,
  place: Place,
  input: string | boolean,
  current: unknown,
): ContentChange | undefined {
  const path = place as ContentPath;
  if (field.kind === 'boolean') return current === input ? undefined : { op: 'set', path, value: input };
  const text = String(input);
  if (text === '' && !field.required) return current === undefined ? undefined : { op: 'remove', path };
  let value: unknown = text;
  if (field.kind === 'number') value = Number(text);
  // A choice keeps the type of the options (numbers stay numbers).
  if (field.kind === 'select') value = field.options?.find((option) => String(option) === text) ?? text;
  return value === current ? undefined : { op: 'set', path, value };
}

/** A new, empty item for a list: an empty object for a list of objects, otherwise an empty text. */
export function emptyItem(list: FieldDescriptor): unknown {
  if (list.item?.kind === 'object') return {};
  if (list.item?.kind === 'number') return 0;
  if (list.item?.kind === 'boolean') return false;
  return '';
}

/** Where a field sits in the content, with `*` replaced by the positions of the item being shown. */
export function placeOf(key: string, field: FieldDescriptor, positions: readonly number[]): Place {
  let next = 0;
  return [key, ...field.path.map((segment) => (segment === '*' ? positions[next++]! : segment))];
}

/** A stable id for an input: content key, language and place. */
export function inputId(locale: string, place: readonly (string | number)[]): string {
  return `field-${locale}-${place.join('-').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}
