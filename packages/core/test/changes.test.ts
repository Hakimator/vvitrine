import { describe, expect, it } from 'vitest';
import { applyChange, InvalidChangeError, type ContentChange } from '../src/content/changes.ts';

const content = {
  basics: { name: 'Jane', profiles: [{ network: 'GitHub' }] },
  work: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
};

describe('content changes', () => {
  it('sets a field, creating missing objects on the way, and shares what did not change', () => {
    const changed = applyChange(content, { op: 'set', path: ['basics', 'name'], value: 'Ada' });
    expect(changed.basics).toEqual({ name: 'Ada', profiles: [{ network: 'GitHub' }] });
    expect(changed.work).toBe(content.work);
    expect(content.basics.name).toBe('Jane');
    const created = applyChange(content, { op: 'set', path: ['awards', 'x-vvitrine', 'note'], value: 1 });
    expect(created.awards).toEqual({ 'x-vvitrine': { note: 1 } });
    expect(applyChange(content, { op: 'set', path: ['work', 1, 'name'], value: 'Z' }).work).toEqual([
      { name: 'A' },
      { name: 'Z' },
      { name: 'C' },
    ]);
  });

  it('removes a field or a list item', () => {
    expect(applyChange(content, { op: 'remove', path: ['basics', 'profiles'] }).basics).toEqual({ name: 'Jane' });
    expect(applyChange(content, { op: 'remove', path: ['work', 0] }).work).toEqual([{ name: 'B' }, { name: 'C' }]);
    expect(Object.keys(applyChange(content, { op: 'remove', path: ['work'] }))).toEqual(['basics']);
  });

  it('inserts and moves list items', () => {
    const insert = (index: number) =>
      applyChange(content, { op: 'insert', path: ['work'], index, value: { name: 'N' } });
    expect(insert(0).work).toEqual([{ name: 'N' }, { name: 'A' }, { name: 'B' }, { name: 'C' }]);
    expect((insert(3).work as unknown[]).at(-1)).toEqual({ name: 'N' });
    const moved = applyChange(content, { op: 'move', path: ['work'], from: 2, to: 0 });
    expect(moved.work).toEqual([{ name: 'C' }, { name: 'A' }, { name: 'B' }]);
    expect(applyChange(content, { op: 'move', path: ['basics', 'profiles'], from: 0, to: 0 }).basics).toEqual(
      content.basics,
    );
  });

  it('explains a change that does not fit the content', () => {
    const fails = (change: ContentChange, message: string) => {
      expect(() => applyChange(content, change)).toThrow(InvalidChangeError);
      expect(() => applyChange(content, change)).toThrow(message);
    };
    fails(
      { op: 'set', path: ['work', 3, 'name'], value: 'X' },
      'Cannot set work.3.name: there is no item 3 (the list has 3).',
    );
    fails({ op: 'set', path: ['basics', 0], value: 'X' }, '0 is a position, but this is no list');
    fails({ op: 'set', path: ['work', 'name'], value: 'X' }, '"name" is a field name, but this is no object');
    fails({ op: 'remove', path: ['basics', 'email'] }, 'there is no field "email"');
    fails({ op: 'insert', path: ['basics'], index: 0, value: {} }, 'this is no list');
    fails({ op: 'insert', path: ['work'], index: 4, value: {} }, 'position 4 is outside the list (0 to 3)');
    fails({ op: 'move', path: ['work'], from: 0, to: 3 }, 'there is no item 3');
    fails({ op: 'insert', path: ['awards'], index: 0, value: {} }, 'this is no list');
  });
});
