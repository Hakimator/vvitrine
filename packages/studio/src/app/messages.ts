/**
 * The page builder's texts (US-135), in the Studio's language: the actions of its menus and what is announced after
 * each of them (WCAG 4.1.3). Kept apart, with their parameters, so that the Studio's other languages (US-149) are a
 * catalogue to add, not code to change.
 */
/** The moves every list offers in its items' menus: sections on a page, jobs, skills... */
export interface MoveTexts {
  readonly moveUp: string;
  readonly moveDown: string;
  readonly moveTop: string;
  readonly moveBottom: string;
}

const moveTexts: MoveTexts = {
  moveUp: 'Move up',
  moveDown: 'Move down',
  moveTop: 'Move to the top',
  moveBottom: 'Move to the bottom',
};

export interface BuilderTexts extends MoveTexts {
  readonly pages: string;
  readonly home: string;
  readonly inFooter: string;
  readonly hidden: string;
  readonly notInMenu: string;
  readonly actionsFor: (name: string, page: string) => string;
  readonly moveToPage: (page: string) => string;
  readonly hide: string;
  readonly show: string;
  readonly leaveOutOfMenu: string;
  readonly showInMenu: string;
  readonly remove: string;
  readonly addSection: string;
  readonly addTo: (page: string) => string;
  readonly nothingToAdd: string;
  readonly empty: string;
  readonly hint: string;
  readonly dragHandle: string;
  readonly moved: (name: string, position: number, count: number, page: string) => string;
  readonly movedToPage: (name: string, page: string, position: number, count: number) => string;
  readonly added: (name: string, page: string, position: number, count: number) => string;
  readonly removed: (name: string, page: string) => string;
  readonly hiddenOn: (name: string, page: string) => string;
  readonly shownOn: (name: string, page: string) => string;
  readonly leftOutOfMenu: (name: string) => string;
  readonly shownInMenu: (name: string) => string;
}

export const builderTexts: BuilderTexts = {
  ...moveTexts,
  pages: 'Pages',
  home: 'Home page',
  inFooter: 'linked from the footer',
  hidden: 'hidden',
  notInMenu: 'not in the menu',
  actionsFor: (name, page) => `Move or change ${name} on ${page}`,
  moveToPage: (page) => `Move to ${page}`,
  hide: 'Hide on this page',
  show: 'Show on this page',
  leaveOutOfMenu: 'Leave out of the menu',
  showInMenu: 'Show in the menu',
  remove: 'Remove from this page',
  addSection: 'Add a section',
  addTo: (page) => `Add a section to ${page}`,
  nothingToAdd: 'Every installed section is on this page.',
  empty: 'No section on this page yet.',
  hint: 'Drag a section by its handle to move it, on its page or to another one, or use its menu, which has every move and more.',
  dragHandle: 'Drag to move',
  moved: (name, position, count, page) => `${name} moved to position ${position} of ${count} on ${page}.`,
  movedToPage: (name, page, position, count) => `${name} moved to ${page}, position ${position} of ${count}.`,
  added: (name, page, position, count) => `${name} added to ${page}, position ${position} of ${count}.`,
  removed: (name, page) => `${name} removed from ${page}.`,
  hiddenOn: (name, page) => `${name} hidden on ${page}. It keeps its place and its options.`,
  shownOn: (name, page) => `${name} shown on ${page} again.`,
  leftOutOfMenu: (name) => `${name} left out of the menu.`,
  shownInMenu: (name) => `${name} shown in the menu.`,
};

/** The texts of list items in the content forms (US-136): their menu, and what is announced after each action. */
export interface ListTexts extends MoveTexts {
  readonly actionsFor: (item: string, language: string) => string;
  readonly duplicate: string;
  readonly remove: string;
  readonly addTo: (list: string) => string;
  readonly fixedOrder: string;
  readonly dragHandle: string;
  readonly moved: (item: string, position: number, count: number, list: string) => string;
  /** Where an action applied: every language, or one (`language` is its code, e.g. "FR"). */
  readonly where: (language?: string) => string;
  readonly duplicated: (item: string, where: string, position: number, count: number) => string;
  readonly removed: (item: string, list: string, where: string) => string;
  readonly added: (list: string, position: number, where: string) => string;
}

export const listTexts: ListTexts = {
  ...moveTexts,
  actionsFor: (item, language) => `Move or change ${item} (${language})`,
  duplicate: 'Duplicate',
  remove: 'Remove',
  addTo: (list) => `Add to ${list}`,
  fixedOrder:
    'Each item is a file of its own, listed in the order of the file names: items cannot be moved here, and adding, duplicating or removing one changes this language only.',
  dragHandle: 'Drag to move',
  moved: (item, position, count, list) =>
    `${item} moved to position ${position} of ${count} in ${list}, in every language.`,
  where: (language) => (language ? `in ${language} only` : 'in every language'),
  duplicated: (item, where, position, count) =>
    `${item} duplicated, ${where}: the copy is at position ${position} of ${count}.`,
  removed: (item, list, where) => `${item} removed from ${list}, ${where}. Undo brings it back.`,
  added: (list, position, where) => `New item added to ${list}, at position ${position}, ${where}.`,
};
