import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { editYaml } from '../src/index.ts';

const resume = `# My resume
basics:
  name: Jane Doe # as on my passport
  label: Developer
  summary: >-
    A long text that the author wrapped
    by hand.
  location: { city: Lyon, countryCode: FR }

# Jobs, latest first
work:
  # The current one
  - name: ACME
    startDate: '2025-06'
    keywords: [TypeScript, Astro]
  - name: Old Corp
    startDate: '2020'
  - name: First
    startDate: '2018'
`;

/** The lines that differ, as [line number, before, after]: what a reviewer sees in the diff. */
function diff(before: string, after: string) {
  const a = before.split('\n');
  const b = after.split('\n');
  return { removed: a.filter((line) => !b.includes(line)), added: b.filter((line) => !a.includes(line)) };
}

describe('YAML editing that keeps the file as written', () => {
  it('changes a value on its own line only, keeping comments and quotes', () => {
    const edited = editYaml(resume, [{ op: 'set', path: ['basics', 'name'], value: 'Ada Lovelace' }]);
    expect(diff(resume, edited)).toEqual({
      removed: ['  name: Jane Doe # as on my passport'],
      added: ['  name: Ada Lovelace # as on my passport'],
    });
    const date = editYaml(resume, [{ op: 'set', path: ['work', 1, 'startDate'], value: '2019-03' }]);
    expect(diff(resume, date).added).toEqual(['    startDate: 2019-03']);
    expect(parse(date).work[1].startDate).toBe('2019-03');
  });

  it('replaces a value written over several lines, and a value in a flow map', () => {
    const summary = editYaml(resume, [{ op: 'set', path: ['basics', 'summary'], value: 'Short.' }]);
    expect(diff(resume, summary)).toEqual({
      removed: ['  summary: >-', '    A long text that the author wrapped', '    by hand.'],
      added: ['  summary: Short.'],
    });
    const city = editYaml(resume, [{ op: 'set', path: ['basics', 'location', 'city'], value: 'Paris' }]);
    expect(diff(resume, city).added).toEqual(['  location: { city: Paris, countryCode: FR }']);
  });

  it('writes a text with line breaks as a block', () => {
    const edited = editYaml(resume, [{ op: 'set', path: ['basics', 'label'], value: 'Line one\nLine two' }]);
    expect(parse(edited).basics.label).toBe('Line one\nLine two');
    expect(edited).toContain('  label: |-\n    Line one\n    Line two\n');
  });

  it('adds a field after the last one of its object, creating objects on the way', () => {
    const email = editYaml(resume, [{ op: 'set', path: ['basics', 'email'], value: 'ada@example.dev' }]);
    expect(diff(resume, email).added).toEqual(['  email: ada@example.dev']);
    expect(email.indexOf('  email:')).toBeGreaterThan(email.indexOf('location:'));
    const nested = editYaml(resume, [{ op: 'set', path: ['work', 0, 'x-vvitrine', 'featured'], value: true }]);
    expect(diff(resume, nested).added).toEqual(['    x-vvitrine:', '      featured: true']);
    const key = editYaml(resume, [{ op: 'set', path: ['languages'], value: [{ language: 'French' }] }]);
    expect(key.endsWith("    startDate: '2018'\nlanguages:\n  - language: French\n")).toBe(true);
  });

  it('removes a field or an item with the comment lines just above it', () => {
    const job = editYaml(resume, [{ op: 'remove', path: ['work', 0] }]);
    expect(diff(resume, job).removed).toEqual([
      '  # The current one',
      '  - name: ACME',
      "    startDate: '2025-06'",
      '    keywords: [TypeScript, Astro]',
    ]);
    expect(diff(resume, job).added).toEqual([]);
    const label = editYaml(resume, [{ op: 'remove', path: ['basics', 'label'] }]);
    expect(diff(resume, label)).toEqual({ removed: ['  label: Developer'], added: [] });
    const tag = editYaml(resume, [{ op: 'remove', path: ['work', 0, 'keywords', 0] }]);
    expect(diff(resume, tag).added).toEqual(['    keywords: [Astro]']);
  });

  it('inserts and moves list items as whole blocks', () => {
    const job = { name: 'New', startDate: '2026' };
    const first = editYaml(resume, [{ op: 'insert', path: ['work'], index: 0, value: job }]);
    expect(first).toContain("work:\n  - name: New\n    startDate: '2026'\n  # The current one\n  - name: ACME");
    const end = editYaml(resume, [{ op: 'insert', path: ['work'], index: 3, value: job }]);
    expect(end.endsWith("    startDate: '2018'\n  - name: New\n    startDate: '2026'\n")).toBe(true);
    const moved = editYaml(resume, [{ op: 'move', path: ['work'], from: 2, to: 0 }]);
    expect(parse(moved).work.map((w: { name: string }) => w.name)).toEqual(['First', 'ACME', 'Old Corp']);
    expect(moved).toContain("work:\n  - name: First\n    startDate: '2018'\n  # The current one\n  - name: ACME");
    const tags = editYaml(resume, [{ op: 'move', path: ['work', 0, 'keywords'], from: 1, to: 0 }]);
    expect(diff(resume, tags).added).toEqual(['    keywords: [Astro, TypeScript]']);
  });

  it('applies several changes in order', () => {
    const edited = editYaml(resume, [
      { op: 'insert', path: ['work'], index: 0, value: { name: 'New', startDate: '2026' } },
      { op: 'set', path: ['work', 1, 'name'], value: 'ACME Inc.' },
      { op: 'remove', path: ['work', 3] },
    ]);
    expect(parse(edited).work.map((w: { name: string }) => w.name)).toEqual(['New', 'ACME Inc.', 'Old Corp']);
    expect(edited.startsWith('# My resume\nbasics:\n  name: Jane Doe # as on my passport\n')).toBe(true);
  });

  it('starts an empty file, and keeps Windows line endings', () => {
    expect(editYaml('', [{ op: 'set', path: ['basics', 'name'], value: 'Ada' }])).toBe('basics:\n  name: Ada\n');
    const windows = 'basics:\r\n  name: Jane\r\nwork: []\r\n';
    const edited = editYaml(windows, [{ op: 'set', path: ['basics', 'label'], value: 'Dev' }]);
    expect(edited).toBe('basics:\r\n  name: Jane\r\n  label: Dev\r\nwork: []\r\n');
  });

  it('stays correct for layouts it does not edit in place (rewritten by the yaml library, comments kept)', () => {
    const anchors = 'base: &b { a: 1 }\n# kept\ncopy: *b\n';
    // No change: the text is kept as it is.
    expect(editYaml(anchors, [])).toBe(anchors);
    const alias = editYaml(anchors, [{ op: 'set', path: ['base', 'a'], value: 2 }]);
    expect(parse(alias)).toEqual({ base: { a: 2 }, copy: { a: 2 } });
    expect(alias).toContain('# kept');
  });

  it('changes only the lines of the value, for every value of the file', () => {
    const leaves = (value: unknown, path: (string | number)[]): (string | number)[][] =>
      typeof value === 'object' && value !== null
        ? Object.entries(value).flatMap(([key, item]) =>
            leaves(item, [...path, Array.isArray(value) ? Number(key) : key]),
          )
        : [path];
    const data = parse(resume) as Record<string, unknown>;
    for (const path of leaves(data, [])) {
      const edited = editYaml(resume, [{ op: 'set', path: path as [string, ...(string | number)[]], value: 'X' }]);
      const changed = diff(resume, edited);
      expect(changed.added, path.join('.')).toHaveLength(1);
      expect(changed.added[0], path.join('.')).toMatch(/X/);
      // A text written over several lines is the only value whose lines go together.
      expect(changed.removed.length, path.join('.')).toBeLessThanOrEqual(path.join('.') === 'basics.summary' ? 3 : 1);
    }
  });
});
