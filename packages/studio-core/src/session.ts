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

/** One step to undo: the changes made together (in one document or several), and their inverses, in undo order. */
interface Step {
  readonly changes: readonly DocumentChange[];
  readonly inverses: readonly DocumentChange[];
}

/** What `undo` and `redo` did: the changes of the step, as made (to tell the person what was undone). */
export interface UndoneStep {
  readonly changes: readonly DocumentChange[];
}

/**
 * An editing session (US-132, US-135): documents (the content of every language, the layout), the changes made to
 * them, one undo history for all, the changes not saved yet, and the problems found. Plain TypeScript: the Studio's
 * user interface shows it and calls it; each document comes with its own store and checker.
 *
 * - Every edit is a `ContentChange`, or a few made together, in one document (moving a section to another page) or
 *   several (moving a job in every language); their inverses are recorded, so undo gives back the exact data.
 * - Undo and redo are changes too: they join the changes to save, so saving after an undo saves the undone data.
 * - Typing in a field gives one change per key stroke: `{ merge: true }` makes them one step to undo.
 * - A document back to its saved data (every change undone) has nothing to save, and no problem left to show.
 * - After saving, `rebase` takes the data as the files hold it, when a source put things elsewhere (new files are
 *   read by name): the document's steps are dropped, since their positions no longer match.
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
    this.applyTogether(
      changes.map((each) => ({ document, change: each })),
      options,
    );
  }

  /** Apply changes to several documents as one step (the same move in every language), as `apply` does. */
  applyTogether(changes: readonly DocumentChange[], options: { merge?: boolean } = {}): void {
    if (changes.length === 0) return;
    const inverses: DocumentChange[] = [];
    const changed = this.#run(changes, (data, item) =>
      inverses.unshift({ ...item, change: invert(data, item.change) }),
    );
    const previous = this.#undo.at(-1);
    const [first] = changes;
    if (
      options.merge &&
      changes.length === 1 &&
      previous?.changes.length === 1 &&
      sameField(previous.changes[0]!, first!)
    ) {
      this.#undo[this.#undo.length - 1] = { ...previous, changes };
    } else {
      this.#undo.push({ changes, inverses });
    }
    this.#redo.length = 0;
    this.#commit(changed, changes);
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
    this.#commit(this.#run(step.inverses), step.inverses);
    return { changes: step.changes };
  }

  /** Redo the last undone step. */
  redo(): UndoneStep | undefined {
    const step = this.#redo.pop();
    if (!step) return undefined;
    this.#undo.push(step);
    this.#commit(this.#run(step.changes), step.changes);
    return { changes: step.changes };
  }

  /**
   * Take a document's data as its files hold it now, after a save (US-136): a source may put a new item elsewhere
   * than where it was inserted. When it differs, the document's steps are dropped (their positions no longer
   * match) and true is returned. Nothing happens while the document has changes not saved yet.
   */
  rebase(document: DocumentId, data: Readonly<Record<string, unknown>>): boolean {
    if (equal(data, this.data(document)) || this.#pending.some((item) => item.document === document)) return false;
    this.#data.set(document, { ...data });
    this.#saved.set(document, data);
    const others = (step: Step) => step.changes.every((item) => item.document !== document);
    this.#undo.splice(0, this.#undo.length, ...this.#undo.filter(others));
    this.#redo.splice(0, this.#redo.length, ...this.#redo.filter(others));
    this.#issues = this.#issues.filter((issue) => issue.document !== document);
    this.#notify();
    return true;
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

  /** Apply changes in order, without keeping them: the new data of each document they touch. */
  #run(
    changes: readonly DocumentChange[],
    before?: (data: Readonly<Record<string, unknown>>, item: DocumentChange) => void,
  ): Map<DocumentId, Record<string, unknown>> {
    const changed = new Map<DocumentId, Record<string, unknown>>();
    for (const item of changes) {
      const data = changed.get(item.document) ?? this.data(item.document);
      before?.(data, item);
      changed.set(item.document, applyChange(data, item.change));
    }
    return changed;
  }

  #commit(changed: ReadonlyMap<DocumentId, Record<string, unknown>>, changes: readonly DocumentChange[]): void {
    for (const [document, data] of changed) this.#data.set(document, data);
    for (const item of changes) this.#wait(item);
    for (const [document, data] of changed) {
      if (!equal(data, this.#saved.get(document))) continue;
      this.#pending = this.#pending.filter((item) => item.document !== document);
      this.#issues = this.#issues.filter((issue) => issue.document !== document);
    }
    this.#notify();
  }

  /**
   * Add a change to those waiting to be saved, as few as they can be: a `set` of the same field as the last one
   * replaces it (only the last value is saved), and a `set` inside an item inserted just before goes into that item
   * (a new item is saved whole: a source that makes a file per item names it after what was typed, not after an
   * empty item).
   */
  #wait(item: DocumentChange): void {
    let at = this.#pending.length - 1;
    while (at >= 0 && this.#pending[at]!.document !== item.document) at -= 1;
    const inserted = at === -1 ? undefined : this.#pending[at]!;
    if (inserted?.change.op === 'insert' && item.change.op === 'set') {
      const { path, index, value } = inserted.change;
      const inside =
        path.length + 1 < item.change.path.length && [...path, index].every((s, i) => s === item.change.path[i]);
      if (inside) {
        try {
          const rest = item.change.path.slice(path.length + 1);
          const filled = applyChange(
            { item: value },
            { op: 'set', path: ['item', ...rest], value: item.change.value },
          ).item;
          this.#pending[at] = { document: item.document, change: { ...inserted.change, value: filled } };
          return;
        } catch {
          // Not a place inside the item (a list position it does not have): kept as its own change.
        }
      }
    }
    const last = this.#pending.at(-1);
    if (last && sameField(last, item)) this.#pending[this.#pending.length - 1] = item;
    else this.#pending.push(item);
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

/** Whether two changes both set the same field of the same document. */
function sameField(a: DocumentChange, b: DocumentChange): boolean {
  return (
    a.document === b.document &&
    a.change.op === 'set' &&
    b.change.op === 'set' &&
    a.change.path.length === b.change.path.length &&
    a.change.path.every((segment, index) => segment === b.change.path[index])
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
