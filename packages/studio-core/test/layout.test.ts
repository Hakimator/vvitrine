import { applyChange, type ContentChange, type PageConfig } from '@vvitrine/core';
import { describe, expect, it } from 'vitest';
import { pageChanges, placement, written, type PageAction } from '../src/index.ts';

const pages: PageConfig[] = [
  { path: '/', sections: ['hero', { id: 'work', options: { limit: 2 } }, { id: 'skills', nav: false }] },
  { path: '/cv', title: 'page.cv', sections: ['education'] },
];
const layout = { site: { defaultLocale: 'en' }, pages };

const after = (action: PageAction, data: Record<string, unknown> = layout) =>
  pageChanges(data, pages, action).reduce<Record<string, unknown>>(
    (current, change) => applyChange(current, change),
    data,
  ).pages as PageConfig[];

describe('page builder changes (US-135)', () => {
  it('moves a section on its page, and to another page with its options', () => {
    expect(after({ kind: 'move', page: 0, from: 2, to: 0 })[0]!.sections).toEqual([
      { id: 'skills', nav: false },
      'hero',
      { id: 'work', options: { limit: 2 } },
    ]);
    const moved = after({ kind: 'move-to-page', page: 0, index: 1, target: 1 });
    expect(moved.map((page) => page.sections)).toEqual([
      ['hero', { id: 'skills', nav: false }],
      ['education', { id: 'work', options: { limit: 2 } }],
    ]);
    expect(after({ kind: 'move-to-page', page: 1, index: 0, target: 0, at: 0 })[0]!.sections[0]).toBe('education');
  });

  it('adds and removes sections', () => {
    expect(after({ kind: 'add', page: 1, id: 'awards' })[1]!.sections).toEqual(['education', 'awards']);
    expect(after({ kind: 'add', page: 0, id: 'awards', at: 1 })[0]!.sections[1]).toBe('awards');
    expect(after({ kind: 'remove', page: 0, index: 0 })[0]!.sections).toHaveLength(2);
  });

  it('hides and shows a section, and its menu link, writing it back as simply as it can', () => {
    const hidden = after({ kind: 'hide', page: 0, index: 0, hidden: true });
    expect(hidden[0]!.sections[0]).toEqual({ id: 'hero', hidden: true });
    expect(after({ kind: 'hide', page: 0, index: 0, hidden: false }, { pages: hidden })[0]!.sections[0]).toBe('hero');
    expect(after({ kind: 'menu', page: 0, index: 2, shown: true })[0]!.sections[2]).toBe('skills');
    expect(after({ kind: 'menu', page: 0, index: 1, shown: false })[0]!.sections[1]).toEqual({
      id: 'work',
      options: { limit: 2 },
      nav: false,
    });
  });

  it('writes the pages as built first when the layout file has none, in the same step', () => {
    const changes = pageChanges({ site: {} }, pages, { kind: 'remove', page: 1, index: 0 });
    expect(changes).toEqual<ContentChange[]>([
      { op: 'set', path: ['pages'], value: pages },
      { op: 'remove', path: ['pages', 1, 'sections', 0] },
    ]);
  });

  it('refuses a page or a section that does not exist', () => {
    expect(() => pageChanges(layout, pages, { kind: 'remove', page: 0, index: 7 })).toThrow(
      'There is no section 7 on page 0.',
    );
    expect(() => pageChanges(layout, pages, { kind: 'add', page: 4, id: 'x' })).toThrow('There is no page 4.');
  });

  it('reads and writes the two ways to place a section', () => {
    expect(placement('hero')).toEqual({ id: 'hero' });
    expect(written({ id: 'hero', nav: undefined, hidden: undefined })).toBe('hero');
    expect(written({ id: 'hero', hidden: true })).toEqual({ id: 'hero', hidden: true });
  });
});
