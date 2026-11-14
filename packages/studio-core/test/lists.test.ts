import { applyChange } from '@vvitrine/core';
import { describe, expect, it } from 'vitest';
import { listChanges, type ListAction } from '../src/index.ts';

const documents = {
  en: {
    work: [
      { name: 'A', highlights: ['a1', 'a2'] },
      { name: 'B', 'x-vvitrine': { slug: 'b', featured: true } },
      { name: 'C' },
    ],
  },
  fr: {
    work: [
      { name: 'A (fr)', highlights: ['a1 (fr)'] },
      { name: 'B (fr)', 'x-vvitrine': { slug: 'b' } },
    ],
  },
};

/** The lists after the action, by language. */
function after(action: ListAction, path: [string, ...(string | number)[]] = ['work']) {
  const result: Record<string, Record<string, unknown>> = { ...documents };
  for (const { document, change } of listChanges(documents, path, action)) {
    result[document] = applyChange(result[document]!, change);
  }
  return result;
}
const names = (data: Record<string, unknown>) => (data.work as { name: string }[]).map((job) => job.name);

describe('list item changes in every language (US-136)', () => {
  it('moves an item in every language that has both places', () => {
    const moved = after({ kind: 'move', from: 1, to: 0 });
    expect([names(moved.en!), names(moved.fr!)]).toEqual([
      ['B', 'A', 'C'],
      ['B (fr)', 'A (fr)'],
    ]);
    // French has no third job: only English moves it.
    expect(listChanges(documents, ['work'], { kind: 'move', from: 2, to: 0 }).map((c) => c.document)).toEqual(['en']);
    expect(listChanges(documents, ['work'], { kind: 'move', from: 1, to: 1 })).toEqual([]);
  });

  it('duplicates an item next to it, without its slug, which must stay unique', () => {
    const copied = after({ kind: 'duplicate', index: 1 });
    expect((copied.en!.work as unknown[])[2]).toEqual({ name: 'B', 'x-vvitrine': { featured: true } });
    expect((copied.fr!.work as unknown[])[2]).toEqual({ name: 'B (fr)' });
    expect(names(copied.en!)).toEqual(['A', 'B', 'B', 'C']);
    // The original is untouched.
    expect(documents.en.work[1]).toEqual({ name: 'B', 'x-vvitrine': { slug: 'b', featured: true } });
  });

  it('removes an item in every language that has it', () => {
    const removed = after({ kind: 'remove', index: 0 });
    expect([names(removed.en!), names(removed.fr!)]).toEqual([['B', 'C'], ['B (fr)']]);
  });

  it('adds an item at the end of every language, creating the list where its place exists', () => {
    const added = after({ kind: 'add', value: { name: '' } });
    expect([names(added.en!), names(added.fr!)]).toEqual([
      ['A', 'B', 'C', ''],
      ['A (fr)', 'B (fr)', ''],
    ]);
    const highlights = listChanges(documents, ['work', 1, 'highlights'], { kind: 'add', value: '' });
    expect(highlights).toEqual([
      { document: 'en', change: { op: 'set', path: ['work', 1, 'highlights'], value: [''] } },
      { document: 'fr', change: { op: 'set', path: ['work', 1, 'highlights'], value: [''] } },
    ]);
    // The third job has no French version: its new list goes to English only.
    expect(
      listChanges(documents, ['work', 2, 'highlights'], { kind: 'add', value: '' }).map((c) => c.document),
    ).toEqual(['en']);
    expect(listChanges({ en: {} }, ['skills'], { kind: 'add', value: { name: '' } })).toEqual([
      { document: 'en', change: { op: 'set', path: ['skills'], value: [{ name: '' }] } },
    ]);
  });

  it('works on nested lists the same way', () => {
    const moved = after({ kind: 'move', from: 1, to: 0 }, ['work', 0, 'highlights']);
    expect((moved.en!.work as { highlights: string[] }[])[0]!.highlights).toEqual(['a2', 'a1']);
    expect(moved.fr).toBe(documents.fr);
  });
});
