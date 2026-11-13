import type { FieldDescriptor } from '@vvitrine/studio-core';
import { describe, expect, it } from 'vitest';
import { changeFor, emptyItem, filled, inputId, placeOf, valueAt } from '../src/app/logic.ts';

const field = (kind: FieldDescriptor['kind'], extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({
  path: ['name'],
  kind,
  label: 'Name',
  required: false,
  ...extra,
});

describe('the Studio screen logic', () => {
  it('finds values by place', () => {
    const content = { work: [{ name: 'A', highlights: ['x'] }] };
    expect(valueAt(content, ['work', 0, 'highlights', 0])).toBe('x');
    expect(valueAt(content, ['work', 3, 'name'])).toBeUndefined();
    expect(valueAt(content, ['basics', 'name'])).toBeUndefined();
  });

  it('knows what is filled in', () => {
    expect([undefined, null, '', '  ', [], {}, { a: '' }].map(filled)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(['a', 0, false, ['x'], { a: 'x' }].map(filled)).toEqual([true, true, true, true, true]);
  });

  it('turns what was typed into a change, removing emptied optional fields', () => {
    const place = ['basics', 'label'] as const;
    expect(changeFor(field('text'), place, 'Dev', undefined)).toEqual({ op: 'set', path: place, value: 'Dev' });
    expect(changeFor(field('text'), place, 'Dev', 'Dev')).toBeUndefined();
    expect(changeFor(field('text'), place, '', 'Dev')).toEqual({ op: 'remove', path: place });
    expect(changeFor(field('text'), place, '', undefined)).toBeUndefined();
    expect(changeFor(field('text', { required: true }), place, '', 'Dev')).toEqual({
      op: 'set',
      path: place,
      value: '',
    });
    expect(changeFor(field('number'), place, '12', 3)).toEqual({ op: 'set', path: place, value: 12 });
    expect(changeFor(field('boolean'), place, true, false)).toEqual({ op: 'set', path: place, value: true });
    expect(changeFor(field('boolean'), place, true, true)).toBeUndefined();
    expect(changeFor(field('select', { options: [1, 2] }), place, '2', 1)).toEqual({
      op: 'set',
      path: place,
      value: 2,
    });
    expect(changeFor(field('select', { options: ['a', 'b'] }), place, 'b', 'a')).toEqual({
      op: 'set',
      path: place,
      value: 'b',
    });
  });

  it('creates empty items, places fields and names inputs', () => {
    expect(emptyItem(field('list', { item: field('object') }))).toEqual({});
    expect(emptyItem(field('list', { item: field('text') }))).toBe('');
    expect(emptyItem(field('list', { item: field('number') }))).toBe(0);
    expect(emptyItem(field('list', { item: field('boolean') }))).toBe(false);
    expect(placeOf('work', field('text', { path: ['*', 'highlights', '*'] }), [2, 0])).toEqual([
      'work',
      2,
      'highlights',
      0,
    ]);
    expect(inputId('en', ['work', 2, 'x-vvitrine', 'note'])).toBe('field-en-work-2-x-vvitrine-note');
  });
});
