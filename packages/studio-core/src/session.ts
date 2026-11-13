import { applyChange, type ContentChange, type ContentIssue, type Locale } from '@vvitrine/core';
import { invert } from './history.ts';

/** A change to the content of one language. */
export interface LocalizedChange {
  readonly locale: Locale;
  readonly change: ContentChange;
}

/** Where changes are saved (a port: the local Studio saves through the development server, the online one to Git). */
export interface ContentStore {
  saveContent(locale: Locale, changes: readonly ContentChange[]): Promise<{ readonly files: readonly string[] }>;
}

/** What checks content as a build would (a port, like `ContentStore`). */
export interface ContentChecker {
  checkContent(locale: Locale, content: Readonly<Record<string, unknown>>): Promise<readonly ContentIssue[]>;
}

/** Saving was refused: the content has problems a build would refuse (NFR-24). Nothing was sent. */
export class SaveBlockedError extends Error {
  readonly issues: readonly (ContentIssue & { readonly locale: Locale })[];
  constructor(issues: readonly (ContentIssue & { readonly locale: Locale })[]) {
    super(`Cannot save: ${issues.length} problem${issues.length > 1 ? 's' : ''} to fix first.`);
    this.issues = issues;
  }
}

interface Step {
  readonly locale: Locale;
  readonly change: ContentChange;
  readonly inverse: ContentChange;
}

/**
 * An editing session (US-132): the content of every language, the changes made to it, undo and redo, the changes not
 * saved yet, and the problems found. Plain TypeScript: the Studio's user interface shows it and calls it.
 *
 * - Every edit is a `ContentChange`; its inverse is recorded, so undo gives back the exact content before it.
 * - Undo and redo are changes too: they join the changes to save, so saving after an undo saves the undone content.
 * - Typing in a field gives one change per key stroke: `{ merge: true }` makes them one step to undo.
 * - A language back to its saved content (every change undone) has nothing to save, and no problem left to show.
 */
export class EditSession {
  readonly #content = new Map<Locale, Record<string, unknown>>();
  /** The content of each language as its files hold it (when the session started, or at the last save). */
  readonly #saved = new Map<Locale, Readonly<Record<string, unknown>>>();
  readonly #undo: Step[] = [];
  readonly #redo: Step[] = [];
  #pending: LocalizedChange[] = [];
  #issues: (ContentIssue & { readonly locale: Locale })[] = [];
  readonly #listeners = new Set<() => void>();

  constructor(content: Readonly<Record<Locale, Readonly<Record<string, unknown>>>>) {
    for (const [locale, data] of Object.entries(content)) {
      this.#content.set(locale, { ...data });
      this.#saved.set(locale, data);
    }
  }

  /** The content of a language, as it is now (not to be changed: apply changes instead). */
  content(locale: Locale): Readonly<Record<string, unknown>> {
    const data = this.#content.get(locale);
    if (!data) throw new Error(`No content for the language "${locale}" in this session.`);
    return data;
  }

  /**
   * Apply a change. An impossible change (a path that does not exist) throws `InvalidChangeError` and changes nothing.
   * With `merge`, a `set` of the same field as the previous step joins that step (one undo for a whole typed word).
   */
  apply(locale: Locale, change: ContentChange, options: { merge?: boolean } = {}): void {
    const before = this.content(locale);
    const after = applyChange(before, change);
    const previous = this.#undo.at(-1);
    if (options.merge && previous && sameField(previous, locale, change)) {
      this.#undo[this.#undo.length - 1] = { ...previous, change };
    } else {
      this.#undo.push({ locale, change, inverse: invert(before, change) });
    }
    this.#redo.length = 0;
    this.#commit(locale, after, change);
  }

  get canUndo(): boolean {
    return this.#undo.length > 0;
  }

  get canRedo(): boolean {
    return this.#redo.length > 0;
  }

  /** Undo the last step; gives it back (to say what was undone), or undefined when there is nothing to undo. */
  undo(): LocalizedChange | undefined {
    const step = this.#undo.pop();
    if (!step) return undefined;
    this.#redo.push(step);
    this.#commit(step.locale, applyChange(this.content(step.locale), step.inverse), step.inverse);
    return { locale: step.locale, change: step.change };
  }

