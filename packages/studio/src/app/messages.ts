/**
 * The page builder's texts (US-135), in the Studio's language: the actions of its menus and what is announced after
 * each of them (WCAG 4.1.3). Kept apart, with their parameters, so that the Studio's other languages (US-149) are a
 * catalogue to add, not code to change.
 */
export interface BuilderTexts {
  readonly pages: string;
  readonly home: string;
  readonly inFooter: string;
  readonly hidden: string;
  readonly notInMenu: string;
  readonly actionsFor: (name: string, page: string) => string;
  readonly moveUp: string;
  readonly moveDown: string;
  readonly moveTop: string;
  readonly moveBottom: string;
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
  pages: 'Pages',
  home: 'Home page',
  inFooter: 'linked from the footer',
  hidden: 'hidden',
  notInMenu: 'not in the menu',
  actionsFor: (name, page) => `Move or change ${name} on ${page}`,
  moveUp: 'Move up',
  moveDown: 'Move down',
  moveTop: 'Move to the top',
  moveBottom: 'Move to the bottom',
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
  hint: "Each section's menu moves it, on its page or to another one, hides it, or takes it off the page.",
  moved: (name, position, count, page) => `${name} moved to position ${position} of ${count} on ${page}.`,
  movedToPage: (name, page, position, count) => `${name} moved to ${page}, position ${position} of ${count}.`,
  added: (name, page, position, count) => `${name} added to ${page}, position ${position} of ${count}.`,
  removed: (name, page) => `${name} removed from ${page}.`,
  hiddenOn: (name, page) => `${name} hidden on ${page}. It keeps its place and its options.`,
  shownOn: (name, page) => `${name} shown on ${page} again.`,
  leftOutOfMenu: (name) => `${name} left out of the menu.`,
  shownInMenu: (name) => `${name} shown in the menu.`,
};
