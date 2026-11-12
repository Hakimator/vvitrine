import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  cssVariable,
  formatPartialDate,
  formatPath,
  formatPeriod,
  mergeTokens,
  protectEmail,
  renderHeadTag,
  toIssues,
  tokensToCss,
  Translator,
} from '../src/index.ts';
import type { SourcePlugin } from '../src/plugin.ts';
import { checkSourceContract, memoryFiles, memorySource } from '../src/testing.ts';

describe('protected e-mail addresses', () => {
  it('percent-encodes the link and hides decoys in the text', () => {
    const email = protectEmail('jane.doe@example.dev');
    expect(email.href).toBe('mailto:%6A%61%6E%65%2E%64%6F%65%40%65%78%61%6D%70%6C%65%2E%64%65%76');
    expect(decodeURIComponent(email.href)).toBe('mailto:jane.doe@example.dev');
    // What people see (hidden parts left out) is the address; the page source is not.
    expect(
      email.parts
        .filter((p) => !p.hidden)
        .map((p) => p.text)
        .join(''),
    ).toBe('jane.doe@example.dev');
    expect(email.parts.map((p) => p.text).join('')).toBe('jane.doe.nospam@example-nospam.dev');
  });

  it('encodes non-ASCII addresses as UTF-8 and keeps unusual ones whole', () => {
    expect(decodeURIComponent(protectEmail('élodie@exemple.fr').href)).toBe('mailto:élodie@exemple.fr');
    expect(protectEmail('root@localhost').parts).toEqual([{ text: 'root@localhost' }]);
  });
});

describe('dates', () => {
  it('formats partial dates per locale', () => {
    expect(formatPartialDate('2025', 'fr')).toBe('2025');
    expect(formatPartialDate('2025-06', 'en')).toBe('Jun 2025');
    expect(formatPartialDate('2025-06', 'fr')).toBe('juin 2025');
    expect(formatPartialDate('2025-06-03', 'en')).toBe('June 3, 2025');
  });

  it('formats an ongoing period with the localized "present" message', () => {
    const t = (key: string) => (key === 'common.present' ? 'present' : key);
    expect(formatPeriod('2025-06', undefined, 'en', t)).toBe('Jun 2025 – present');
    expect(formatPeriod('2023', '2024', 'en', t)).toBe('2023 – 2024');
    expect(formatPeriod(undefined, undefined, 'en', t)).toBe('');
  });
});

describe('translator', () => {
  it('falls back to the default locale, then to the key, and interpolates params', () => {
    const tr = new Translator({ defaultLocale: 'en' });
    tr.add({ en: { hello: 'Hello {name}', only: 'EN only' }, fr: { hello: 'Bonjour {name}' } });
    const fr = tr.forLocale('fr');
    expect(fr('hello', { name: 'Jeanne' })).toBe('Bonjour Jeanne');
    expect(fr('only')).toBe('EN only');
    expect(fr('missing')).toBe('missing');
  });

  it('lets later catalogs override earlier ones', () => {
    const tr = new Translator({ defaultLocale: 'en' });
    tr.add({ en: { a: '1', b: '1' } });
    tr.add({ en: { b: '2' } });
    expect([tr.forLocale('en')('a'), tr.forLocale('en')('b')]).toEqual(['1', '2']);
  });
});

describe('design tokens', () => {
  it('maps token names to --vv-* custom properties and merges user overrides', () => {
    expect(cssVariable('colorOnPrimary')).toBe('--vv-color-on-primary');
    const merged = mergeTokens(
      { light: { colorPrimary: '#111', radius: '4px' }, dark: { colorPrimary: '#eee' } },
      { light: { colorPrimary: '#f00' } },
    );
    expect(tokensToCss(merged)).toBe(
      ':root{color-scheme:light;--vv-color-primary:#f00;--vv-radius:4px}' +
        // System preference, unless the visitor chose light with the switch.
        '@media screen and (prefers-color-scheme: dark){:root:not([data-color-scheme=light]){color-scheme:dark;--vv-color-primary:#eee}}' +
        // The visitor chose dark. Paper stays light either way.
        '@media screen{:root[data-color-scheme=dark]{color-scheme:dark;--vv-color-primary:#eee}}',
    );
    expect(tokensToCss({ light: { radius: '2px' } })).toBe(':root{color-scheme:light;--vv-radius:2px}');
  });

  it('rejects values that could break out of the style block', () => {
    expect(() => tokensToCss({ light: { colorPrimary: 'red}</style><script>' } })).toThrow(/Invalid value/);
  });
});

