import {
  applyChange,
  InvalidChangeError,
  type ContentChange,
  type ContentIssue,
  type ContentPath,
} from '@vvitrine/core';
import { describe, expect, it, vi } from 'vitest';
import { EditSession, invert, SaveBlockedError, type DocumentId, type SessionDocument } from '../src/index.ts';

const start = () => ({
  en: {
    basics: { name: 'Jane', profiles: [{ network: 'GitHub' }] },
    work: [
      { name: 'A', highlights: ['one', 'two'] },
      { name: 'B', highlights: [] },
    ],
  },
  fr: { basics: { name: 'Jeanne' } },
});

/** A start date the build would refuse: not a string that starts with a year. */
const dateProblems = (data: Readonly<Record<string, unknown>>): ContentIssue[] => {
  const date = (data.work as { startDate?: unknown }[] | undefined)?.[0]?.startDate;
  return date === undefined || (typeof date === 'string' && /^\d{4}/.test(date))
    ? []
    : [{ path: 'work[0].startDate', at: ['work', 0, 'startDate'], message: 'expected a date' }];
};

/** A session on `start()`: each language is checked by `dateProblems` and saved into `saved` (or fails to). */
function open(options: { failing?: DocumentId } = {}) {
  const saved: { document: DocumentId; changes: readonly ContentChange[] }[] = [];
  const document = (id: DocumentId, data: Record<string, unknown>): SessionDocument => ({
    data,
    store: {
      save: async (changes) => {
        if (id === options.failing) throw new Error('Disk full');
        saved.push({ document: id, changes });
        return { files: [`content/resume.${id}.yaml`] };
      },
    },
    checker: { check: async (data) => dateProblems(data) },
  });
  const session = new EditSession(
    Object.fromEntries(Object.entries(start()).map(([id, data]) => [id, document(id, data)])),
  );
  return { session, saved };
}

