import { applyChange, InvalidChangeError, type ContentChange, type ContentPath } from '@vvitrine/core';
import { describe, expect, it, vi } from 'vitest';
import { EditSession, invert, SaveBlockedError, type ContentChecker, type ContentStore } from '../src/index.ts';

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

const valid: ContentChecker = { checkContent: async () => [] };
const store = () => {
  const saved: { locale: string; changes: readonly ContentChange[] }[] = [];
  const store: ContentStore = {
    saveContent: async (locale, changes) => {
      saved.push({ locale, changes });
      return { files: [`content/resume.${locale}.yaml`] };
    },
  };
  return { saved, store };
};

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
    const session = new EditSession(start());
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
      const all = paths(session.content(locale), []).filter((p) => p.length > 0);
      // Everything of a language may have been removed: then add a key.
      const path = (all.length > 0 ? all[random(all.length)] : [`key${i}`]) as unknown as ContentPath;
      const target = path.reduce<unknown>(
        (at, s) => (at as Record<string, unknown> | undefined)?.[s],
        session.content(locale),
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
    const end = { en: session.content('en'), fr: session.content('fr') };
    while (session.canUndo) session.undo();
    expect({ en: session.content('en'), fr: session.content('fr') }).toEqual(start());
    while (session.canRedo) session.redo();
    expect({ en: session.content('en'), fr: session.content('fr') }).toEqual(end);
  });

  it('makes typing in a field one step to undo, and one change to save', () => {
    const session = new EditSession(start());
    for (const value of ['A', 'Ad', 'Ada'])
      session.apply('en', { op: 'set', path: ['basics', 'name'], value }, { merge: true });
    expect(session.pending).toEqual([{ locale: 'en', change: { op: 'set', path: ['basics', 'name'], value: 'Ada' } }]);
    session.undo();
    expect(session.content('en')).toEqual(start().en);
    expect(session.canUndo).toBe(false);
    session.redo();
    expect((session.content('en').basics as { name: string }).name).toBe('Ada');
  });

  it('changes nothing when a change is impossible, and forgets redo after a new change', () => {
    const session = new EditSession(start());
    expect(() => session.apply('en', { op: 'remove', path: ['work', 9] })).toThrow(InvalidChangeError);
    expect([session.content('en'), session.pending, session.canUndo]).toEqual([start().en, [], false]);
    expect(() => session.content('de')).toThrow('No content for the language "de"');
    session.apply('en', { op: 'remove', path: ['work', 0] });
    session.undo();
    session.apply('en', { op: 'set', path: ['basics', 'name'], value: 'Ada' });
    expect(session.canRedo).toBe(false);
    // The removal was undone before: only the new change is left to undo, then to redo.
    const set = { locale: 'en', change: { op: 'set', path: ['basics', 'name'], value: 'Ada' } };
    expect([session.undo(), session.undo(), session.redo()]).toEqual([set, undefined, set]);
    expect(new EditSession(start()).undo()).toBeUndefined();
    expect(new EditSession(start()).redo()).toBeUndefined();
  });
});

describe('saving and checking (US-132)', () => {
  it('saves the changes of each language in order, then has nothing left to save', async () => {
    const session = new EditSession(start());
    session.apply('en', { op: 'set', path: ['basics', 'name'], value: 'Ada' });
    session.apply('fr', { op: 'set', path: ['basics', 'label'], value: 'Développeuse' });
    session.apply('en', { op: 'remove', path: ['work', 1] });
    const { saved, store: target } = store();
    expect(session.dirty).toBe(true);
    expect(await session.save(target, valid)).toEqual(['content/resume.en.yaml', 'content/resume.fr.yaml']);
    expect(saved).toEqual([
      {
        locale: 'en',
        changes: [
          { op: 'set', path: ['basics', 'name'], value: 'Ada' },
          { op: 'remove', path: ['work', 1] },
        ],
      },
      { locale: 'fr', changes: [{ op: 'set', path: ['basics', 'label'], value: 'Développeuse' }] },
    ]);
    expect(session.dirty).toBe(false);
    // An undo after saving is a change to save too.
    session.undo();
    expect(session.pending).toEqual([
      { locale: 'en', change: { op: 'insert', path: ['work'], index: 1, value: start().en.work[1] } },
    ]);
  });

  it('sends nothing while a change would not build, and points the problem at its field', async () => {
    const session = new EditSession(start());
    session.apply('en', { op: 'set', path: ['work', 0, 'startDate'], value: 2025 });
    const issue = { path: 'work[0].startDate', at: ['work', 0, 'startDate'], message: 'expected a date' };
    const checker: ContentChecker = { checkContent: vi.fn(async (locale) => (locale === 'en' ? [issue] : [])) };
    const { saved, store: target } = store();
    await expect(session.save(target, checker)).rejects.toThrow(SaveBlockedError);
    await expect(session.save(target, checker)).rejects.toThrow('Cannot save: 1 problem to fix first.');
    expect(saved).toEqual([]);
    expect(session.dirty).toBe(true);
    expect(session.issuesAt('en', ['work', 0])).toEqual([{ ...issue, locale: 'en' }]);
    expect(session.issuesAt('en', ['work', 1])).toEqual([]);
    expect(session.issuesAt('fr', ['work', 0])).toEqual([]);
    session.apply('en', { op: 'set', path: ['work', 0, 'startDate'], value: '2025' });
    await session.check(valid);
    expect(session.issues).toEqual([]);
  });

  it('keeps unsaved the languages that failed to save', async () => {
    const session = new EditSession(start());
    session.apply('en', { op: 'set', path: ['basics', 'name'], value: 'Ada' });
    session.apply('fr', { op: 'set', path: ['basics', 'name'], value: 'Adèle' });
    const failing: ContentStore = {
      saveContent: async (locale) => {
        if (locale === 'fr') throw new Error('Disk full');
        return { files: ['content/resume.en.yaml'] };
      },
    };
    await expect(session.save(failing, valid)).rejects.toThrow('Disk full');
    expect(session.pending.map((p) => p.locale)).toEqual(['fr']);
  });

  it('tells its listeners about every change, until they unsubscribe', async () => {
    const session = new EditSession(start());
    const listener = vi.fn();
    const stop = session.subscribe(listener);
    session.apply('en', { op: 'set', path: ['basics', 'name'], value: 'Ada' });
    session.undo();
    session.redo();
    await session.check(valid);
    expect(listener).toHaveBeenCalledTimes(4);
    stop();
    session.undo();
    expect(listener).toHaveBeenCalledTimes(4);
  });
});