describe('head tags', () => {
  it('escapes attribute values and script content', () => {
    expect(renderHeadTag({ tag: 'meta', attrs: { name: 'description', content: 'a "b" <c>' } })).toBe(
      '<meta name="description" content="a &quot;b&quot; &lt;c&gt;">',
    );
    expect(renderHeadTag({ tag: 'script', attrs: { type: 'application/ld+json' }, content: '{"x":"</script>"}' })).toBe(
      '<script type="application/ld+json">{"x":"<\\/script>"}</script>',
    );
    expect(renderHeadTag({ tag: 'script', attrs: { async: true, defer: false, src: 'x.js' } })).toBe(
      '<script async src="x.js"></script>',
    );
    expect(() => renderHeadTag({ tag: 'meta', attrs: { 'on load': 'x' } })).toThrow(/Invalid attribute/);
  });
});

describe('issue formatting', () => {
  it('builds readable paths and date hints', () => {
    expect(formatPath(['work', 0, 'startDate'])).toBe('work[0].startDate');
    const result = z.object({ startDate: z.string().regex(/^\d{4}$/) }).safeParse({ startDate: 'x' });
    expect(toIssues(result.error!, ['work', 2], 'a.yaml')).toEqual([
      {
        path: 'work[2].startDate',
        at: ['work', 2, 'startDate'],
        message: expect.any(String),
        hint: 'example: 2024-09',
        file: 'a.yaml',
      },
    ]);
  });
});

describe('testing helpers', () => {
  it('memorySource satisfies the source contract', async () => {
    expect(
      await checkSourceContract(memorySource({ en: { basics: { name: 'X' } } }), { root: '/', locales: ['en', 'fr'] }),
    ).toEqual([]);
  });

  it('checks that a writable source saves what it loaded', async () => {
    const files = memoryFiles({ 'a.txt': 'Jane' });
    const writable = (write: (name: string) => string): SourcePlugin => ({
      name: 'source-text',
      kind: 'source',
      apiVersion: 1,
      load: async (ctx) => ({ data: { basics: { name: await ctx.files.read('a.txt') } } }),
      save: async (changes, ctx) => {
        const name = (changes[0] as { value: string }).value;
        await ctx.files.write('a.txt', write(name));
      },
    });
    expect(
      await checkSourceContract(
        writable((name) => name),
        { root: '/', locales: ['en'], files },
      ),
    ).toEqual([]);
    expect(
      await checkSourceContract(
        writable((name) => `${name}!`),
        { root: '/', locales: ['en'], files },
      ),
    ).toEqual(['saving basics.name unchanged for "en" must load the same content again']);
  });
});

describe('project files in memory', () => {
  const files = memoryFiles({
    'content/resume.yaml': 'a',
    './content/projects/b.md': 'b',
    'content/projects/a.md': 'c',
  });

  it('reads files by their path from the project root', async () => {
    expect(await files.read('content/resume.yaml')).toBe('a');
    expect(await files.read('./content/projects/b.md')).toBe('b');
    expect(await files.read('content/missing.yaml')).toBeUndefined();
  });

  it('lists the files and folders of a folder, sorted, and nothing for a missing folder', async () => {
    expect(await files.list('content')).toEqual(['projects', 'resume.yaml']);
    expect(await files.list('content/projects/')).toEqual(['a.md', 'b.md']);
    expect(await files.list('')).toEqual(['content']);
    expect(await files.list('elsewhere')).toBeUndefined();
  });
});
