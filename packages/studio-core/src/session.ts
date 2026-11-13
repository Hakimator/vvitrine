import { applyChange, type ContentChange, type ContentIssue } from '@vvitrine/core';
import { invert } from './history.ts';

/** The name of a document in a session: the content of one language ('en'), or the layout ('layout'). */
export type DocumentId = string;

/** A change to one document. */
export interface DocumentChange {
  readonly document: DocumentId;
  readonly change: ContentChange;
}

/** A problem found in one document. */
export type DocumentIssue = ContentIssue & { readonly document: DocumentId };

/** Where a document's changes are saved (a port: the local Studio saves through the development server). */
export interface DocumentStore {
  save(changes: readonly ContentChange[]): Promise<{ readonly files: readonly string[] }>;
}

/** What checks a document as a build would (a port, like `DocumentStore`). */
export interface DocumentChecker {
  check(data: Readonly<Record<string, unknown>>): Promise<readonly ContentIssue[]>;
}

/** A document the session edits: its data as the files hold it, and where it is checked and saved. */
export interface SessionDocument {
  readonly data: Readonly<Record<string, unknown>>;
  readonly store: DocumentStore;
  readonly checker: DocumentChecker;
}

/** Saving was refused: a document has problems a build would refuse (NFR-24). Nothing was sent. */
export class SaveBlockedError extends Error {
  readonly issues: readonly DocumentIssue[];
  constructor(issues: readonly DocumentIssue[]) {
    super(`Cannot save: ${issues.length} problem${issues.length > 1 ? 's' : ''} to fix first.`);
    this.issues = issues;
  }
}

/** One step to undo: the changes made together, and their inverses (in the order that undoes them). */
interface Step {
  readonly document: DocumentId;
  readonly changes: readonly ContentChange[];
  readonly inverses: readonly ContentChange[];
}

/** What `undo` and `redo` did: the changes of the step, as made (to tell the person what was undone). */
export interface UndoneStep {
  readonly document: DocumentId;
  readonly changes: readonly ContentChange[];
}

/**
 * An editing session (US-132, US-135): documents (the content of every language, the layout), the changes made to
 * them, one undo history for all, the changes not saved yet, and the problems found. Plain TypeScript: the Studio's
 * user interface shows it and calls it; each document comes with its own store and checker.
 *
 * - Every edit is a `ContentChange`, or a few made together (moving a section to another page); their inverses are
 *   recorded, so undo gives back the exact data before them.
 * - Undo and redo are changes too: they join the changes to save, so saving after an undo saves the undone data.
 * - Typing in a field gives one change per key stroke: `{ merge: true }` makes them one step to undo.
 * - A document back to its saved data (every change undone) has nothing to save, and no problem left to show.
 */
export class EditSession {
  readonly #documents = new Map<DocumentId, SessionDocument>();
  readonly #data = new Map<DocumentId, Record<string, unknown>>();
  /** The data of each document as its files hold it (when the session started, or at the last save). */
  readonly #saved = new Map<DocumentId, Readonly<Record<string, unknown>>>();
  readonly #undo: Step[] = [];
  readonly #redo: Step[] = [];
  #pending: DocumentChange[] = [];
  #issues: DocumentIssue[] = [];
  readonly #listeners = new Set<() => void>();

  constructor(documents: Readonly<Record<DocumentId, SessionDocument>>) {
    for (const [id, document] of Object.entries(documents)) {
      this.#documents.set(id, document);
      this.#data.set(id, { ...document.data });
      this.#saved.set(id, document.data);
    }
  }

  /** The data of a document, as it is now (not to be changed: apply changes instead). */
  data(document: DocumentId): Readonly<Record<string, unknown>> {
    const data = this.#data.get(document);
    if (!data) throw new Error(`No document "${document}" in this session.`);
    return data;
  }

  /**
   * Apply a change, or a few as one step. An impossible change (a path that does not exist) throws
   * `InvalidChangeError` and changes nothing, even when others of the step were possible.
   * With `merge`, a `set` of the same field as the previous step joins that step (one undo for a whole typed word).
   */
  apply(
    document: DocumentId,
    change: ContentChange | readonly ContentChange[],
    options: { merge?: boolean } = {},
  ): void {
    const changes: readonly ContentChange[] = isList(change) ? change : [change];
    if (changes.length === 0) return;
    let data = this.data(document);
    const inverses: ContentChange[] = [];
    for (const each of changes) {
      inverses.unshift(invert(data, each));
      data = applyChange(data, each);
    }
    const previous = this.#undo.at(-1);
    const [first] = changes;
    if (options.merge && changes.length === 1 && previous && sameField(previous, document, first!)) {
      this.#undo[this.#undo.length - 1] = { ...previous, changes };
    } else {
      this.#undo.push({ document, changes, inverses });
    }
    this.#redo.length = 0;
    this.#commit(document, data, changes);
  }

