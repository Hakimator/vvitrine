import {
  applyChange,
  InvalidPluginOptionsError,
  toIssues,
  type ContentChange,
  type RawContent,
  type SaveContext,
  type SourceContext,
  type SourcePlugin,
} from '@vvitrine/core';
import { parse } from 'yaml';
import { z } from 'zod';
import { editYaml } from '@vvitrine/yaml-edit';

const Options = z.object({
  /** Folder that holds the content files, relative to the project root. */
  dir: z.string().default('content'),
  /** Base file name: `resume` reads `resume.<locale>.yaml`, then falls back to `resume.yaml`. */
  file: z
    .string()
    .regex(/^[\w-]+$/, { message: 'use a file name without extension or folders' })
    .default('resume'),
});

export type YamlSourceOptions = z.input<typeof Options>;

const EXTENSIONS = ['yaml', 'yml', 'json'] as const;

/**
 * Reads one document per locale. Lookup order for locale "en" and file "resume":
 *   content/resume.en.yaml|yml|json  ->  content/resume.yaml|yml|json
 * A missing file is not an error: the core validation reports missing required content.
 * Files are read through `ctx.files`, so the source works wherever the files are (disk, memory, a repository).
 *
 * It can save (the Studio): changes go to the file it read for that locale, edited in place so that comments and
 * layout stay (`editYaml`); JSON files are written back with two-space indentation. Without a file, it creates
 * `resume.yaml` for the default locale and `resume.<locale>.yaml` for the others. It accepts any new content key.
 * When a locale has no file of its own and reads the shared `resume.yaml`, saving it changes the shared file.
 */
export default function yamlSource(options: YamlSourceOptions = {}): SourcePlugin {
  const parsed = Options.safeParse(options);
  if (!parsed.success) throw new InvalidPluginOptionsError('@vvitrine/source-yaml', toIssues(parsed.error));
  const { dir, file } = parsed.data;

  const folder = dir.replace(/[\\/]+$/, '');

  /** The file this locale reads, and its text. */
  async function find(ctx: SourceContext): Promise<{ path: string; text: string } | undefined> {
    const candidates = [`${file}.${ctx.locale}`, file].flatMap((name) =>
      EXTENSIONS.map((ext) => `${folder}/${name}.${ext}`),
    );
    for (const path of candidates) {
      const text = await ctx.files.read(path);
      if (text !== undefined) return { path, text };
    }
    return undefined;
  }

  return {
    name: '@vvitrine/source-yaml',
    kind: 'source',
    apiVersion: 1,
    async load(ctx: SourceContext): Promise<RawContent> {
      const found = await find(ctx);
      if (!found) {
        ctx.logger.warn(
          `No content file found for locale "${ctx.locale}" (looked for ${file}.${ctx.locale}.yaml and ${file}.yaml in ${dir}/).`,
        );
        return { data: {} };
      }

      const { path, text } = found;
      const shown = path.replaceAll('\\', '/');
      let data: unknown;
      try {
        data = path.endsWith('.json') ? JSON.parse(text) : parse(text);
      } catch (error) {
        throw new Error(`Could not parse ${shown}: ${(error as Error).message}`, { cause: error });
      }
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new Error(`${shown} must contain an object with keys such as "basics" and "work".`);
      }
      return {
        data: data as Record<string, unknown>,
        origin: Object.fromEntries(Object.keys(data).map((key) => [key, shown])),
      };
    },
    async save(changes: readonly ContentChange[], ctx: SaveContext): Promise<void> {
      const found = await find(ctx);
      const path = found?.path ?? `${folder}/${ctx.locale === ctx.defaultLocale ? file : `${file}.${ctx.locale}`}.yaml`;
      const text = found?.text ?? '';
      if (path.endsWith('.json')) {
        const data = changes.reduce(applyChange, JSON.parse(text) as Record<string, unknown>);
        await ctx.files.write(path, `${JSON.stringify(data, null, 2)}\n`);
      } else {
        await ctx.files.write(path, editYaml(text, changes));
      }
    },
    accepts: () => true,
  };
}