describe('undo of any change (US-132)', () => {
  it('gives back the exact content, for each kind of change', () => {
    const content = start().en;
    const changes: ContentChange[] = [
      { op: 'set', path: ['basics', 'name'], value: 'Ada' },
      { op: 'set', path: ['basics', 'x-vvitrine', 'availability'], value: 'Now' },
      { op: 'set', path: ['awards'], value: [] },
      { op: 'remove', path: ['work', 0] },
      { op: 'remove', path: ['basics', 'profiles'] },
      { op: 'insert', path: ['work', 0, 'highlights'], index: 1, value: 'new' },
      { op: 'move', path: ['work'], from: 1, to: 0 },
    ];
    for (const change of changes) {
      const after = applyChange(content, change);
      expect(applyChange(after, invert(content, change)), JSON.stringify(change)).toEqual(content);
    }
    expect(invert(content, changes[1]!)).toEqual({ op: 'remove', path: ['basics', 'x-vvitrine'] });
  });

  it('undoes and redoes a long series of random changes in both languages, exactly', () => {
    // A seeded generator, so that a failure can be replayed.
    let seed = 42;
    const random = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    const session = open().session;
    const paths = (value: unknown, path: (string | number)[]): (string | number)[][] =>
      typeof value === 'object' && value !== null
        ? [
            path,
            ...Object.entries(value).flatMap(([k, v]) => paths(v, [...path, Array.isArray(value) ? Number(k) : k])),
          ]
        : [path];
    let applied = 0;
    for (let i = 0; i < 300; i += 1) {
      const locale = random(2) === 0 ? 'en' : 'fr';
      const all = paths(session.data(locale), []).filter((p) => p.length > 0);
      // Everything of a language may have been removed: then add a key.
      const path = (all.length > 0 ? all[random(all.length)] : [`key${i}`]) as unknown as ContentPath;
      const target = path.reduce<unknown>(
        (at, s) => (at as Record<string, unknown> | undefined)?.[s],
        session.data(locale),
      );
      const choices: ContentChange[] = [
        { op: 'set', path, value: `v${i}` },
        { op: 'set', path: [...path, `k${i}`] as unknown as ContentPath, value: { n: i } },
        { op: 'remove', path },
      ];
      if (Array.isArray(target)) {
        choices.push({ op: 'insert', path, index: random(target.length + 1), value: `item${i}` });
        if (target.length > 1)
          choices.push({ op: 'move', path, from: random(target.length), to: random(target.length) });
      }
      try {
        session.apply(locale, choices[random(choices.length)]!, { merge: random(4) === 0 });
        applied += 1;
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidChangeError);
      }
    }
    expect(applied).toBeGreaterThan(150);
    const end = { en: session.data('en'), fr: session.data('fr') };
    while (session.canUndo) session.undo();
    expect({ en: session.data('en'), fr: session.data('fr') }).toEqual(start());
    while (session.canRedo) session.redo();
    expect({ en: session.data('en'), fr: session.data('fr') }).toEqual(end);
  });

  it('makes typing in a field one step to undo, and one change to save', () => {
    const session = open().session;
    for (const value of ['A', 'Ad', 'Ada'])
      session.apply('en', { op: 'set', path: ['basics', 'name'], value }, { merge: true });
    expect(session.pending).toEqual([
      { document: 'en', change: { op: 'set', path: ['basics', 'name'], value: 'Ada' } },
    ]);
    session.undo();
    expect(session.data('en')).toEqual(start().en);
    expect(session.canUndo).toBe(false);
    // Back to the content of the files: nothing to save.
    expect([session.pending, session.dirty]).toEqual([[], false]);
    session.redo();
    expect((session.data('en').basics as { name: string }).name).toBe('Ada');
  });

  it('changes nothing when a change is impossible, and forgets redo after a new change', () => {
    const session = open().session;
    expect(() => session.apply('en', { op: 'remove', path: ['work', 9] })).toThrow(InvalidChangeError);
    expect([session.data('en'), session.pending, session.canUndo]).toEqual([start().en, [], false]);
    expect(() => session.data('de')).toThrow('No document "de" in this session.');
    session.apply('en', { op: 'remove', path: ['work', 0] });
    session.undo();
    session.apply('en', { op: 'set', path: ['basics', 'name'], value: 'Ada' });
    expect(session.canRedo).toBe(false);
    // The removal was undone before: only the new change is left to undo, then to redo.
    const set = { document: 'en', changes: [{ op: 'set', path: ['basics', 'name'], value: 'Ada' }] };
    expect([session.undo(), session.undo(), session.redo()]).toEqual([set, undefined, set]);
    expect(open().session.undo()).toBeUndefined();
    expect(open().session.redo()).toBeUndefined();
  });
});

