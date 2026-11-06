import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  cssVariable,
  formatPartialDate,
  formatPath,
  formatPeriod,
  mergeTokens,
  renderHeadTag,
  toIssues,
  tokensToCss,
  Translator,
} from '../src/index.ts';
import { checkSourceContract, memorySource } from '../src/testing.ts';

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
      ':root{--vv-color-primary:#f00;--vv-radius:4px}@media (prefers-color-scheme: dark){:root{--vv-color-primary:#eee}}',
    );
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
      { path: 'work[2].startDate', message: expect.any(String), hint: 'example: 2024-09', file: 'a.yaml' },
    ]);
  });
});

describe('testing helpers', () => {
  it('memorySource satisfies the source contract', async () => {
    expect(
      await checkSourceContract(memorySource({ en: { basics: { name: 'X' } } }), { root: '/', locales: ['en', 'fr'] }),
    ).toEqual([]);
  });
});