  /** Redo the last undone step. */
  redo(): LocalizedChange | undefined {
    const step = this.#redo.pop();
    if (!step) return undefined;
    this.#undo.push(step);
    this.#commit(step.locale, applyChange(this.content(step.locale), step.change), step.change);
    return { locale: step.locale, change: step.change };
  }

  /** The changes not saved yet, in order. */
  get pending(): readonly LocalizedChange[] {
    return this.#pending;
  }

  get dirty(): boolean {
    return this.#pending.length > 0;
  }

  /** The problems found by the last `check`, for every language. */
  get issues(): readonly (ContentIssue & { readonly locale: Locale })[] {
    return this.#issues;
  }

  /** The problems of one field (or anything inside it), to show next to it. */
  issuesAt(locale: Locale, path: readonly (string | number)[]): readonly ContentIssue[] {
    return this.#issues.filter(
      (issue) => issue.locale === locale && path.every((segment, index) => issue.at?.[index] === segment),
    );
  }

  /** Check the content of the languages that changed, or of `locales`, as a build would. */
  async check(checker: ContentChecker, locales: readonly Locale[] = this.#changedLocales()): Promise<void> {
    const found = await Promise.all(
      locales.map(async (locale) =>
        (await checker.checkContent(locale, this.content(locale))).map((issue) => ({ ...issue, locale })),
      ),
    );
    this.#issues = [...this.#issues.filter((issue) => !locales.includes(issue.locale)), ...found.flat()];
    this.#notify();
  }

  /**
   * Save the changes not saved yet. The content is checked first: with problems, nothing is sent and
   * `SaveBlockedError` gives them. Each language is saved on its own; the ones saved before a failure stay saved.
   */
  async save(store: ContentStore, checker: ContentChecker): Promise<readonly string[]> {
    const locales = this.#changedLocales();
    await this.check(checker, locales);
    const blocking = this.#issues.filter((issue) => locales.includes(issue.locale));
    if (blocking.length > 0) throw new SaveBlockedError(blocking);
    const files: string[] = [];
    for (const locale of locales) {
      const changes = this.#pending.filter((item) => item.locale === locale).map((item) => item.change);
      const saved = await store.saveContent(locale, changes);
      files.push(...saved.files);
      this.#saved.set(locale, this.content(locale));
      this.#pending = this.#pending.filter((item) => item.locale !== locale);
      this.#notify();
    }
    return [...new Set(files)];
  }

  /** Be told after every change, undo, redo, check and save (the user interface re-renders). Gives the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #commit(locale: Locale, content: Record<string, unknown>, change: ContentChange): void {
    this.#content.set(locale, content);
    // A `set` of the same field as the last change waiting to be saved replaces it: only the last value is saved.
    const last = this.#pending.at(-1);
    if (last && sameField(last, locale, change)) this.#pending[this.#pending.length - 1] = { locale, change };
    else this.#pending.push({ locale, change });
    if (equal(content, this.#saved.get(locale))) {
      this.#pending = this.#pending.filter((item) => item.locale !== locale);
      this.#issues = this.#issues.filter((issue) => issue.locale !== locale);
    }
    this.#notify();
  }

  #changedLocales(): Locale[] {
    return [...new Set(this.#pending.map((item) => item.locale))];
  }

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }
}

/** Whether two changes both set the same field of the same language. */
function sameField(step: { locale: Locale; change: ContentChange }, locale: Locale, change: ContentChange): boolean {
  return (
    step.locale === locale &&
    step.change.op === 'set' &&
    change.op === 'set' &&
    step.change.path.length === change.path.length &&
    step.change.path.every((segment, index) => segment === change.path[index])
  );
}

/** Whether two pieces of content (plain data: objects, lists, strings, numbers, booleans, null) are the same. */
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter((key) => left[key] !== undefined);
  return (
    keys.length === Object.keys(right).filter((key) => right[key] !== undefined).length &&
    keys.every((key) => equal(left[key], right[key]))
  );
}
