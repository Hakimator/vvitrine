import type { Locale } from './i18n/translator.ts';
import type { ContentPath } from './content/changes.ts';
import type { ProjectFileWriter, ProjectFiles, RawContent, SourcePlugin, ThemePlugin } from './plugin.ts';

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

/**
 * Project files in memory, keyed by their path relative to the project root: `{ 'content/resume.yaml': 'basics: ...' }`.
 * Folders exist when a file is inside them. They can be written too (for tests of saving); `snapshot()` gives them all.
 * For tests of sources, and for content that does not come from a disk.
 */
export function memoryFiles(
  files: Readonly<Record<string, string>>,
): ProjectFiles & ProjectFileWriter & { snapshot(): Record<string, string> } {
  const clean = (path: string) => path.replace(/^\.\//, '').replace(/\/+$/, '');
  const all = new Map(Object.entries(files).map(([path, text]) => [clean(path), text]));
  return {
    read: async (path) => all.get(clean(path)),
    list: async (dir) => {
      const prefix = clean(dir) === '' ? '' : `${clean(dir)}/`;
      const names = new Set<string>();
      for (const path of all.keys()) if (path.startsWith(prefix)) names.add(path.slice(prefix.length).split('/')[0]!);
      return names.size > 0 ? [...names].sort() : undefined;
    },
    write: async (path, text) => {
      all.set(clean(path), text);
    },
    remove: async (path) => {
      all.delete(clean(path));
    },
    snapshot: () => Object.fromEntries([...all].sort(([a], [b]) => a.localeCompare(b))),
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
/**
 * Checks what every source must do. For a source that can save (`save`), it also checks that saving a value unchanged
 * (the first single value of its content) gives the same content back: run it on files it can write
 * (`memoryFiles()`), which it may rewrite.
 */
export async function checkSourceContract(
  source: SourcePlugin,
  ctx: { root: string; locales: readonly Locale[]; files?: ProjectFiles },
) {
  const problems: string[] = [];
  if (source.kind !== 'source') problems.push('kind must be "source"');
  const files = ctx.files ?? memoryFiles({});
  for (const locale of ctx.locales) {
    const context = {
      locale,
      defaultLocale: ctx.locales[0]!,
      root: ctx.root,
      logger: { info: () => {}, warn: () => {} },
      files,
    };
    const result = await source.load(context);
    if (typeof result !== 'object' || result === null || typeof result.data !== 'object') {
      problems.push(`load() for "${locale}" must return { data: object }`);
      continue;
    }
    const leaf = firstValue(result.data, []);
    const writer = files as Partial<ProjectFileWriter>;
    if (!source.save || leaf === undefined || !writer.write || !writer.remove) continue;
    await source.save([{ op: 'set', path: leaf.path, value: leaf.value }], {
      ...context,
      files: files as ProjectFiles & ProjectFileWriter,
    });
    const again = await source.load(context);
    if (JSON.stringify(again.data) !== JSON.stringify(result.data)) {
      problems.push(`saving ${leaf.path.join('.')} unchanged for "${locale}" must load the same content again`);
    }
  }
  return problems;
}

/** The first single value (not an object or a list) of some content, depth first, with its path. */
function firstValue(value: unknown, path: (string | number)[]): { path: ContentPath; value: unknown } | undefined {
  if (typeof value !== 'object' || value === null) {
    return path.length > 0 ? { path: path as unknown as ContentPath, value } : undefined;
  }
  for (const [key, item] of Object.entries(value)) {
    const found = firstValue(item, [...path, Array.isArray(value) ? Number(key) : key]);
    if (found) return found;
  }
  return undefined;
}