  get canUndo(): boolean {
    return this.#undo.length > 0;
  }

  get canRedo(): boolean {
    return this.#redo.length > 0;
  }

  /** Undo the last step; gives it back (to say what was undone), or undefined when there is nothing to undo. */
  undo(): UndoneStep | undefined {
    const step = this.#undo.pop();
    if (!step) return undefined;
    this.#redo.push(step);
    this.#commit(step.document, step.inverses.reduce(applyChange, this.data(step.document)), step.inverses);
    return { document: step.document, changes: step.changes };
  }

  /** Redo the last undone step. */
  redo(): UndoneStep | undefined {
    const step = this.#redo.pop();
    if (!step) return undefined;
    this.#undo.push(step);
    this.#commit(step.document, step.changes.reduce(applyChange, this.data(step.document)), step.changes);
    return { document: step.document, changes: step.changes };
  }

  /** The changes not saved yet, in order. */
  get pending(): readonly DocumentChange[] {
    return this.#pending;
  }

  get dirty(): boolean {
    return this.#pending.length > 0;
  }

  /** The problems found by the last `check`, in every document. */
  get issues(): readonly DocumentIssue[] {
    return this.#issues;
  }

  /** The problems of one field (or anything inside it), to show next to it. */
  issuesAt(document: DocumentId, path: readonly (string | number)[]): readonly ContentIssue[] {
    return this.#issues.filter(
      (issue) => issue.document === document && path.every((segment, index) => issue.at?.[index] === segment),
    );
  }

  /** Check the documents that changed, or `documents`, as a build would. */
  async check(documents: readonly DocumentId[] = this.#changed()): Promise<void> {
    const found = await Promise.all(
      documents.map(async (id) =>
        (await this.#document(id).checker.check(this.data(id))).map((issue) => ({ ...issue, document: id })),
      ),
    );
    this.#issues = [...this.#issues.filter((issue) => !documents.includes(issue.document)), ...found.flat()];
    this.#notify();
  }

  /**
   * Save the changes not saved yet. The documents are checked first: with problems, nothing is sent and
   * `SaveBlockedError` gives them. Each document is saved on its own; the ones saved before a failure stay saved.
   */
  async save(): Promise<readonly string[]> {
    const documents = this.#changed();
    await this.check(documents);
    const blocking = this.#issues.filter((issue) => documents.includes(issue.document));
    if (blocking.length > 0) throw new SaveBlockedError(blocking);
    const files: string[] = [];
    for (const id of documents) {
      const changes = this.#pending.filter((item) => item.document === id).map((item) => item.change);
      const saved = await this.#document(id).store.save(changes);
      files.push(...saved.files);
      this.#saved.set(id, this.data(id));
      this.#pending = this.#pending.filter((item) => item.document !== id);
      this.#notify();
    }
    return [...new Set(files)];
  }

  /** Be told after every change, undo, redo, check and save (the user interface re-renders). Gives the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #document(id: DocumentId): SessionDocument {
    const document = this.#documents.get(id);
    if (!document) throw new Error(`No document "${id}" in this session.`);
    return document;
  }

  #commit(document: DocumentId, data: Record<string, unknown>, changes: readonly ContentChange[]): void {
    this.#data.set(document, data);
    for (const change of changes) {
      // A `set` of the same field as the last change waiting to be saved replaces it: only the last value is saved.
      const last = this.#pending.at(-1);
      if (last && sameField({ document: last.document, changes: [last.change] }, document, change)) {
        this.#pending[this.#pending.length - 1] = { document, change };
      } else {
        this.#pending.push({ document, change });
      }
    }
    if (equal(data, this.#saved.get(document))) {
      this.#pending = this.#pending.filter((item) => item.document !== document);
      this.#issues = this.#issues.filter((issue) => issue.document !== document);
    }
    this.#notify();
  }

  #changed(): DocumentId[] {
    return [...new Set(this.#pending.map((item) => item.document))];
  }

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }
}

const isList = (change: ContentChange | readonly ContentChange[]): change is readonly ContentChange[] =>
  Array.isArray(change);

/** Whether a step of one change and a change both set the same field of the same document. */
function sameField(
  step: { readonly document: DocumentId; readonly changes: readonly ContentChange[] },
  document: DocumentId,
  change: ContentChange,
): boolean {
  const [previous] = step.changes;
  return (
    step.changes.length === 1 &&
    step.document === document &&
    previous!.op === 'set' &&
    change.op === 'set' &&
    previous!.path.length === change.path.length &&
    previous!.path.every((segment, index) => segment === change.path[index])
  );
}

/** Whether two pieces of data (plain data: objects, lists, strings, numbers, booleans, null) are the same. */
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
