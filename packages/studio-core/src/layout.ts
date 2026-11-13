import type { ContentChange, PageConfig, SectionRef } from '@vvitrine/core';

/** A section as placed on a page, whatever the way it is written (`work` or `{ id: work, nav: false }`). */
export interface Placement {
  readonly id: string;
  readonly options?: unknown;
  readonly nav?: boolean;
  readonly hidden?: boolean;
}

export const placement = (ref: SectionRef): Placement => (typeof ref === 'string' ? { id: ref } : ref);

/** How a placement is written: the id alone when nothing else is set, as people write it. */
export function written({ id, ...rest }: Placement): SectionRef {
  const set = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));
  return Object.keys(set).length === 0 ? id : { id, ...set };
}

/** What the page builder does (US-135). Pages and positions are indexes in the layout's `pages`. */
export type PageAction =
  /** Move a section to another position on its page. */
  | { readonly kind: 'move'; readonly page: number; readonly from: number; readonly to: number }
  /** Move a section to another page, at a position there (default: last). */
  | {
      readonly kind: 'move-to-page';
      readonly page: number;
      readonly index: number;
      readonly target: number;
      readonly at?: number;
    }
  /** Place an installed section on a page, at a position (default: last). */
  | { readonly kind: 'add'; readonly page: number; readonly id: string; readonly at?: number }
  /** Take a section off a page. */
  | { readonly kind: 'remove'; readonly page: number; readonly index: number }
  /** Hide a section (it stays on the page with its options, unseen) or show it again. */
  | { readonly kind: 'hide'; readonly page: number; readonly index: number; readonly hidden: boolean }
  /** Show a section in the header menu (the default) or leave it out. */
  | { readonly kind: 'menu'; readonly page: number; readonly index: number; readonly shown: boolean };

/**
 * The changes to the layout file's data that do `action`, made together (one step to undo). `pages` are the pages as
 * built: when the layout file has none (one page with every section, by default), they are written to it first, so
 * the page shows what it showed, then changes.
 */
export function pageChanges(
  layout: Readonly<Record<string, unknown>>,
  pages: readonly PageConfig[],
  action: PageAction,
): ContentChange[] {
  const inFile = layout.pages as readonly PageConfig[] | undefined;
  const current = inFile ?? pages;
  const first: ContentChange[] = inFile ? [] : [{ op: 'set', path: ['pages'], value: pages }];
  const sections = (page: number) => ['pages', page, 'sections'] as const;
  const at = (page: number, index: number) => ['pages', page, 'sections', index] as const;
  const existing = (page: number, index: number) => {
    const ref = current[page]?.sections[index];
    if (ref === undefined) throw new RangeError(`There is no section ${index} on page ${page}.`);
    return placement(ref);
  };
  const length = (page: number) => {
    const found = current[page];
    if (!found) throw new RangeError(`There is no page ${page}.`);
    return found.sections.length;
  };

  switch (action.kind) {
    case 'move':
      return [...first, { op: 'move', path: sections(action.page), from: action.from, to: action.to }];
    case 'move-to-page': {
      const moved = existing(action.page, action.index);
      return [
        ...first,
        { op: 'remove', path: at(action.page, action.index) },
        {
          op: 'insert',
          path: sections(action.target),
          index: action.at ?? length(action.target),
          value: written(moved),
        },
      ];
    }
    case 'add':
      return [
        ...first,
        { op: 'insert', path: sections(action.page), index: action.at ?? length(action.page), value: action.id },
      ];
    case 'remove':
      existing(action.page, action.index);
      return [...first, { op: 'remove', path: at(action.page, action.index) }];
    case 'hide': {
      const section = existing(action.page, action.index);
      const value = written({ ...section, hidden: action.hidden ? true : undefined });
      return [...first, { op: 'set', path: at(action.page, action.index), value }];
    }
    case 'menu': {
      const section = existing(action.page, action.index);
      const value = written({ ...section, nav: action.shown ? undefined : false });
      return [...first, { op: 'set', path: at(action.page, action.index), value }];
    }
  }
}