describe('saving and checking (US-132)', () => {
  it('saves the changes of each document in order, then has nothing left to save', async () => {
    const { session, saved } = open();
    session.apply('en', { op: 'set', path: ['basics', 'name'], value: 'Ada' });
    session.apply('fr', { op: 'set', path: ['basics', 'label'], value: 'Développeuse' });
    session.apply('en', { op: 'remove', path: ['work', 1] });
    expect(session.dirty).toBe(true);
    expect(await session.save()).toEqual(['content/resume.en.yaml', 'content/resume.fr.yaml']);
    expect(saved).toEqual([
      {
        document: 'en',
        changes: [
          { op: 'set', path: ['basics', 'name'], value: 'Ada' },
          { op: 'remove', path: ['work', 1] },
        ],
      },
      { document: 'fr', changes: [{ op: 'set', path: ['basics', 'label'], value: 'Développeuse' }] },
    ]);
    expect(session.dirty).toBe(false);
    // An undo after saving is a change to save too.
    session.undo();
    expect(session.pending).toEqual([
      { document: 'en', change: { op: 'insert', path: ['work'], index: 1, value: start().en.work[1] } },
    ]);
  });

  it('sends nothing while a change would not build, and points the problem at its field', async () => {
    const { session, saved } = open();
    session.apply('en', { op: 'set', path: ['work', 0, 'startDate'], value: 2025 });
    await expect(session.save()).rejects.toThrow(SaveBlockedError);
    await expect(session.save()).rejects.toThrow('Cannot save: 1 problem to fix first.');
    expect(saved).toEqual([]);
    expect(session.dirty).toBe(true);
    expect(session.issuesAt('en', ['work', 0])).toEqual([
      { ...dateProblems({ work: [{ startDate: 1 }] })[0], document: 'en' },
    ]);
    expect(session.issuesAt('en', ['work', 1])).toEqual([]);
    expect(session.issuesAt('fr', ['work', 0])).toEqual([]);
    session.apply('en', { op: 'set', path: ['work', 0, 'startDate'], value: '2025' });
    await session.check();
    expect(session.issues).toEqual([]);
  });

  it('has nothing to save, and no problem to show, once every change of a document is undone', async () => {
    const { session } = open();
    session.apply('en', { op: 'set', path: ['work', 0, 'startDate'], value: 'June' });
    session.apply('en', { op: 'remove', path: ['work', 1] });
    session.apply('fr', { op: 'set', path: ['basics', 'label'], value: 'Développeuse' });
    await session.check();
    session.undo();
    session.undo();
    // French is back to its file: only the English changes are left (the removal and its undo cancel out on saving).
    expect(session.pending.map((p) => [p.document, p.change.op])).toEqual([
      ['en', 'set'],
      ['en', 'remove'],
      ['en', 'insert'],
    ]);
    expect(session.issues).toHaveLength(1);
    session.undo();
    expect([session.pending, session.issues, session.dirty]).toEqual([[], [], false]);
    // After a save, the saved data is the new reference.
    await session.save();
    session.redo();
    expect(session.dirty).toBe(true);
    session.undo();
    expect(session.dirty).toBe(false);
  });

  it('keeps unsaved the documents that failed to save', async () => {
    const { session } = open({ failing: 'fr' });
    session.apply('en', { op: 'set', path: ['basics', 'name'], value: 'Ada' });
    session.apply('fr', { op: 'set', path: ['basics', 'name'], value: 'Adèle' });
    await expect(session.save()).rejects.toThrow('Disk full');
    expect(session.pending.map((p) => p.document)).toEqual(['fr']);
  });

  it('tells its listeners about every change, until they unsubscribe', async () => {
    const { session } = open();
    const listener = vi.fn();
    const stop = session.subscribe(listener);
    session.apply('en', { op: 'set', path: ['basics', 'name'], value: 'Ada' });
    session.undo();
    session.redo();
    await session.check();
    expect(listener).toHaveBeenCalledTimes(4);
    stop();
    session.undo();
    expect(listener).toHaveBeenCalledTimes(4);
  });
});

describe('steps of several changes (US-135)', () => {
  it('undoes and redoes the changes made together as one step, and saves each of them', async () => {
    const { session, saved } = open();
    // Moving the second job into another list: a removal and an insertion, undone together.
    session.apply('en', [
      { op: 'remove', path: ['work', 1] },
      { op: 'insert', path: ['work', 0, 'highlights'], index: 0, value: 'B' },
    ]);
    const moved = session.data('en');
    expect(moved.work).toEqual([{ name: 'A', highlights: ['B', 'one', 'two'] }]);
    expect(session.undo()?.changes).toHaveLength(2);
    expect(session.data('en')).toEqual(start().en);
    session.redo();
    expect(session.data('en')).toEqual(moved);
    await session.save();
    expect(saved[0]!.changes.map((change) => change.op)).toEqual(['remove', 'insert']);
  });

  it('changes nothing when one change of the step is impossible', () => {
    const { session } = open();
    const step: ContentChange[] = [
      { op: 'remove', path: ['work', 1] },
      { op: 'remove', path: ['work', 1] },
    ];
    expect(() => session.apply('en', step)).toThrow(InvalidChangeError);
    expect([session.data('en'), session.canUndo, session.pending]).toEqual([start().en, false, []]);
    session.apply('en', []);
    expect(session.canUndo).toBe(false);
  });
});
