import type { Locale } from './i18n/translator.ts';
import type { RawContent, SourcePlugin, ThemePlugin } from './plugin.ts';

/**
 * Test helpers for plugin authors (exported as `@vvitrine/core/testing`).
 * They are also used by the core's own tests, so they stay in sync with the contracts.
 */

/** In-memory source: content per locale. Useful in tests and for content generated in code. */
export function memorySource(
  byLocale: Readonly<Record<Locale, Record<string, unknown>>>,
  name = 'memory-source',
): SourcePlugin {
  return {
    name,
    kind: 'source',
    apiVersion: 1,
    load: async ({ locale, defaultLocale }): Promise<RawContent> => ({
      data: byLocale[locale] ?? byLocale[defaultLocale] ?? {},
      origin: Object.fromEntries(Object.keys(byLocale[locale] ?? {}).map((k) => [k, `memory:${locale}`])),
    }),
  };
}

/** Minimal theme whose "components" are strings, so tests can assert which one was chosen. */
export function stringTheme(components: Record<string, string> = {}, fallback?: string): ThemePlugin {
  return {
    name: 'string-theme',
    kind: 'theme',
    apiVersion: 1,
    layout: 'Layout',
    components,
    ...(fallback ? { fallback } : {}),
    tokens: { light: { colorPrimary: '#000000' } },
  };
}

/**
 * Contract test for source plugins (Liskov substitution): any source must return an object of
 * content keys for every configured locale and never throw for a missing optional file.
 */
export async function checkSourceContract(source: SourcePlugin, ctx: { root: string; locales: readonly Locale[] }) {
  const problems: string[] = [];
  if (source.kind !== 'source') problems.push('kind must be "source"');
  for (const locale of ctx.locales) {
    const result = await source.load({
      locale,
      defaultLocale: ctx.locales[0]!,
      root: ctx.root,
      logger: { info: () => {}, warn: () => {} },
    });
    if (typeof result !== 'object' || result === null || typeof result.data !== 'object') {
      problems.push(`load() for "${locale}" must return { data: object }`);
    }
  }
  return problems;
}
