import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
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
  /** Folder that holds the Markdown files, relative to the project root. */
  dir: z.string().default('content/projects'),
  /** Content key the files fill, e.g. 'projects'. Each file becomes one item of that list. */
  key: z
    .string()
    .regex(/^[a-z][\w-]*$/, { message: 'expected a content key such as "projects"' })
    .default('projects'),
});

export type MarkdownSourceOptions = z.input<typeof Options>;

/** "bibliotheque.en.md" -> { slug: 'bibliotheque', locale: 'en' }; "bibliotheque.md" -> no locale. */
const FILE = /^(?<slug>[a-z0-9-]+)(?:\.(?<locale>[a-z]{2}(?:-[A-Z]{2})?))?\.md$/;
const FRONT_MATTER = /^---\n(?<data>[\s\S]*?)\n---\n?(?<body>[\s\S]*)$/;

/**
 * Reads one Markdown file per item. For locale "en", `name.en.md` wins over `name.md`; files for other locales are
 * ignored. The YAML front matter holds the item's fields; the text below it becomes `x-vvitrine.body` and the file
 * name the default `x-vvitrine.slug`. The key it provides replaces the same key from earlier sources.
 */
export default function markdownSource(options: MarkdownSourceOptions = {}): SourcePlugin {
  const parsed = Options.safeParse(options);
  if (!parsed.success) throw new InvalidPluginOptionsError('@vvitrine/source-markdown', toIssues(parsed.error));
  const { dir, key } = parsed.data;

  return {
    // One instance per content key (projects, posts...): the key keeps plugin names unique.
    name: `@vvitrine/source-markdown:${key}`,
    kind: 'source',
    apiVersion: 1,
    async load(ctx: SourceContext): Promise<RawContent> {
      const folder = isAbsolute(dir) ? dir : join(ctx.root, dir);
      if (!existsSync(folder)) {
        ctx.logger.info(`No folder ${dir}/: "${key}" comes from the other sources.`);
        return { data: {} };
      }

      const chosen = new Map<string, string>();
      for (const name of (await readdir(folder)).sort()) {
        const match = FILE.exec(name)?.groups;
        if (!match?.slug) continue;
        if (match.locale === ctx.locale || (!match.locale && !chosen.has(match.slug))) chosen.set(match.slug, name);
      }

      const items = await Promise.all(
        [...chosen].map(async ([slug, name]) => {
          const path = join(folder, name);
          const shown = relative(ctx.root, path).replaceAll('\\', '/');
          // Windows checkouts may use CRLF line endings: normalise so the result is the same everywhere.
          const text = (await readFile(path, 'utf8')).replaceAll('\r\n', '\n');
          const parts = FRONT_MATTER.exec(text)?.groups;
          if (!parts) throw new Error(`${shown} must start with front matter between two "---" lines.`);
          let data: unknown;
          try {
            data = parse(parts.data ?? '') ?? {};
          } catch (error) {
            throw new Error(`Could not parse the front matter of ${shown}: ${(error as Error).message}`, {
              cause: error,
            });
          }
          if (typeof data !== 'object' || Array.isArray(data)) {
            throw new Error(`The front matter of ${shown} must contain fields such as "name".`);
          }
          const fields = data as Record<string, unknown>;
          const extension = (fields['x-vvitrine'] ?? {}) as Record<string, unknown>;
          const body = (parts.body ?? '').trim();
          return { ...fields, 'x-vvitrine': { slug, ...extension, ...(body ? { body } : {}) } };
        }),
      );

      if (items.length === 0) return { data: {} };
      return { data: { [key]: items }, origin: { [key]: relative(ctx.root, folder).replaceAll('\\', '/') } };
    },
  };
}
