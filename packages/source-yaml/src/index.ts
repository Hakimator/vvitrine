import {
  InvalidPluginOptionsError,
  toIssues,
  type RawContent,
  type SourceContext,
  type SourcePlugin,
} from '@vvitrine/core';
import { parse } from 'yaml';
import { z } from 'zod';

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
 */
export default function yamlSource(options: YamlSourceOptions = {}): SourcePlugin {
  const parsed = Options.safeParse(options);
  if (!parsed.success) throw new InvalidPluginOptionsError('@vvitrine/source-yaml', toIssues(parsed.error));
  const { dir, file } = parsed.data;

  return {
    name: '@vvitrine/source-yaml',
    kind: 'source',
    apiVersion: 1,
    async load(ctx: SourceContext): Promise<RawContent> {
      const folder = dir.replace(/[\\/]+$/, '');
      const candidates = [`${file}.${ctx.locale}`, file].flatMap((name) =>
        EXTENSIONS.map((ext) => `${folder}/${name}.${ext}`),
      );
      let path: string | undefined;
      let text: string | undefined;
      for (const candidate of candidates) {
        text = await ctx.files.read(candidate);
        if (text !== undefined) {
          path = candidate;
          break;
        }
      }
      if (path === undefined || text === undefined) {
        ctx.logger.warn(
          `No content file found for locale "${ctx.locale}" (looked for ${file}.${ctx.locale}.yaml and ${file}.yaml in ${dir}/).`,
        );
        return { data: {} };
      }

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
  };
}
